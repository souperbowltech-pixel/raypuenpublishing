import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigSummary } from "@/lib/supabase";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Reserved scout token used only to prove the database accepts writes. */
const HEALTH_TOKEN = "HEALTH-CHECK";

type Check = { ok: boolean; error?: string };

function fail(error: { code?: string; message?: string } | null): Check {
  return { ok: false, error: [error?.code, error?.message].filter(Boolean).join(": ") || "unknown error" };
}

/**
 * Database health for the live site. Reports whether Supabase is configured,
 * which key kind is in use, and whether each table can be read and written —
 * never any key material.
 */
export async function GET(req: NextRequest) {
  const limit = rateLimit(`health:${clientIp(req)}`, 10, 60_000);
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const config = supabaseConfigSummary();
  const checks: Record<string, Check> = {};

  if (supabase) {
    const read = await supabase.from("scout_profiles").select("token", { head: true, count: "exact" });
    checks.scoutRead = read.error ? fail(read.error) : { ok: true };

    const cols = await supabase.from("scout_profiles").select("friends_completed, book3_sponsored").limit(1);
    checks.scoutNewColumns = cols.error ? fail(cols.error) : { ok: true };

    // Writing the Book 2 status also proves the status CHECK migration is applied.
    const write = await supabase.from("scout_profiles").upsert(
      { token: HEALTH_TOKEN, scout_name: "Health Check", status: "Unlock_Volume_2", updated_at: new Date().toISOString() },
      { onConflict: "token" }
    );
    checks.scoutWrite = write.error ? fail(write.error) : { ok: true };

    const orders = await supabase.from("orders").select("stripe_session_id", { head: true, count: "exact" });
    checks.ordersTable = orders.error ? fail(orders.error) : { ok: true };

    // Family accounts (registration, sessions and the public share code).
    const families = await supabase.from("families").select("id", { head: true, count: "exact" });
    checks.familiesTable = families.error ? fail(families.error) : { ok: true };

    const sessions = await supabase.from("family_sessions").select("token_hash", { head: true, count: "exact" });
    checks.familySessionsTable = sessions.error ? fail(sessions.error) : { ok: true };

    const shareCodes = await supabase.from("scout_profiles").select("family_id, share_code").limit(1);
    checks.scoutFamilyColumns = shareCodes.error ? fail(shareCodes.error) : { ok: true };

    // Re-save an existing row exactly as the app does, to surface write errors
    // that the store would otherwise only log (uses the demo profile's own row).
    const demoRows = await supabase.from("scout_profiles").select("token", { head: true, count: "exact" }).eq("token", "CAPTAIN-RAY-700");
    checks.demoRowCount = demoRows.error ? fail(demoRows.error) : { ok: demoRows.count === 1, error: `rows with the demo token: ${demoRows.count}` };

    const demo = await supabase.from("scout_profiles").select("*").eq("token", "CAPTAIN-RAY-700").maybeSingle();
    if (demo.error) {
      checks.demoRowRead = fail(demo.error);
    } else if (!demo.data) {
      checks.demoRowRead = { ok: false, error: "no demo row yet" };
    } else {
      const { error } = await supabase.from("scout_profiles").upsert(
        {
          token: demo.data.token,
          scout_name: demo.data.scout_name,
          completed_pages: demo.data.completed_pages,
          quiz_score: demo.data.quiz_score,
          referral_score: demo.data.referral_score,
          status: demo.data.status,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "token" }
      );
      if (error) {
        checks.demoRowRewrite = fail(error);
      } else {
        // A write that reports success but changes nothing is the dangerous case.
        const after = await supabase
          .from("scout_profiles")
          .select("updated_at")
          .eq("token", "CAPTAIN-RAY-700")
          .maybeSingle();
        const landed = after.data?.updated_at && after.data.updated_at !== demo.data.updated_at;
        checks.demoRowRewrite = {
          ok: Boolean(landed),
          error: `before ${demo.data.updated_at} → after ${after.data?.updated_at ?? "nothing"}`,
        };
      }
    }
  }

  const ok = config.configured && Object.values(checks).every((c) => c.ok);
  return NextResponse.json(
    { ok, database: config, checks, checkedAt: new Date().toISOString() },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}

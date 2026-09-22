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

    // Writing the Book 2 status also proves the status CHECK migration is applied,
    // and reading it back proves the write really landed and is not served from a
    // cached snapshot (the stale-progress bug fixed on Sept 22).
    const stamp = new Date().toISOString();
    const write = await supabase.from("scout_profiles").upsert(
      { token: HEALTH_TOKEN, scout_name: "Health Check", status: "Unlock_Volume_2", updated_at: stamp },
      { onConflict: "token" }
    );
    if (write.error) {
      checks.scoutWrite = fail(write.error);
    } else {
      const back = await supabase.from("scout_profiles").select("updated_at").eq("token", HEALTH_TOKEN).maybeSingle();
      // Postgres returns "+00:00" where JavaScript writes "Z": compare instants.
      const readBack = back.data?.updated_at ? Date.parse(back.data.updated_at) : NaN;
      checks.scoutWrite = readBack === Date.parse(stamp)
        ? { ok: true }
        : { ok: false, error: `wrote ${stamp} but read back ${back.data?.updated_at ?? "nothing"}` };
    }

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
  }

  const ok = config.configured && Object.values(checks).every((c) => c.ok);
  return NextResponse.json(
    { ok, database: config, checks, checkedAt: new Date().toISOString() },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}

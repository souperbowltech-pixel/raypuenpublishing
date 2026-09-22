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
  }

  const ok = config.configured && Object.values(checks).every((c) => c.ok);
  return NextResponse.json(
    { ok, database: config, checks, checkedAt: new Date().toISOString() },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}

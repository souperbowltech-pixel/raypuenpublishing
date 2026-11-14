import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseConfigSummary } from "@/lib/supabase";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { ADMIN_COOKIE, isAdminCookie, isAdminKey } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/** Reserved scout token used only to prove the database accepts writes. */
const HEALTH_TOKEN = "HEALTH-CHECK";

type Check = { ok: boolean; error?: string };
type Db = NonNullable<typeof supabase>;

/**
 * Every table check reads one row rather than asking for a HEAD count.
 *
 * A HEAD response carries no body, so PostgREST has nowhere to put its error:
 * supabase-js sees no error object and the check passes even when the table does
 * not exist — which is the single thing these checks exist to catch. Asking for
 * one row costs the same and actually fails when it should.
 */

function fail(error: { code?: string; message?: string } | null): Check {
  return { ok: false, error: [error?.code, error?.message].filter(Boolean).join(": ") || "unknown error" };
}

/**
 * The whole check answers within this, whatever the database does.
 *
 * Each query already aborts after 8 seconds (lib/supabase.ts), but there used to
 * be thirteen of them in a row, so an unreachable database held this route open
 * for well over a minute and the caller got no answer at all. That is exactly
 * when a health check is needed, so it now reports the database as unreachable.
 * The reads run together, so a healthy database answers in about three round
 * trips and six seconds is generous.
 */
const HEALTH_DEADLINE_MS = 6_000;

/** One-row reads, each proving a table or column exists: [check name, table, columns]. */
const READ_CHECKS: [string, string, string][] = [
  ["scoutRead", "scout_profiles", "token"],
  ["scoutNewColumns", "scout_profiles", "friends_completed, book3_sponsored"],
  ["ordersTable", "orders", "stripe_session_id"],
  // Family accounts (registration, sessions and the public share code).
  ["familiesTable", "families", "id"],
  ["familySessionsTable", "family_sessions", "token_hash"],
  ["scoutFamilyColumns", "scout_profiles", "family_id, share_code"],
  // The video addresses printed inside the book read from this table. The pages
  // fall back to a waiting screen if it is missing, so this check is the only
  // thing that would tell us the migration never reached production.
  ["videosTable", "videos", "slug"],
  // The referral column decides whether a real friend referral is recorded at
  // all. `getScout` reads the row with select('*'), so a missing column is
  // invisible there: registration keeps working and the referral is silently
  // dropped. This check is the only thing that would catch it.
  ["scoutReferralColumn", "scout_profiles", "referred_by_scout_token"],
  // The Parent's Guide / Chief Scout Patrol funnel. Without these tables a paid
  // Patrol cannot issue its gift codes and the free printed guide cannot be
  // claimed or approved. patrol_gifts is keyed by the gift code, not an id.
  ["patrolLeadersTable", "patrol_leaders", "id"],
  ["patrolGiftsTable", "patrol_gifts", "code"],
  ["guideApprovalsTable", "guide_approvals", "id"],
  // Requests from schools on /neighborhood. The form saves here and nowhere else.
  ["schoolRequestsTable", "school_requests", "id"],
  // Private review copies and paid Guide codes (migration 20261114).
  ["libraryGrantsTable", "library_grants", "id"],
  // The shared rate limit (migration 20261115). Without it limits quietly fall
  // back to one count per server instance, which only this check would show.
  ["rateLimitsTable", "rate_limits", "key"],
];

/**
 * Fills `checks` in place, so a deadline that fires mid-way keeps what finished.
 * Every query carries `signal`: once the deadline fires, nothing still in flight
 * keeps a recovering database busy, and the test write is never sent late.
 */
async function runChecks(db: Db, checks: Record<string, Check>, signal: AbortSignal) {
  const reads = READ_CHECKS.map(async ([name, table, columns]) => {
    const result = await db.from(table).select(columns).limit(1).abortSignal(signal);
    if (!signal.aborted) checks[name] = result.error ? fail(result.error) : { ok: true };
  });

  // Writing the Book 2 status also proves the status CHECK migration is applied,
  // and reading it back proves the write really landed and is not served from a
  // cached snapshot (the stale-progress bug fixed on Sept 22).
  const writeAndReadBack = async () => {
    const stamp = new Date().toISOString();
    const write = await db
      .from("scout_profiles")
      .upsert(
        { token: HEALTH_TOKEN, scout_name: "Health Check", status: "Unlock_Volume_2", updated_at: stamp },
        { onConflict: "token" }
      )
      .abortSignal(signal);
    if (signal.aborted) return;
    if (write.error) {
      checks.scoutWrite = fail(write.error);
      return;
    }
    const back = await db
      .from("scout_profiles")
      .select("updated_at")
      .eq("token", HEALTH_TOKEN)
      .abortSignal(signal)
      .maybeSingle();
    if (signal.aborted) return;
    // Postgres returns "+00:00" where JavaScript writes "Z": compare instants.
    const readBack = back.data?.updated_at ? Date.parse(back.data.updated_at) : NaN;
    checks.scoutWrite = readBack === Date.parse(stamp)
      ? { ok: true }
      : { ok: false, error: `wrote ${stamp} but read back ${back.data?.updated_at ?? "nothing"}` };
  };

  await Promise.all([...reads, writeAndReadBack()]);
}

/**
 * Database health for the live site. Reports whether Supabase is configured,
 * which key kind is in use, and whether each table can be read and written —
 * never any key material.
 */
export async function GET(req: NextRequest) {
  const limit = await rateLimit(`health:${clientIp(req)}`, 10, 60_000);
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const config = supabaseConfigSummary();
  const checks: Record<string, Check> = {};

  if (supabase) {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => {
        controller.abort();
        resolve("timeout");
      }, HEALTH_DEADLINE_MS);
    });
    try {
      const result = await Promise.race([runChecks(supabase, checks, controller.signal), deadline]);
      if (result === "timeout") {
        checks.databaseReachable = { ok: false, error: `no answer within ${HEALTH_DEADLINE_MS}ms` };
      }
    } catch (err) {
      controller.abort();
      checks.databaseReachable = { ok: false, error: err instanceof Error ? err.message : String(err) };
    } finally {
      clearTimeout(timer);
    }
  }

  const ok = config.configured && Object.values(checks).every((c) => c.ok);

  /**
   * Anyone may ask whether the site is well; only we may ask how it is built.
   *
   * The full answer names the database host, which key is in use and what shape
   * it has, and quotes database errors verbatim — enough to map the schema and
   * to know what to attack (AUDIT SEC-07). A stranger gets the verdict and the
   * names of the checks, which is all an uptime monitor needs.
   */
  const detailed =
    isAdminCookie(req.cookies.get(ADMIN_COOKIE)?.value) ||
    isAdminKey(req.headers.get("x-admin-key"));

  const body = detailed
    ? { ok, database: config, checks, checkedAt: new Date().toISOString() }
    : {
        ok,
        checks: Object.fromEntries(Object.entries(checks).map(([name, c]) => [name, { ok: c.ok }])),
        checkedAt: new Date().toISOString(),
      };

  return NextResponse.json(body, {
    status: ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}

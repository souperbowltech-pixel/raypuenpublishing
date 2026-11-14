import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { supabase, usingServiceRole } from "@/lib/supabase";

/**
 * Rate limiting in two layers.
 *
 * 1. An in-memory count per server instance (the original limiter). It is
 *    free and answers first: a caller over the limit here never reaches the
 *    database.
 * 2. A shared count in Supabase (`hit_rate_limit`, migration
 *    20261115_create_rate_limits.sql), so a caller spread across Vercel's
 *    instances still gets one limit, not one per instance.
 *
 * Keys hold an IP address, so what reaches the database is an HMAC of the key
 * under the service-role key: pseudonymous, and not reversible by someone who
 * can read the table but not the server's secrets.
 *
 * If the shared count cannot be reached, a route chooses: carry on with the
 * in-memory count (ordinary routes), refuse (`whenUnavailable: "refuse"`, for
 * codes, where the route needs the database anyway), or fall back to a
 * stricter in-memory count (a number, for admin sign-in, which itself needs
 * no database and must not lock Ray out when Supabase is slow). Before the
 * migration has run, the shared layer counts as absent, logged once, so a
 * deploy that lands first locks nobody out.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  ok: boolean;
  retryAfter: number;
}

export interface RateLimitOptions {
  /**
   * What to do if the shared count cannot be checked: "memory" (default) uses
   * this instance's count, "refuse" refuses, and a number applies that
   * stricter per-instance limit instead.
   */
  whenUnavailable?: "memory" | "refuse" | number;
}

/** How long to wait for the shared count before treating it as unavailable. */
export const SHARED_LIMIT_TIMEOUT_MS = 2_000;

/** How long a caller is asked to wait when a refusing check could not be made. */
export const UNAVAILABLE_RETRY_SECONDS = 30;

/** Past this many keys, expired buckets are cleared, so rotating addresses cannot grow memory without end. */
export const MEMORY_SWEEP_AT = 10_000;

const buckets = new Map<string, Bucket>();

function sweepMemory(now: number) {
  if (buckets.size < MEMORY_SWEEP_AT) return;
  buckets.forEach((bucket, key) => {
    if (now >= bucket.resetAt) buckets.delete(key);
  });
}

/** The per-instance count. Exported for tests; routes use `rateLimit`. */
export function memoryLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweepMemory(now);
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }

  if (bucket.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { ok: true, retryAfter: 0 };
}

/** The key as stored: an HMAC under a server-only secret, so the IP inside cannot be read back. */
export function sharedKey(key: string, secret: string): string {
  return createHmac("sha256", secret).update(key).digest("hex");
}

/**
 * The function is missing (the migration has not run): PostgREST's own code
 * for an unknown RPC, or Postgres 42883 naming this function. Any other
 * 42883 is a fault inside the function and counts as unavailable.
 */
function notSetUp(error: { code?: string; message?: string }): boolean {
  const namesFunction = /hit_rate_limit/.test(error.message ?? "");
  return error.code === "PGRST202" || (error.code === "42883" && namesFunction);
}

let reportedAbsent = false;

type Shared = { kind: "counted"; result: RateLimitResult } | { kind: "absent" } | { kind: "unavailable" };

async function sharedLimit(key: string, limit: number, windowMs: number): Promise<Shared> {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabase || !usingServiceRole || !secret) return { kind: "absent" };

  try {
    // The abort cancels the request itself, so a slow call cannot still count a hit later.
    const { data, error } = await supabase
      .rpc("hit_rate_limit", { p_key: sharedKey(key, secret), p_limit: limit, p_window_ms: windowMs })
      .abortSignal(AbortSignal.timeout(SHARED_LIMIT_TIMEOUT_MS));
    if (error) {
      if (!notSetUp(error)) return { kind: "unavailable" };
      if (!reportedAbsent) {
        reportedAbsent = true;
        console.error("rate limit: hit_rate_limit is missing (migration 20261115 not run); limits are per instance");
      }
      return { kind: "absent" };
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row.allowed !== "boolean") return { kind: "unavailable" };
    return { kind: "counted", result: { ok: row.allowed, retryAfter: row.allowed ? 0 : Number(row.retry_after) || 1 } };
  } catch {
    // Timed out, aborted or unreachable: the caller decides what that means below.
    return { kind: "unavailable" };
  }
}

/**
 * Counts one request for `key` and says whether it is within `limit` per
 * `windowMs`, across every instance where the shared store is set up.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  options: RateLimitOptions = {}
): Promise<RateLimitResult> {
  const local = memoryLimit(key, limit, windowMs);
  if (!local.ok) return local;

  const shared = await sharedLimit(key, limit, windowMs);
  if (shared.kind === "counted") return shared.result;
  if (shared.kind === "absent") return local;

  // The route name is the part of the key before the IP; the IP is never logged.
  const route = key.split(":")[0];
  const fallback = options.whenUnavailable ?? "memory";
  if (fallback === "refuse") {
    console.error(`rate limit: shared count unavailable, refusing ${route}`);
    return { ok: false, retryAfter: UNAVAILABLE_RETRY_SECONDS };
  }
  if (typeof fallback === "number") {
    console.error(`rate limit: shared count unavailable, ${route} held to ${fallback} per window on this instance`);
    return memoryLimit(`${key}:strict`, fallback, windowMs);
  }
  console.warn(`rate limit: shared count unavailable, using this instance's count for ${route}`);
  return local;
}

/**
 * Collapses an IPv6 address to its /64 network. One subscriber usually holds a
 * whole /64, so counting each address separately would let anyone step around
 * a per-IP limit by changing the last part. IPv4 is returned as it is.
 */
export function limitAddress(raw: string): string {
  // "[addr]:port" and a "%zone" suffix are not part of the address.
  let ip = raw.trim();
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(ip);
  if (bracketed) ip = bracketed[1];
  ip = ip.replace(/%.*$/, "");

  // An IPv4 address written as IPv6 (::ffff:203.0.113.9) is that IPv4 address:
  // collapsing it to a /64 would put every such visitor in one shared count.
  const lastPart = ip.slice(ip.lastIndexOf(":") + 1);
  if (ip.includes(":") && isIP(lastPart) === 4) return lastPart;
  if (isIP(ip) !== 6) return ip; // IPv4, or not an address at all: counted as given

  const [head, tail = ""] = ip.toLowerCase().split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const missing = ip.includes("::") ? 8 - left.length - right.length : 0;
  const groups = [...left, ...Array(Math.max(0, missing)).fill("0"), ...right];
  return `${groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, "")).join(":")}::/64`;
}

/**
 * The caller's address for rate limiting. On Vercel, X-Forwarded-For is set
 * by the platform and overwritten if a client sends its own, so it comes
 * first; this holds only with no other proxy (such as Cloudflare) in front,
 * and off Vercel the header can be sent by anyone. x-real-ip is also set by
 * Vercel, but its spoofing protection is not documented.
 */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return limitAddress(first);

  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return limitAddress(realIp);
  return "127.0.0.1";
}

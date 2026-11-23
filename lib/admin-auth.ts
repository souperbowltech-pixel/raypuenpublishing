import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { supabase, usingServiceRole } from "@/lib/supabase";

/**
 * Who may open the admin view.
 *
 * One shared key, held by Ray and by us, in `ADMIN_TOKEN`. There is no user
 * table to hang a login off and inventing one for two people would be the more
 * fragile choice; what matters is that the key is never guessable, never sits in
 * a URL, and that a missing key locks the door rather than opening it.
 */

export const ADMIN_COOKIE = "gg_admin";
/** A session lasts a working day, so a shared laptop does not stay signed in. */
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 12;
const SESSION_TIMEOUT_MS = 2_000;
const SESSION_PREFIX = "admin-session:";

/** False when no key is configured, in which case the admin view is closed. */
export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_TOKEN && process.env.ADMIN_TOKEN.length >= 16);
}

/**
 * Signed, independently revocable sessions. The existing rate_limits table
 * holds one active marker per random id, with count=0 and reset_at=expiry.
 * Its primary key supports each lookup and its existing indexed sweep removes
 * expired markers. The prefix cannot collide with the limiter's hex-only keys.
 * No migration or extra health check: rateLimitsTable already checks this store.
 * Service-role access is required; there is no per-instance fallback or cache.
 */
export async function adminCookieValue(): Promise<string> {
  if (!adminConfigured() || !supabase || !usingServiceRole) throw new Error("Admin sessions are unavailable.");
  const expiry = Math.floor(Date.now() / 1000) + ADMIN_COOKIE_MAX_AGE;
  const id = randomBytes(32).toString("hex");
  const payload = `v1.${expiry}.${id}`;
  const signature = sign(payload);
  try {
    const { error } = await supabase.from("rate_limits").insert({
      key: SESSION_PREFIX + id, count: 0, reset_at: new Date(expiry * 1000).toISOString(),
    }).abortSignal(AbortSignal.timeout(SESSION_TIMEOUT_MS));
    if (error) throw new Error("Session insert failed.");
  } catch {
    console.error("admin session: could not save session");
    throw new Error("Admin sessions are unavailable.");
  }
  return `${payload}.${signature}`;
}

function sign(payload: string): string {
  return createHmac("sha256", String(process.env.ADMIN_TOKEN)).update(payload).digest("hex");
}

/** Constant-time comparison, so the key cannot be guessed character by character. */
function matches(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** True when this is the configured admin key. */
export function isAdminKey(candidate: unknown): boolean {
  if (!adminConfigured() || typeof candidate !== "string" || !candidate) return false;
  return matches(candidate, String(process.env.ADMIN_TOKEN));
}

/** Parse and authenticate before making any database request. Legacy hashes fail. */
function sessionValue(candidate: unknown): { expiry: number; id: string } | null {
  if (!adminConfigured() || typeof candidate !== "string" || candidate.length > 150) return null;
  const parts = /^v1\.([1-9][0-9]{0,12})\.([a-f0-9]{64})\.([a-f0-9]{64})$/.exec(candidate);
  if (!parts) return null;
  const expiry = Number(parts[1]);
  if (Date.now() >= expiry * 1000) return null;
  if (!matches(parts[3], sign(`v1.${parts[1]}.${parts[2]}`))) return null;
  return { expiry, id: parts[2] };
}

/** Check both the signed deadline and the shared active marker on every request. */
export async function isAdminCookie(candidate: unknown): Promise<boolean> {
  const session = sessionValue(candidate);
  if (!session || !supabase || !usingServiceRole) return false;
  try {
    const { data, error } = await supabase.from("rate_limits").select("count,reset_at")
      .eq("key", SESSION_PREFIX + session.id)
      .abortSignal(AbortSignal.timeout(SESSION_TIMEOUT_MS)).maybeSingle();
    if (error) throw new Error("Session lookup failed.");
    return data?.count === 0 && Date.parse(data.reset_at) === session.expiry * 1000
      && Date.now() < session.expiry * 1000;
  } catch {
    console.error("admin session: could not check session, refusing access");
    return false;
  }
}

/** Idempotent across instances. Only report success after shared deletion succeeds. */
export async function revokeAdminCookie(candidate: unknown): Promise<boolean> {
  const session = sessionValue(candidate);
  if (!session) return true;
  if (!supabase || !usingServiceRole) return false;
  try {
    const { error } = await supabase.from("rate_limits").delete().eq("key", SESSION_PREFIX + session.id)
      .abortSignal(AbortSignal.timeout(SESSION_TIMEOUT_MS));
    if (error) throw new Error("Session deletion failed.");
    return true;
  } catch {
    console.error("admin session: could not revoke session");
    return false;
  }
}

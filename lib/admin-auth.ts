import { createHash, timingSafeEqual } from "node:crypto";

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

/** False when no key is configured — in which case the admin view is closed. */
export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_TOKEN && process.env.ADMIN_TOKEN.length >= 16);
}

/**
 * The value stored in the cookie: a hash, never the key itself. A leaked cookie
 * jar then hands over a session, not the key that opens every session.
 */
export function adminCookieValue(): string {
  return createHash("sha256").update(String(process.env.ADMIN_TOKEN)).digest("hex");
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

/** True when this cookie was issued for the configured admin key. */
export function isAdminCookie(candidate: unknown): boolean {
  if (!adminConfigured() || typeof candidate !== "string" || !candidate) return false;
  return matches(candidate, adminCookieValue());
}

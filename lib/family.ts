/**
 * Family accounts: pure helpers shared by the registration API, the session
 * lookup and the tests. No I/O here.
 *
 * Three different identifiers exist for each child, on purpose:
 *  - the private scout token (`scout_profiles.token`) — never leaves the server
 *    for a registered family; progress is only changed through the session;
 *  - the public share code (`GG-XXXXXX`) — printed in the Grandpa QR and the
 *    friend link; it can start a sponsorship, never edit progress;
 *  - the session token — a random secret in an httpOnly cookie, stored only as
 *    a SHA-256 hash.
 */
import { createHash, randomBytes } from "crypto";

/** The shared demo profile Ray and the committee use to preview the dashboard. */
export const DEMO_SCOUT_TOKEN = "CAPTAIN-RAY-700";

export const SESSION_COOKIE = "gg_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // one school year and then some

export const FIRST_NAME_MAX = 30;
const EMAIL_MAX = 254;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Unambiguous characters for codes people read off paper (no 0/O, 1/I/L). */
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const SHARE_CODE_REGEX = /^GG-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/** Normalize and validate a share code, accepting either 'GG-XXXXXX' or bare 'XXXXXX'. */
export function normalizeShareCode(raw: unknown): string | null {
  if (!raw || typeof raw !== "string") return null;
  let code = raw.trim().toUpperCase();
  if (!code.startsWith("GG-") && code.length === 6) {
    code = `GG-${code}`;
  }
  return SHARE_CODE_REGEX.test(code) ? code : null;
}

/**
 * A child's first name only (Ray's privacy rule: no last names). Letters from
 * any language plus space, apostrophe and hyphen ("Mary Jane", "O'Neil",
 * "Zoë"); spaces are collapsed.
 */
export function validateFirstName(raw: unknown): Result<string> {
  const name = String(raw ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
  if (!name) return { ok: false, error: "Please enter your Chief Explorer's first name." };
  if (name.length > FIRST_NAME_MAX) return { ok: false, error: `Please keep the first name under ${FIRST_NAME_MAX} letters.` };
  if (!/^\p{L}[\p{L}\p{M}' -]*$/u.test(name)) {
    return { ok: false, error: "Please use letters only for the first name." };
  }
  return { ok: true, value: name };
}

export function normalizeEmail(raw: unknown): Result<string> {
  const email = String(raw ?? "").trim().toLowerCase();
  if (!email || email.length > EMAIL_MAX || !EMAIL_REGEX.test(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  return { ok: true, value: email };
}

function randomCode(length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

/** Public code for the Grandpa QR and friend links, e.g. `GG-7KQ2XM`. */
export function newShareCode(): string {
  return `GG-${randomCode(6)}`;
}

/** Private scout id; fits the existing token format `[A-Za-z0-9_-]{3,64}`. */
export function newScoutToken(): string {
  return `S-${randomBytes(18).toString("base64url")}`;
}

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** "Chief Explorer Sam" — Ray's display formula. */
export function displayRank(firstName: string): string {
  return `Chief Explorer ${firstName}`.trim();
}

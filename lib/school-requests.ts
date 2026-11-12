import { normalizeEmail } from "@/lib/family";

/**
 * A school's request from the Neighborhood Chronicles page.
 *
 * Ray is mailing a letter to school principals, and the page it points to ends in
 * one form. This module decides what that form accepts. It is pure on purpose:
 * the API route, the store and the tests all share one definition of "valid".
 */

export interface SchoolRequestInput {
  name: string;
  role: string;
  school: string;
  location: string;
  email: string;
  phone: string | null;
  copies: number | null;
  message: string | null;
}

export type SchoolRequestField = keyof SchoolRequestInput;

export type SchoolRequestResult =
  | { ok: true; value: SchoolRequestInput }
  | { ok: false; field: SchoolRequestField; error: string };

/**
 * Longest value each text field keeps, in characters (code points, as Postgres
 * counts them). The table enforces the same limits; a test keeps them in step.
 */
export const SCHOOL_REQUEST_LIMITS = {
  name: 100,
  role: 80,
  school: 150,
  location: 120,
  phone: 30,
  message: 2000,
} as const;

/** More copies than any one school could ask for is a typo, not an order. */
export const MAX_COPIES = 100_000;

const PHONE_PATTERN = /^[0-9+().\-\s]{7,30}$/;
const MIN_PHONE_DIGITS = 7;

/**
 * Characters that never belong in what Ray reads: C0 and C1 controls, zero-width
 * marks, and bidi overrides, which can make a school name read backwards in the
 * admin list or an email subject. Newline and tab are handled by the callers.
 */
const INVISIBLE_CHARS = "\\u0000-\\u0008\\u000B-\\u001F\\u007F-\\u009F\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u2069\\uFEFF";
const INVISIBLE = new RegExp(`[${INVISIBLE_CHARS}]`, "g");
const HAS_INVISIBLE = new RegExp(`[${INVISIBLE_CHARS}]`);

/** Half of a surrogate pair on its own: Postgres refuses it, so it must never reach the insert. */
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

/** Length as Postgres `char_length` counts it, so an emoji counts once. */
function charLength(text: string): number {
  return [...text].length;
}

type Cleaned = { ok: true; value: string } | { ok: false };

function clean(raw: unknown, keepNewlines: boolean): Cleaned {
  if (raw === undefined || raw === null) return { ok: true, value: "" };
  if (typeof raw !== "string" || LONE_SURROGATE.test(raw)) return { ok: false };
  const text = keepNewlines
    ? raw.replace(/\r\n?/g, "\n").replace(INVISIBLE, "")
    : raw.replace(/[\t\n\r]/g, " ").replace(INVISIBLE, "").replace(/\s+/g, " ");
  return { ok: true, value: text.trim() };
}

type FieldResult<T> = { ok: true; value: T } | { ok: false; field: SchoolRequestField; error: string };

function requiredText(
  raw: unknown,
  field: "name" | "role" | "school" | "location",
  label: string
): FieldResult<string> {
  const cleaned = clean(raw, false);
  if (!cleaned.ok || !cleaned.value) return { ok: false, field, error: `Please enter ${label}.` };
  const max = SCHOOL_REQUEST_LIMITS[field];
  if (charLength(cleaned.value) > max) {
    return { ok: false, field, error: `Please keep ${label} to ${max} characters or fewer.` };
  }
  return { ok: true, value: cleaned.value };
}

function validateEmail(raw: unknown): FieldResult<string> {
  const invalid = { ok: false as const, field: "email" as const, error: "Please enter a valid email address." };
  // normalizeEmail would stringify an array and let a NUL through to a column that refuses it.
  if (typeof raw !== "string" || LONE_SURROGATE.test(raw) || HAS_INVISIBLE.test(raw)) return invalid;
  const email = normalizeEmail(raw);
  return email.ok ? { ok: true, value: email.value } : invalid;
}

function validatePhone(raw: unknown): FieldResult<string | null> {
  const invalid = { ok: false as const, field: "phone" as const, error: "Please enter a phone number, or leave it empty." };
  const cleaned = clean(raw, false);
  if (!cleaned.ok) return invalid;
  if (!cleaned.value) return { ok: true, value: null };
  const digits = cleaned.value.replace(/\D/g, "").length;
  if (!PHONE_PATTERN.test(cleaned.value) || digits < MIN_PHONE_DIGITS) return invalid;
  return { ok: true, value: cleaned.value };
}

function validateCopies(raw: unknown): FieldResult<number | null> {
  const invalid = {
    ok: false as const,
    field: "copies" as const,
    error: "Please enter a whole number of copies, or leave it empty.",
  };
  const value = typeof raw === "string" ? raw.trim() : raw;
  if (value === undefined || value === null || value === "") return { ok: true, value: null };
  // Only a number or digits count: Number(true) is 1, and that is not a request for one copy.
  const n = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isInteger(n) || n < 1 || n > MAX_COPIES) return invalid;
  return { ok: true, value: n };
}

function validateMessage(raw: unknown): FieldResult<string | null> {
  const cleaned = clean(raw, true);
  if (!cleaned.ok) return { ok: false, field: "message", error: "Please check the message and try again." };
  const max = SCHOOL_REQUEST_LIMITS.message;
  if (charLength(cleaned.value) > max) {
    return { ok: false, field: "message", error: `Please keep the message to ${max} characters or fewer.` };
  }
  return { ok: true, value: cleaned.value || null };
}

export function validateSchoolRequest(body: Record<string, unknown>): SchoolRequestResult {
  const name = requiredText(body.name, "name", "your name");
  if (!name.ok) return name;
  const role = requiredText(body.role, "role", "your role");
  if (!role.ok) return role;
  const school = requiredText(body.school, "school", "the school's name");
  if (!school.ok) return school;
  const location = requiredText(body.location, "location", "the city and state");
  if (!location.ok) return location;
  const email = validateEmail(body.email);
  if (!email.ok) return email;
  const phone = validatePhone(body.phone);
  if (!phone.ok) return phone;
  const copies = validateCopies(body.copies);
  if (!copies.ok) return copies;
  const message = validateMessage(body.message);
  if (!message.ok) return message;

  return {
    ok: true,
    value: {
      name: name.value,
      role: role.value,
      school: school.value,
      location: location.value,
      email: email.value,
      phone: phone.value,
      copies: copies.value,
      message: message.value,
    },
  };
}

/**
 * The hidden "website" field. People never see it, so only a form-filling bot
 * puts anything there, whatever the type.
 */
export function isLikelyBot(body: Record<string, unknown>): boolean {
  const value = body.website;
  if (value === undefined || value === null || value === false) return false;
  if (typeof value === "string") return value.trim() !== "";
  return true;
}

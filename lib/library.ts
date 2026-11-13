import { createHmac, randomBytes } from "node:crypto";

/**
 * The private library: books kept off every public page, opened only with a
 * code Ray hands out or a buyer receives after paying.
 *
 * This module holds the rules and nothing that touches the network, so every
 * rule is tested on its own. Storage and the database live in library-store.ts.
 *
 * What it can and cannot promise: a code stops strangers finding a book, and the
 * name printed on every inside page makes a copy personal. Nothing can stop a
 * person copying a file once it is on their own computer, and Ray was told so.
 */

export type GrantKind = "review" | "purchase";

export interface LibraryBook {
  slug: string;
  title: string;
  /** Path inside the private `library` bucket. Uploaded by hand, never by the app. */
  masterPath: string;
  /** What the downloaded file is called on the reader's computer. */
  fileName: string;
}

export const LIBRARY_BOOKS: readonly LibraryBook[] = [
  {
    slug: "geezy-book-1",
    title: "The Geezy Goober, Book 1",
    masterPath: "masters/geezy-book-1.pdf",
    fileName: "The Geezy Goober - Book 1.pdf",
  },
  {
    slug: "neighborhood-book-1",
    title: "The Neighborhood Chronicles, Book 1: David and Goliath",
    masterPath: "masters/neighborhood-book-1.pdf",
    fileName: "The Neighborhood Chronicles - Book 1.pdf",
  },
  {
    slug: "parents-guide",
    title: "The Parent's Guide",
    masterPath: "masters/parents-guide.pdf",
    fileName: "The Parent's Guide.pdf",
  },
];

export function findBook(slug: unknown): LibraryBook | null {
  return LIBRARY_BOOKS.find((book) => book.slug === slug) ?? null;
}

/** A review code lasts 60 days, the time Ray asked for. */
export const REVIEW_CODE_DAYS = 60;
/** A buyer paid for the book, so their code keeps working for a year. */
export const PURCHASE_CODE_DAYS = 365;
/** After a review code is first used, the download stays open this long, then the code is spent. */
export const REVIEW_DOWNLOAD_HOURS = 24;
/** A stamped copy is kept this long for repeat clicks, then deleted to save storage. */
export const COPY_CACHE_HOURS = 24;
/** The storage link handed to the browser is short-lived: long enough to start a download. */
export const SIGNED_URL_SECONDS = 300;

/**
 * Crockford's base 32: digits and capitals without I, L, O and U, so a code read
 * aloud or copied by hand cannot be mistaken. 32 divides 256 exactly, so taking
 * each random byte modulo 32 keeps every character equally likely.
 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_LENGTH = 12; // 60 bits: far beyond guessing at any request rate the site allows

export function generateCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let code = "";
  for (const byte of bytes) code += ALPHABET[byte % 32];
  return code;
}

/** How a code is shown to a person: ABCD-2345-WXYZ. */
export function formatCode(code: string): string {
  if (normalizeCode(code) !== code) throw new Error("formatCode: not a normalized code");
  return code.match(/.{4}/g)!.join("-");
}

/**
 * The code a person typed, in its one true form, or null when it cannot be a
 * code. Spaces and dashes are ignored; O counts as zero and I or L as one.
 * Only plain ASCII is accepted, so no other script's letter can turn into one.
 */
export function normalizeCode(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 64) return null;
  // A code pasted from an email or chat often brings a tab or line break with it.
  const typed = raw.replace(/[\t\r\n]/g, " ");
  if (!/^[\x20-\x7e]*$/.test(typed)) return null;
  const code = typed
    .toUpperCase()
    .replace(/[ -]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  if (code.length !== CODE_LENGTH) return null;
  for (const char of code) if (!ALPHABET.includes(char)) return null;
  return code;
}

/** False when no secret is configured, in which case the library stays closed. */
export function libraryConfigured(): boolean {
  return (process.env.LIBRARY_CODE_SECRET ?? "").trim().length >= 32;
}

/**
 * Only this keyed hash is stored. Without the secret, which lives in the
 * environment and never in the database, a copy of the table cannot be used to
 * test guesses, and a code cannot be read back out of it.
 */
export function hashCode(normalizedCode: string): string {
  if (normalizeCode(normalizedCode) !== normalizedCode) throw new Error("hashCode: not a normalized code");
  if (!libraryConfigured()) throw new Error("hashCode: LIBRARY_CODE_SECRET is missing or shorter than 32 characters");
  return createHmac("sha256", String(process.env.LIBRARY_CODE_SECRET)).update(normalizedCode).digest("hex");
}

/**
 * The characters the PDF's built-in font can print (Windows-1252). Anything
 * else would make the stamping fail, so names are cleaned to this set first.
 */
const WIN_ANSI_EXTRAS = "\u20AC\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u017D\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u017E\u0178";

function printable(char: string): boolean {
  const code = char.codePointAt(0)!;
  if (code === 0xad) return false; // soft hyphen: shown by some viewers, hidden by others
  return (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRAS.includes(char);
}

/** True when every character of the text can be drawn by the PDF's built-in font. */
export function isPrintableText(text: string): boolean {
  return Array.from(text).every(printable);
}

/** Letters with no accent to strip, which NFKD cannot simplify on its own. */
const PLAIN_FORMS: Record<string, string> = { Ł: "L", ł: "l", Đ: "D", đ: "d", ı: "i", Ħ: "H", ħ: "h" };

/** Keep what prints, simplify what can be simplified, drop the rest. */
function toPrintable(text: string): string {
  let out = "";
  for (const char of text.normalize("NFC")) {
    if (/\p{Cc}/u.test(char)) {
      out += " ";
    } else if (printable(char)) {
      out += char;
    } else {
      const plain = PLAIN_FORMS[char] ?? char.normalize("NFKD").replace(/\p{M}/gu, "");
      for (const part of plain) if (printable(part)) out += part;
    }
  }
  return out.replace(/\s+/g, " ").trim();
}

/** Longest name that still fits the stamp on one line of a letter-size page. */
const NAME_MAX = 60;

/** A name is usable only if it still has a letter, in both its own and its capital form. */
function usableName(name: string): boolean {
  return /\p{L}/u.test(name) && name.length <= NAME_MAX;
}

/**
 * The name to print on a copy, or null when nothing usable is left. The capital
 * form is checked too, because a review stamp is printed in capitals and some
 * letters change there: µ becomes a Greek letter the font lacks, ß becomes SS.
 */
export function cleanRecipientName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = toPrintable(raw);
  if (!usableName(name) || !usableName(toPrintable(name.toUpperCase()))) return null;
  return name;
}

/** The line printed at the foot of every inside page. Throws rather than leave the name out. */
export function stampText(kind: GrantKind, name: string): string {
  // Capitals can leave the printable set (µ becomes a Greek letter), so clean again.
  const printed = toPrintable(kind === "review" ? name.toUpperCase() : name);
  if (!usableName(printed)) throw new Error("stampText: the name has nothing printable");
  return kind === "review"
    ? `REVIEW COPY FOR ${printed}. NOT TO BE CIRCULATED`
    : `Licensed to ${printed} for family use. Please do not share.`;
}

export function codeExpiry(kind: GrantKind, now: Date): Date {
  const days = kind === "review" ? REVIEW_CODE_DAYS : PURCHASE_CODE_DAYS;
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

/** The times a grant's state depends on, as the database returns them. */
export interface GrantTimes {
  kind: GrantKind;
  expiresAt: string;
  firstUsedAt: string | null;
  downloadUntil: string | null;
  revokedAt: string | null;
}

export type GrantStatus = "unused" | "open" | "used" | "expired" | "cancelled";
export type RefusalReason = "used" | "expired" | "cancelled";

/**
 * A missing or unreadable date counts as already past, so a bad row closes
 * rather than opens. The columns are timestamptz, which always carry a zone;
 * a time without one would be read in the server's local zone, so it is refused.
 */
function before(now: Date, iso: string | null): boolean {
  if (!iso || !/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}(:?\d{2})?)$/.test(iso)) return false;
  const time = Date.parse(iso);
  return Number.isFinite(time) && Number.isFinite(now.getTime()) && now.getTime() <= time;
}

/**
 * Any row the rules do not recognise is treated as closed.
 *
 * A review copy opened on its last valid day stays downloadable for the whole
 * download window, even past the 60 days: the person used the code in time.
 */
export function grantStatus(grant: GrantTimes, now: Date): GrantStatus {
  if (grant.revokedAt !== null && grant.revokedAt !== undefined) return "cancelled";
  if (grant.kind === "purchase") {
    if (!before(now, grant.expiresAt)) return "expired";
    return grant.firstUsedAt ? "open" : "unused";
  }
  if (grant.kind !== "review") return "cancelled";
  if (!grant.firstUsedAt) return before(now, grant.expiresAt) ? "unused" : "expired";
  return before(now, grant.downloadUntil) ? "open" : "used";
}

export function canDownload(grant: GrantTimes, now: Date): { ok: true } | { ok: false; reason: RefusalReason } {
  const status = grantStatus(grant, now);
  if (status === "unused" || status === "open") return { ok: true };
  return { ok: false, reason: status };
}

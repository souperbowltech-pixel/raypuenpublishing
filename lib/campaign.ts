/** Public campaign rules shared by the form and server validation. No secrets here. */
export const CAMPAIGN_ID = "nc-book-1";
export const CHARACTERS = ["gideon", "sunny", "barnabas", "lucy", "willie"] as const;
export type Character = typeof CHARACTERS[number];
export const CHARACTER_NAMES: Record<Character, string> = {
  gideon: "Gideon", sunny: "Sunny", barnabas: "Barnabas", lucy: "Lucy", willie: "Willie",
};
export const SOURCES = ["direct", "fiesta", "church", "school", "melissa-data", "dm"] as const;
export type CampaignSource = typeof SOURCES[number];
/** How each source tag reads to Ray on the admin page and nowhere else. */
export const SOURCE_LABELS: Record<CampaignSource, string> = {
  direct: "Direct link", fiesta: "Fiesta", church: "Church", school: "School", "melissa-data": "Melissa Data", dm: "DM",
};
export function sourceLabel(source: string): string {
  return (SOURCES as readonly string[]).includes(source) ? SOURCE_LABELS[source as CampaignSource] : source;
}
export const CONSENT_VERSION = "nc-starter-2026-11";
export const CAMPAIGN_BODY_BYTES = 8192;
export const RECEIPT_DAYS = 30;
export const KIT_URL_SECONDS = 300;
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Midnight after Christmas Day in America/Los_Angeles, independent of browser time.
export const SEASON_END = "2026-12-26T08:00:00.000Z";
export function seasonalReservationTitle(now = new Date()): string {
  return now.getTime() < Date.parse(SEASON_END) ? "Reserve a copy for Christmas" : "Reserve a copy";
}
export function campaignSource(raw: unknown): CampaignSource {
  if (typeof raw !== "string" || raw.length > 40) return "direct";
  const value = raw.trim().toLowerCase();
  return SOURCES.includes(value as CampaignSource) ? value as CampaignSource : "direct";
}
export function isCharacter(raw: unknown): raw is Character {
  return typeof raw === "string" && CHARACTERS.includes(raw as Character);
}
export type VoteInput = {
  submissionId: string; character: Character; firstName: string; email: string;
  answer: string | null; phone: string | null; smsConsent: boolean;
  marketingConsent: boolean; source: CampaignSource;
};
export type Validation<T> = { ok: true; value: T } | { ok: false; field: string; error: string };
const error = (field: string, message: string): Validation<never> => ({ ok: false, field, error: message });
export function validateVote(raw: unknown): Validation<VoteInput> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return error("form", "Please check the form.");
  const b = raw as Record<string, unknown>;
  if (typeof b.submissionId !== "string" || !UUID_PATTERN.test(b.submissionId)) return error("form", "Please reload the page and try again.");
  if (!isCharacter(b.character)) return error("character", "Choose one character.");
  if (typeof b.firstName !== "string") return error("firstName", "Enter your first name.");
  const firstName = b.firstName.normalize("NFC").trim();
  if (!/^\p{L}[\p{L}\p{M}' -]{0,49}$/u.test(firstName)) return error("firstName", "Use your first name, up to 50 letters.");
  if (typeof b.email !== "string") return error("email", "Enter your email address.");
  const email = b.email.trim().toLowerCase();
  if (email.length > 254 || /\p{C}/u.test(email) || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(email)) return error("email", "Enter a valid email address.");
  if (b.adultConsent !== true) return error("adultConsent", "A parent or adult caregiver must request the kit.");
  if (b.marketingConsent !== undefined && typeof b.marketingConsent !== "boolean") return error("marketingConsent", "Check your email preference.");
  if (b.smsConsent !== undefined && typeof b.smsConsent !== "boolean") return error("smsConsent", "Check your text preference.");
  if (b.answer !== undefined && b.answer !== null && typeof b.answer !== "string") return error("answer", "Use text for your answer.");
  const answer = typeof b.answer === "string" ? b.answer.normalize("NFC").trim() : "";
  if (answer.length > 500 || /[\x00-\x08\x0b-\x1f\x7f-\x9f\p{Cf}\p{Cs}]/u.test(answer)) return error("answer", "Keep your answer under 500 characters, without control characters.");
  if (b.phone !== undefined && b.phone !== null && typeof b.phone !== "string") return error("phone", "Enter a phone number or leave it empty.");
  const phone = typeof b.phone === "string" ? b.phone.trim() : "";
  if (phone && (!/^\+[1-9]\d{7,14}$/.test(phone) || b.smsConsent !== true)) return error("phone", "Use international format, such as +15551234567, and give text permission, or leave it empty.");
  if (!phone && b.smsConsent === true) return error("phone", "Add your phone number or clear text permission.");
  return { ok: true, value: { submissionId: b.submissionId.toLowerCase(), character: b.character,
    firstName, email, answer: answer || null, phone: phone || null,
    smsConsent: b.smsConsent === true, marketingConsent: b.marketingConsent === true, source: campaignSource(b.source) } };
}
export function reservationQuantity(raw: unknown): number | null {
  return typeof raw === "number" && Number.isInteger(raw) && raw >= 1 && raw <= 10 ? raw : null;
}
/** Quote every cell and neutralize formulas, including whitespace-prefixed variants. */
export function csvCell(value: unknown): string {
  let text = value == null ? "" : String(value);
  if (/^[\s\x00-\x1f]*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

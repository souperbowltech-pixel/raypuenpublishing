import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { CAMPAIGN_ID, RECEIPT_DAYS, UUID_PATTERN, type VoteInput } from "@/lib/campaign";

function secret(): string | null {
  const value = process.env.CAMPAIGN_SECRET;
  return value && value.length >= 32 ? value : null;
}
export function campaignConfigured(): boolean { return secret() !== null; }
function signature(value: string): string | null {
  const key = secret();
  return key ? createHmac("sha256", key).update(`${CAMPAIGN_ID}/${value}`).digest("base64url") : null;
}
export function voteFingerprint(input: VoteInput): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}
export function makeReceipt(id: string, createdAt: string): string | null {
  if (!UUID_PATTERN.test(id)) return null;
  const expiry = Math.floor(Date.parse(createdAt) / 1000) + RECEIPT_DAYS * 86400;
  if (!Number.isSafeInteger(expiry)) return null;
  const body = `${id}.${expiry}`;
  const signed = signature(body);
  return signed ? `${body}.${signed}` : null;
}
export function verifyReceipt(raw: unknown, now = Date.now()): { id: string; expires: number } | null {
  if (typeof raw !== "string" || raw.length > 160) return null;
  const [id, expiry, supplied, extra] = raw.split(".");
  if (extra !== undefined || !UUID_PATTERN.test(id ?? "") || !/^\d{10}$/.test(expiry ?? "") || !/^[A-Za-z0-9_-]{43}$/.test(supplied ?? "")) return null;
  const expires = Number(expiry);
  if (expires * 1000 <= now) return null;
  const expected = signature(`${id}.${expiry}`);
  if (!expected || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return null;
  return { id, expires };
}

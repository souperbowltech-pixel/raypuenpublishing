import { NextResponse } from "next/server";
import { CAMPAIGN_BODY_BYTES, UUID_PATTERN } from "@/lib/campaign";
import { verifyReceipt } from "@/lib/campaign-token";
import { getCampaignVote } from "@/lib/campaign-store";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const CAMPAIGN_HEADERS = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
export function campaignJson(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { ...CAMPAIGN_HEADERS, ...headers } });
}
type Body = { ok: true; body: Record<string, unknown> } | { ok: false; response: NextResponse };
/** Bound actual stream bytes, not merely Content-Length or JavaScript characters. */
export async function readCampaignJson(req: Request): Promise<Body> {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) return { ok: false, response: campaignJson({ error: "Invalid request origin." }, 403) };
  if ((req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase() !== "application/json") {
    return { ok: false, response: campaignJson({ error: "Send a JSON request." }, 415) };
  }
  const reader = req.body?.getReader();
  if (!reader) return { ok: false, response: campaignJson({ error: "Invalid request." }, 400) };
  let bytes = 0;
  let text = "";
  let timedOut = false;
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const cancel = () => { reader.cancel().catch(() => { console.warn("[campaign] request body cancellation failed"); }); };
  const timer = setTimeout(() => { timedOut = true; cancel(); }, 5000);
  try {
    while (true) {
      const chunk = await reader.read();
      if (timedOut) return { ok: false, response: campaignJson({ error: "Request timed out. Please try again." }, 408) };
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > CAMPAIGN_BODY_BYTES) { cancel(); return { ok: false, response: campaignJson({ error: "Request is too large." }, 413) }; }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    const body: unknown = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("invalid body");
    return { ok: true, body: body as Record<string, unknown> };
  } catch { return { ok: false, response: campaignJson({ error: "Invalid request." }, 400) }; }
  finally { clearTimeout(timer); reader.releaseLock(); }
}
const PUBLIC_REQUESTS_PER_HOUR_PER_IP = 600;
const ADMIN_REQUESTS_PER_HOUR_PER_IP = 60;
const REQUESTS_PER_HOUR_PER_SUBJECT = 20;
const LIMIT_WINDOW_MS = 60 * 60_000;
type CampaignAction = "vote" | "receipt" | "kit" | "reserve" | "admin";

export async function campaignLimit(req: Request, action: CampaignAction, subject?: unknown) {
  const ipLimit = action === "admin" ? ADMIN_REQUESTS_PER_HOUR_PER_IP : PUBLIC_REQUESTS_PER_HOUR_PER_IP;
  const result = await rateLimit(`campaign-${action}:${clientIp(req)}`, ipLimit, LIMIT_WINDOW_MS, { whenUnavailable: "refuse" });
  if (!result.ok) return campaignJson({ error: "Too many requests. Please try again later." }, 429, { "Retry-After": String(result.retryAfter) });
  // Only verified receipts may consume a vote's budget. A reissued receipt keeps the same vote ID.
  const subjectId = action === "admin" ? null : action === "vote"
    ? (typeof subject === "string" && UUID_PATTERN.test(subject) ? subject.toLowerCase() : null)
    : verifyReceipt(subject)?.id.toLowerCase();
  if (!subjectId) return null;
  const subjectResult = await rateLimit(`campaign-${action}-subject:${subjectId}`, REQUESTS_PER_HOUR_PER_SUBJECT, LIMIT_WINDOW_MS, { whenUnavailable: "refuse" });
  return subjectResult.ok ? null : campaignJson({ error: "Too many requests. Please try again later." }, 429, { "Retry-After": String(subjectResult.retryAfter) });
}
export async function receiptVote(receipt: unknown) {
  const parsed = verifyReceipt(receipt);
  if (!parsed) return null;
  const vote = await getCampaignVote(parsed.id);
  return vote && !vote.revoked ? vote : null;
}

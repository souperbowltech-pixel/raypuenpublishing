export class CampaignRequestError extends Error {
  constructor(message: string, public field?: string) { super(message); }
}
export function newCampaignSubmissionId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export async function campaignRequest(action: "vote" | "receipt" | "kit" | "reserve", body: unknown): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`/api/campaign/${action}`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body), signal: controller.signal, cache: "no-store" });
    let data: unknown;
    try { data = await response.json(); }
    catch { throw new CampaignRequestError("The service could not answer. Please try again."); }
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new CampaignRequestError("The service could not answer. Please try again.");
    const result = data as Record<string, unknown>;
    if (!response.ok) throw new CampaignRequestError(typeof result.error === "string" ? result.error : "Please try again.", typeof result.field === "string" ? result.field : undefined);
    return result;
  } catch (error) {
    if (error instanceof CampaignRequestError) throw error;
    throw new CampaignRequestError("We could not reach the service. Your request may already be saved. Please try again.");
  } finally { clearTimeout(timer); }
}
export function openCampaignDownload(raw: unknown): void {
  if (typeof raw !== "string" || new URL(raw).protocol !== "https:") throw new CampaignRequestError("The download could not be opened. Please try again.");
  window.location.assign(raw);
}

import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { makeReceipt } from "@/lib/campaign-token";
const save = vi.fn(); const ready = vi.fn(); const getVote = vi.fn(); const kit = vi.fn(); const reserve = vi.fn(); const deliver = vi.fn();
let rateAllowed = true; let testMode = true; let emailOn = true;
vi.mock("@/lib/campaign-store", () => ({ saveVote: (...a: unknown[]) => save(...a), campaignReady: () => ready(),
  getCampaignVote: (...a: unknown[]) => getVote(...a), campaignKitUrl: () => kit(), reserveCopy: (...a: unknown[]) => reserve(...a) }));
vi.mock("@/lib/campaign-delivery", async (actual) => ({ ...(await actual<typeof import("@/lib/campaign-delivery")>()), deliverCampaignMessages: (...a: unknown[]) => deliver(...a) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => ({ ok: rateAllowed, retryAfter: 30 }), clientIp: () => "test-ip" }));
vi.mock("@/lib/stripe", () => ({ isStripeTestMode: () => testMode }));
vi.mock("@/lib/email", () => ({ emailConfigured: () => emailOn }));
const voteRoute = await import("@/app/api/campaign/vote/route");
const receiptRoute = await import("@/app/api/campaign/receipt/route");
const kitRoute = await import("@/app/api/campaign/kit/route");
const reserveRoute = await import("@/app/api/campaign/reserve/route");
const workerRoute = await import("@/app/api/campaign/worker/route");
const healthRoute = await import("@/app/api/campaign/health/route");
const id = "00000000-0000-4000-8000-000000000001";
const input = { submissionId: id, character: "sunny", firstName: "Ana", email: "ana@example.com", adultConsent: true };
const request = (body: unknown, headers = {}) => new NextRequest("https://books.example/api/campaign/vote", {
  method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body),
});
let receipt: string;
beforeEach(() => {
  vi.stubEnv("CAMPAIGN_SECRET", "test-".repeat(10)); vi.stubEnv("CRON_SECRET", "worker-".repeat(6));
  receipt = makeReceipt(id, new Date().toISOString())!;
  rateAllowed = true; testMode = true; emailOn = true;
  save.mockReset().mockResolvedValue({ status: "saved", id, receipt }); ready.mockReset().mockResolvedValue(true);
  getVote.mockReset().mockResolvedValue({ id, firstName: "Ana", email: "ana@example.com", character: "sunny", quantity: null, revoked: false });
  kit.mockReset().mockResolvedValue("https://storage.example/kit"); reserve.mockReset().mockResolvedValue({ status: "saved", quantity: 2 });
  deliver.mockReset().mockResolvedValue({ ok: true, accepted: 1, pending: 0 });
});
afterEach(() => { vi.unstubAllEnvs(); });
describe("public campaign routes", () => {
  it("validates, persists, sends and returns a receipt without exposing parent data", async () => {
    const response = await voteRoute.POST(request({ ...input, source: "fiesta" }));
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ receipt });
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ source: "fiesta", email: "ana@example.com" }));
    expect(deliver).toHaveBeenCalledWith(id); expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it.each([null, [], { ...input, character: "unknown" }, { ...input, adultConsent: false }, { ...input, website: "spam" }])("rejects invalid form %# before saving or emailing", async (body) => {
    expect((await voteRoute.POST(request(body))).status).toBe(400); expect(save).not.toHaveBeenCalled(); expect(deliver).not.toHaveBeenCalled();
  });
  it("rejects wrong origin, content type, invalid JSON and actual oversized UTF-8 bytes", async () => {
    expect((await voteRoute.POST(request(input, { origin: "https://evil.example" }))).status).toBe(403);
    expect((await voteRoute.POST(request(input, { "Content-Type": "text/plain" }))).status).toBe(415);
    const malformed = new NextRequest("https://books.example/api/campaign/vote", { method: "POST", headers: { "content-type": "application/json" }, body: "{" });
    expect((await voteRoute.POST(malformed)).status).toBe(400);
    expect((await voteRoute.POST(request({ ...input, answer: "\u96ea".repeat(3000) }))).status).toBe(413);
    expect(save).not.toHaveBeenCalled();
  });
  it("refuses rate limits, unavailable readiness and failed persistence without sending", async () => {
    rateAllowed = false; const limited = await voteRoute.POST(request(input)); expect(limited.status).toBe(429); expect(limited.headers.get("retry-after")).toBe("30");
    rateAllowed = true; ready.mockResolvedValue(false); expect((await voteRoute.POST(request(input))).status).toBe(503);
    ready.mockResolvedValue(true); save.mockResolvedValue({ status: "unavailable" }); expect((await voteRoute.POST(request(input))).status).toBe(503);
    expect(deliver).not.toHaveBeenCalled();
  });
  it("keeps saved requests successful when the outbox cannot send immediately", async () => {
    deliver.mockResolvedValue({ ok: true, accepted: 0, pending: 1 });
    expect(await (await voteRoute.POST(request(input))).json()).toEqual({ receipt });
  });
  it("does not return old data or send another email for duplicate/conflicting requests", async () => {
    save.mockResolvedValue({ status: "duplicate", receipt: "should-not-leak" });
    const duplicate = await (await voteRoute.POST(request(input))).json(); expect(duplicate.receipt).toBeUndefined(); expect(duplicate.message).toContain("private link");
    save.mockResolvedValue({ status: "conflict" }); expect((await voteRoute.POST(request(input))).status).toBe(409);
    expect(deliver).not.toHaveBeenCalled();
  });
  it("uses actual signed capability validation, denying forged and revoked receipts", async () => {
    const forged = receipt.slice(0, -1) + "!";
    expect((await kitRoute.POST(request({ receipt: forged }))).status).toBe(404); expect(getVote).not.toHaveBeenCalled();
    getVote.mockResolvedValue({ id, revoked: true }); expect((await receiptRoute.POST(request({ receipt }))).status).toBe(404);
    expect(kit).not.toHaveBeenCalled();
  });
  it("shows approved character copy and server-selected mode without contact disclosure", async () => {
    const response = await receiptRoute.POST(request({ receipt, canOrder: true }));
    const body = await response.json(); expect(body.character).toBe("Sunny"); expect(body.message).toContain("trusty guidebook");
    expect(body.canOrder).toBe(false); expect(body.email).toBeUndefined();
    testMode = false; expect((await (await receiptRoute.POST(request({ receipt }))).json()).canOrder).toBe(true);
  });
  it("gives only an authorized fixed kit URL and handles missing files truthfully", async () => {
    expect(await (await kitRoute.POST(request({ receipt, path: "masters/private-book.pdf" }))).json()).toEqual({ url: "https://storage.example/kit" });
    ready.mockResolvedValue(false); expect((await kitRoute.POST(request({ receipt }))).status).toBe(503);
    ready.mockResolvedValue(true); kit.mockResolvedValue(null); expect((await kitRoute.POST(request({ receipt }))).status).toBe(503);
  });
  it("saves a bounded reservation for the capability owner before notifying", async () => {
    expect((await reserveRoute.POST(request({ receipt, quantity: 2, voteId: "attacker-choice" }))).status).toBe(200);
    expect(reserve).toHaveBeenCalledWith(id, 2); expect(deliver).toHaveBeenCalledWith(id);
    expect((await reserveRoute.POST(request({ receipt, quantity: 1000 }))).status).toBe(400);
    reserve.mockResolvedValue({ status: "unavailable" }); expect((await reserveRoute.POST(request({ receipt, quantity: 2 }))).status).toBe(503);
  });
  it("refuses reservations once live ordering is selected by the server", async () => {
    testMode = false; const response = await reserveRoute.POST(request({ receipt, quantity: 2 }));
    expect(response.status).toBe(409); expect((await response.json()).orderPath).toBe("/neighborhood#order"); expect(reserve).not.toHaveBeenCalled();
  });
  it("protects the worker credential before accessing queued messages", async () => {
    expect((await workerRoute.GET(new NextRequest("https://books.example/api/campaign/worker"))).status).toBe(401);
    expect(deliver).not.toHaveBeenCalled();
    const authorized = new NextRequest("https://books.example/api/campaign/worker", { headers: { authorization: "Bearer " + "worker-".repeat(6) } });
    expect((await workerRoute.GET(authorized)).status).toBe(200);
    deliver.mockResolvedValue({ ok: false }); expect((await workerRoute.GET(authorized)).status).toBe(503);
  });
  it("reports missing campaign/email/worker prerequisites without secrets", async () => {
    expect((await healthRoute.GET()).status).toBe(200);
    emailOn = false; expect((await healthRoute.GET()).status).toBe(503);
    vi.stubEnv("CRON_SECRET", ""); expect((await healthRoute.GET()).status).toBe(503);
    expect((await workerRoute.GET(new NextRequest("https://books.example/api/campaign/worker"))).status).toBe(503);
  });
});

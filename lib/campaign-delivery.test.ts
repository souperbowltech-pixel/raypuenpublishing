import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CHARACTER_MESSAGES } from "@/lib/campaign-content";
import { CHARACTERS } from "@/lib/campaign";
const claim = vi.fn(); const finish = vi.fn(); const send = vi.fn();
vi.mock("@/lib/campaign-store", () => ({ claimCampaignJobs: (...a: unknown[]) => claim(...a), finishCampaignJob: (...a: unknown[]) => finish(...a) }));
vi.mock("@/lib/email", () => ({ sendEmail: (...a: unknown[]) => send(...a) }));
vi.mock("@/lib/notifications", () => ({ approvalRecipient: () => "owner@example.invalid" }));
vi.mock("@/lib/site", () => ({ getSiteOrigin: () => "https://books.example" }));
const { deliverCampaignMessages, workerAuthorized, workerConfigured } = await import("@/lib/campaign-delivery");
const job = { id: "00000000-0000-4000-8000-000000000001", voteId: "00000000-0000-4000-8000-000000000002",
  lease: "00000000-0000-4000-8000-000000000003", createdAt: new Date().toISOString(),
  kind: "welcome", firstName: "Ana", email: "ana@example.invalid", character: "sunny", quantity: 2 };
beforeEach(() => {
  vi.stubEnv("CAMPAIGN_SECRET", "test-".repeat(10));
  claim.mockReset().mockResolvedValue([job]); finish.mockReset().mockResolvedValue(true);
  send.mockReset().mockResolvedValue({ sent: true, id: "provider-1" });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
describe("campaign automatic delivery E01-E02", () => {
  it.each(CHARACTERS)("sends %s's approved response and private PDF/reservation links", async (character) => {
    claim.mockResolvedValue([{ ...job, character }]);
    expect(await deliverCampaignMessages(job.voteId)).toEqual({ ok: true, accepted: 1, pending: 0 });
    expect(send.mock.calls[0][0]).toMatchObject({ to: job.email, idempotencyKey: `campaign/${job.id}`, fromName: "Puen Publishing" });
    const text = send.mock.calls[0][0].text as string;
    expect(text).toContain(CHARACTER_MESSAGES[character]);
    expect(text).toContain("https://books.example/welcome/download#receipt=");
    expect(text).toContain("https://books.example/welcome/thanks#receipt=");
    expect(text).not.toContain("?receipt=");
    expect(finish).toHaveBeenCalledWith(expect.objectContaining({ lease: job.lease }), true, null);
  });
  it.each(["timeout", "error", "rejected", "not-configured"])("retains retryable work after %s without claiming a send", async (reason) => {
    send.mockResolvedValue({ sent: false, reason, error: "private provider body" });
    expect(await deliverCampaignMessages()).toEqual({ ok: true, accepted: 0, pending: 1 });
    expect(finish).toHaveBeenCalledWith(job, false, reason);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("private provider body");
  });
  it("keeps a lost database acknowledgement pending even after provider acceptance", async () => {
    finish.mockResolvedValue(false);
    expect(await deliverCampaignMessages()).toMatchObject({ accepted: 0, pending: 1 });
  });
  it("never emails an already-expired kit link after a long worker outage", async () => {
    const expired = { ...job, createdAt: new Date(Date.now() - 31 * 86400000).toISOString() };
    claim.mockResolvedValue([expired]);
    expect(await deliverCampaignMessages()).toMatchObject({ accepted: 0, pending: 1 });
    expect(send).not.toHaveBeenCalled(); expect(finish).toHaveBeenCalledWith(expired, false, "expired");
  });
  it("still sends an old reservation notice without a live kit receipt or signing secret", async () => {
    vi.stubEnv("CAMPAIGN_SECRET", "");
    claim.mockResolvedValue([{ ...job, kind: "reservation", createdAt: "2020-01-01T00:00:00Z" }]);
    expect(await deliverCampaignMessages()).toMatchObject({ accepted: 1 });
    expect(send.mock.calls[0][0].to).toBe("owner@example.invalid");
  });
  it("catches provider exceptions and releases the lease as failed", async () => {
    send.mockRejectedValue(new Error("secret data"));
    expect(await deliverCampaignMessages()).toMatchObject({ accepted: 0, pending: 1 });
    expect(finish).toHaveBeenCalledWith(job, false, "error");
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("secret data");
  });
  it("sends reservation notices to the owner, explicitly identifying unpaid interest", async () => {
    claim.mockResolvedValue([{ ...job, kind: "reservation" }]); await deliverCampaignMessages();
    expect(send.mock.calls[0][0]).toMatchObject({ to: "owner@example.invalid", subject: "Neighborhood Chronicles: copy reservation" });
    expect(send.mock.calls[0][0].text).toContain("Copies: 2");
    expect(send.mock.calls[0][0].text).toContain("not a paid order");
  });
  it("sends nothing when claims or signing configuration are unavailable", async () => {
    claim.mockResolvedValue(null); expect((await deliverCampaignMessages()).ok).toBe(false);
    claim.mockResolvedValue([job]); vi.stubEnv("CAMPAIGN_SECRET", "");
    expect(await deliverCampaignMessages()).toMatchObject({ pending: 1 }); expect(send).not.toHaveBeenCalled();
  });
  it("requires a strong worker secret and exact Bearer credential", () => {
    vi.stubEnv("CRON_SECRET", ""); expect(workerConfigured()).toBe(false); expect(workerAuthorized("Bearer guessed")).toBe(false);
    vi.stubEnv("CRON_SECRET", "worker-".repeat(6));
    expect(workerConfigured()).toBe(true); expect(workerAuthorized("Bearer " + "worker-".repeat(6))).toBe(true);
    expect(workerAuthorized("Bearer guessed")).toBe(false); expect(workerAuthorized(null)).toBe(false);
  });
});

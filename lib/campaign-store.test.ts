import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { validateVote } from "@/lib/campaign";
const id = "00000000-0000-4000-8000-000000000001";
const created = "2026-11-22T00:00:00Z";
let configured = true;
let role = true;
let queryAnswer: { data: unknown; error: unknown };
const calls: { method: string; args: unknown[] }[] = [];
const rpc = vi.fn(); const getBucket = vi.fn(); const list = vi.fn(); const sign = vi.fn();
function query() {
  const q: Record<string, unknown> = {};
  for (const method of ["from", "select", "eq", "single", "order", "limit", "or"]) {
    q[method] = (...args: unknown[]) => { calls.push({ method, args }); return q; };
  }
  q.then = (resolve: (v: unknown) => unknown) => Promise.resolve(queryAnswer).then(resolve);
  q.rpc = rpc; return q;
}
vi.mock("@/lib/supabase", () => ({
  get supabase() { return configured ? query() : null; },
  get usingServiceRole() { return role; },
  storageClient: { storage: { getBucket: (...a: unknown[]) => getBucket(...a), from: (bucket: string) => {
    calls.push({ method: "bucket", args: [bucket] });
    return { list: (...a: unknown[]) => list(...a), createSignedUrl: (...a: unknown[]) => sign(...a) };
  } } },
}));
const store = await import("@/lib/campaign-store");
const input = () => {
  const parsed = validateVote({ submissionId: id, character: "sunny", firstName: "Ana", email: "ana@example.com", adultConsent: true });
  if (!parsed.ok) throw new Error(parsed.error); return parsed.value;
};
const row = () => ({ id, created_at: created, character: "sunny", first_name: "Ana", email: "ana@example.com",
  phone: null, answer: null, source: "fiesta", sms_consent: false, marketing_consent: false, reserved_quantity: null, revoked_at: null });
beforeEach(() => {
  configured = true; role = true; calls.length = 0; queryAnswer = { data: row(), error: null };
  vi.stubEnv("CAMPAIGN_SECRET", "test-".repeat(10));
  rpc.mockReset(); getBucket.mockReset(); list.mockReset(); sign.mockReset();
  getBucket.mockResolvedValue({ data: { public: false }, error: null });
  list.mockResolvedValue({ data: [{ name: "starter-kit.pdf" }], error: null });
  sign.mockResolvedValue({ data: { signedUrl: "https://storage.example/private-kit" }, error: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
describe("campaign persistence V05-V09", () => {
  it.each(["saved", "replay"])("returns a signed private receipt only for %s input", async (status) => {
    rpc.mockResolvedValue({ data: { status, id, createdAt: created }, error: null });
    expect(await store.saveVote(input())).toMatchObject({ status, id, receipt: expect.stringContaining(id) });
    expect(rpc).toHaveBeenCalledWith("submit_campaign_vote", { p_input: input(), p_fingerprint: expect.stringMatching(/^[0-9a-f]{64}$/) });
  });
  it.each(["duplicate", "conflict"])("does not expose an earlier receipt for %s", async (status) => {
    rpc.mockResolvedValue({ data: { status, id, createdAt: created }, error: null });
    expect(await store.saveVote(input())).toEqual({ status });
  });
  it.each([
    { data: null, error: null }, { data: { status: "saved" }, error: null },
    { data: { status: "saved", id: "bad", createdAt: created }, error: null },
    { data: { status: "saved", id, createdAt: "bad" }, error: null },
    { data: null, error: { message: "ana@example.com" } },
  ])("never claims an unsaved or malformed RPC result succeeded %#", async (answer) => {
    rpc.mockResolvedValue(answer); expect(await store.saveVote(input())).toEqual({ status: "unavailable" });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("ana@example.com");
  });
  it("refuses missing/anonymous DB and a missing signing secret without making a write", async () => {
    configured = false; expect(await store.saveVote(input())).toEqual({ status: "unavailable" });
    configured = true; role = false; expect(await store.saveVote(input())).toEqual({ status: "unavailable" });
    role = true; vi.stubEnv("CAMPAIGN_SECRET", ""); expect(await store.saveVote(input())).toEqual({ status: "unavailable" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("turns a thrown connection failure into an unavailable result", async () => {
    rpc.mockRejectedValue(new Error("private details")); expect(await store.saveVote(input())).toEqual({ status: "unavailable" });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("private details");
  });
  it("reads the signed row's exact ID and rejects malformed/missing rows", async () => {
    expect(await store.getCampaignVote(id)).toMatchObject({ id, character: "sunny", quantity: null });
    expect(calls).toContainEqual({ method: "eq", args: ["id", id] });
    expect(await store.getCampaignVote("bad")).toBeNull();
    queryAnswer = { data: { id }, error: null }; expect(await store.getCampaignVote(id)).toBeNull();
  });
  it("keeps the RPC's original reservation quantity on repeated requests", async () => {
    rpc.mockResolvedValue({ data: { status: "existing", quantity: 2 }, error: null });
    expect(await store.reserveCopy(id, 9)).toEqual({ status: "existing", quantity: 2 });
    expect(rpc).toHaveBeenCalledWith("reserve_campaign_copy", { p_vote_id: id, p_quantity: 9 });
    rpc.mockResolvedValue({ data: null, error: {} }); expect(await store.reserveCopy(id, 2)).toEqual({ status: "unavailable" });
  });
});
describe("campaign readiness and download D01-D03", () => {
  it("requires deployed RPC, private storage and the exact file", async () => {
    rpc.mockResolvedValue({ data: true, error: null }); expect(await store.campaignReady()).toBe(true);
    getBucket.mockResolvedValue({ data: { public: true }, error: null }); expect(await store.campaignReady()).toBe(false);
    getBucket.mockResolvedValue({ data: { public: false }, error: null });
    list.mockResolvedValue({ data: [{ name: "starter-kit.pdf.bak" }], error: null }); expect(await store.campaignReady()).toBe(false);
    list.mockResolvedValue({ data: [{ name: "starter-kit.pdf" }], error: null });
    rpc.mockResolvedValue({ data: false, error: null }); expect(await store.campaignReady()).toBe(false);
  });
  it("uses only the fixed private kit path and five-minute HTTPS download", async () => {
    expect(await store.campaignKitUrl()).toBe("https://storage.example/private-kit");
    expect(sign).toHaveBeenCalledWith("campaign/starter-kit.pdf", 300, { download: "Neighborhood-Chronicles-Starter-Kit.pdf" });
    expect(calls).toContainEqual({ method: "bucket", args: ["library"] });
    sign.mockResolvedValue({ data: { signedUrl: "javascript:alert(1)" }, error: null }); expect(await store.campaignKitUrl()).toBeNull();
    sign.mockResolvedValue({ data: null, error: {} }); expect(await store.campaignKitUrl()).toBeNull();
  });
});
describe("outbox and bounded administration E02/A03", () => {
  it("claims bounded leased jobs, preserving stable IDs for provider deduplication", async () => {
    const job = { id, voteId: id, lease: id, kind: "welcome", attempts: 1, createdAt: created,
      firstName: "Ana", email: "ana@example.com", character: "sunny", quantity: null };
    rpc.mockResolvedValue({ data: [job], error: null }); expect(await store.claimCampaignJobs()).toEqual([job]);
    expect(rpc).toHaveBeenCalledWith("claim_campaign_messages", { p_vote_id: null, p_limit: 3 });
    rpc.mockResolvedValue({ data: [{ ...job, lease: "bad" }], error: null }); expect(await store.claimCampaignJobs()).toBeNull();
  });
  it("acknowledges only the matching lease and treats a lost acknowledgement as failure", async () => {
    const job = { id, voteId: id, lease: id, kind: "welcome" as const, attempts: 1, createdAt: created,
      firstName: "Ana", email: "ana@example.com", character: "sunny" as const, quantity: null };
    rpc.mockResolvedValue({ data: true, error: null }); expect(await store.finishCampaignJob(job, true, null)).toBe(true);
    expect(rpc).toHaveBeenCalledWith("finish_campaign_message", { p_id: id, p_lease: id, p_sent: true, p_failure: null });
    rpc.mockResolvedValue({ data: false, error: null }); expect(await store.finishCampaignJob(job, true, null)).toBe(false);
  });
  it("uses an indexed stable cursor, a 50-row limit and SQL aggregates", async () => {
    queryAnswer = { data: [row()], error: null };
    rpc.mockResolvedValue({ data: { votes: 100000, reservations: 10, pendingEmails: 2, failedEmails: 0, groups: [] }, error: null });
    const result = await store.campaignAdminData(`${created}|${id}`);
    expect(result?.summary.votes).toBe(100000);
    expect(calls).toContainEqual({ method: "limit", args: [50] });
    expect(calls).toContainEqual({ method: "or", args: [`created_at.lt."${created}",and(created_at.eq."${created}",id.lt.${id})`] });
    expect(rpc).toHaveBeenCalledWith("campaign_summary");
    rpc.mockResolvedValue({ data: {}, error: null }); expect(await store.campaignAdminData()).toBeNull();
  });
});

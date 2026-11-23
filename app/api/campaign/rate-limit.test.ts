import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeReceipt } from "@/lib/campaign-token";
import { campaignLimit } from "@/lib/campaign-http";
import { POST as vote } from "@/app/api/campaign/vote/route";
import { POST as receipt } from "@/app/api/campaign/receipt/route";
import { POST as kit } from "@/app/api/campaign/kit/route";
import { POST as reserve } from "@/app/api/campaign/reserve/route";

// Keep rateLimit and memoryLimit real. Only external storage and delivery are fixtures.
const fixture = vi.hoisted(() => ({ shared: false, rpc: vi.fn(), save: vi.fn(), lookup: vi.fn(), deliver: vi.fn(), ready: vi.fn(), kit: vi.fn(), reserve: vi.fn() }));
vi.mock("@/lib/supabase", () => ({
  get supabase() { return fixture.shared ? { rpc: fixture.rpc } : null; },
  get usingServiceRole() { return fixture.shared; },
}));
vi.mock("@/lib/campaign-store", () => ({
  campaignReady: () => fixture.ready(), saveVote: (...args: unknown[]) => fixture.save(...args),
  getCampaignVote: (...args: unknown[]) => fixture.lookup(...args), campaignKitUrl: () => fixture.kit(),
  reserveCopy: (...args: unknown[]) => fixture.reserve(...args),
}));
vi.mock("@/lib/campaign-delivery", () => ({ deliverCampaignMessages: (...args: unknown[]) => fixture.deliver(...args) }));
vi.mock("@/lib/stripe", () => ({ isStripeTestMode: () => true }));

const HOUR_MS = 60 * 60_000;
let sequence = 0;
let network = 0;
let ip: string;
const id = () => `abcdefab-0000-4000-8000-${String(++sequence).padStart(12, "0")}`;
const signed = (voteId: string) => makeReceipt(voteId, new Date().toISOString())!;
const request = (body: unknown, address = ip) => new NextRequest("https://books.example/api/campaign/vote", {
  method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": address }, body: JSON.stringify(body),
});
const input = (submissionId: string) => ({ submissionId, character: "sunny", firstName: "Ana", email: `${submissionId}@example.com`, adultConsent: true });
const actions = [
  { name: "vote", post: vote, body: (voteId: string) => input(voteId) },
  { name: "receipt", post: receipt, body: (voteId: string) => ({ receipt: signed(voteId) }) },
  { name: "kit", post: kit, body: (voteId: string) => ({ receipt: signed(voteId) }) },
  { name: "reserve", post: reserve, body: (voteId: string) => ({ receipt: signed(voteId), quantity: 2 }) },
];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-23T12:00:00Z"));
  vi.stubEnv("CAMPAIGN_SECRET", "campaign-test-".repeat(4));
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "dummy-service-role-key");
  ip = `198.51.100.${++network}`;
  fixture.shared = false;
  fixture.rpc.mockReset().mockImplementation(() => ({ abortSignal: async () => ({ data: [{ allowed: true, retry_after: 0 }], error: null }) }));
  fixture.save.mockReset().mockImplementation(async ({ submissionId }: { submissionId: string }) => ({ status: "saved", id: submissionId, receipt: signed(submissionId) }));
  fixture.lookup.mockReset().mockImplementation(async (voteId: string) => ({ id: voteId, firstName: "Ana", character: "sunny", quantity: null, revoked: false }));
  fixture.deliver.mockReset().mockResolvedValue({ ok: true });
  fixture.ready.mockReset().mockResolvedValue(true);
  fixture.kit.mockReset().mockResolvedValue("https://storage.example/kit");
  fixture.reserve.mockReset().mockResolvedValue({ status: "saved", quantity: 2 });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("campaign event rate limits with real memoryLimit", () => {
  it.each(actions)("allows 600 distinct families on one IP for $name, then rejects family 601", async ({ post, body }) => {
    for (let family = 0; family < 600; family++) {
      expect((await post(request(body(id())))).status, `family ${family + 1}`).toBe(200);
    }
    const response = await post(request(body(id())));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("3600");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "Too many requests. Please try again later." });
    expect((await post(request(body(id()), "203.0.113.1"))).status).toBe(200);
    vi.advanceTimersByTime(HOUR_MS);
    expect((await post(request(body(id())))).status).toBe(200);
  });

  it.each(actions)("limits one $name subject to 20 per hour even when it changes IP", async ({ post, body }) => {
    const voteId = id();
    const payload = body(voteId);
    for (let attempt = 0; attempt < 20; attempt++) expect((await post(request(payload))).status).toBe(200);
    fixture.save.mockClear(); fixture.lookup.mockClear(); fixture.deliver.mockClear();
    fixture.ready.mockClear(); fixture.kit.mockClear(); fixture.reserve.mockClear();
    const response = await post(request(payload, "203.0.113.2"));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("3600");
    for (const operation of [fixture.save, fixture.lookup, fixture.deliver, fixture.ready, fixture.kit, fixture.reserve]) {
      expect(operation).not.toHaveBeenCalled();
    }
    expect((await post(request(body(id())))).status).toBe(200);
    vi.advanceTimersByTime(HOUR_MS - 1);
    const stillLimited = await post(request(payload));
    expect(stillLimited.status).toBe(429);
    expect(stillLimited.headers.get("retry-after")).toBe("1");
    vi.advanceTimersByTime(1);
    expect((await post(request(payload))).status).toBe(200);
  });

  it("gives each action an independent IP and subject budget during a full event flow", async () => {
    for (let family = 0; family < 100; family++) {
      const voteId = id();
      for (const { post, body } of actions) expect((await post(request(body(voteId)))).status).toBe(200);
    }
    const voteId = id();
    for (const { post, body } of actions) {
      for (let attempt = 0; attempt < 20; attempt++) expect((await post(request(body(voteId)))).status).toBe(200);
      expect((await post(request(body(voteId)))).status).toBe(429);
    }
  });

  it("counts uppercase and lowercase submission UUIDs together", async () => {
    const voteId = id();
    for (let attempt = 0; attempt < 20; attempt++) {
      expect((await vote(request(input(attempt % 2 ? voteId : voteId.toUpperCase())))).status).toBe(200);
    }
    expect((await vote(request(input(voteId)))).status).toBe(429);
  });

  it("counts newly signed receipts for the same vote together", async () => {
    const voteId = id();
    for (let attempt = 0; attempt < 20; attempt++) {
      expect((await kit(request({ receipt: signed(voteId) }))).status).toBe(200);
    }
    vi.advanceTimersByTime(1000);
    expect((await kit(request({ receipt: signed(voteId) }))).status).toBe(429);
  });

  it.each([undefined, null, {}, "forged"])("counts invalid receipt %j against the IP without grouping unrelated families", async (invalid) => {
    for (let attempt = 0; attempt < 600; attempt++) expect((await kit(request({ receipt: invalid }))).status).toBe(404);
    expect((await kit(request({ receipt: invalid }))).status).toBe(429);
    expect(fixture.lookup).not.toHaveBeenCalled();
    expect(fixture.kit).not.toHaveBeenCalled();
  });

  it("does not let forged receipts consume a legitimate vote's subject budget", async () => {
    const valid = signed(id());
    const forged = valid.slice(0, -1) + "!";
    for (let attempt = 0; attempt < 20; attempt++) expect((await kit(request({ receipt: forged }))).status).toBe(404);
    for (let attempt = 0; attempt < 20; attempt++) expect((await kit(request({ receipt: valid }))).status).toBe(200);
    expect((await kit(request({ receipt: valid }))).status).toBe(429);
  });

  it("preserves the existing 60 per hour admin limit", async () => {
    for (let attempt = 0; attempt < 60; attempt++) expect(await campaignLimit(request({}), "admin")).toBeNull();
    expect((await campaignLimit(request({}), "admin"))?.status).toBe(429);
  });

  it.each([1, 2])("fails closed when shared limiter check %i is unavailable", async (check) => {
    fixture.shared = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    if (check === 2) fixture.rpc.mockImplementationOnce(() => ({ abortSignal: async () => ({ data: [{ allowed: true, retry_after: 0 }], error: null }) }));
    fixture.rpc.mockImplementation(() => ({ abortSignal: async () => { throw new Error("shared store unavailable"); } }));
    const response = await vote(request(input(id())));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("30");
    expect(fixture.rpc).toHaveBeenCalledTimes(check);
    expect(fixture.save).not.toHaveBeenCalled();
    expect(fixture.ready).not.toHaveBeenCalled();
    expect(fixture.deliver).not.toHaveBeenCalled();
  });

  it("honors shared subject denial even when the local counter has room", async () => {
    fixture.shared = true;
    fixture.rpc.mockImplementationOnce(() => ({ abortSignal: async () => ({ data: [{ allowed: true, retry_after: 0 }], error: null }) }));
    fixture.rpc.mockImplementation(() => ({ abortSignal: async () => ({ data: [{ allowed: false, retry_after: 42 }], error: null }) }));
    const response = await kit(request({ receipt: signed(id()) }));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("42");
    expect(fixture.rpc).toHaveBeenCalledTimes(2);
    expect(fixture.lookup).not.toHaveBeenCalled();
    expect(fixture.kit).not.toHaveBeenCalled();
  });
});

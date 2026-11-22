import { NextRequest } from "next/server";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
let signedIn = false; let allowed = true;
const read = vi.fn(); const retry = vi.fn(); const deliver = vi.fn();
vi.mock("@/lib/admin-auth", () => ({ ADMIN_COOKIE: "admin", adminConfigured: () => true, isAdminCookie: () => signedIn }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => ({ ok: allowed, retryAfter: 30 }), clientIp: () => "test-ip" }));
vi.mock("@/lib/campaign-store", () => ({ campaignAdminData: (...a: unknown[]) => read(...a), retryCampaignMessages: (...a: unknown[]) => retry(...a) }));
vi.mock("@/lib/campaign-delivery", () => ({ deliverCampaignMessages: (...a: unknown[]) => deliver(...a) }));
const { GET, POST } = await import("./route");
const id = "00000000-0000-4000-8000-000000000001";
beforeEach(() => {
  signedIn = false; allowed = true; read.mockReset().mockResolvedValue({ rows: [], summary: {} });
  retry.mockReset().mockResolvedValue("reset"); deliver.mockReset().mockResolvedValue({ ok: true, accepted: 1, pending: 0 });
});
afterEach(() => { vi.restoreAllMocks(); });
const request = (body: unknown = { voteId: id }, headers = {}) => new NextRequest("https://books.example/api/admin/campaign", {
  method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body),
});
describe("campaign admin API A01-A03", () => {
  it("denies anonymous JSON, CSV and retry before reading or changing records", async () => {
    for (const url of ["https://books.example/api/admin/campaign", "https://books.example/api/admin/campaign?format=csv"]) expect((await GET(new NextRequest(url))).status).toBe(401);
    expect((await POST(request())).status).toBe(401); expect(read).not.toHaveBeenCalled(); expect(retry).not.toHaveBeenCalled(); expect(deliver).not.toHaveBeenCalled();
  });
  it("exports only the current authenticated bounded page with private response headers", async () => {
    signedIn = true;
    const response = await GET(new NextRequest("https://books.example/api/admin/campaign?format=csv&before=cursor"));
    expect(response.status).toBe(200); expect(read).toHaveBeenCalledWith("cursor");
    expect(response.headers.get("cache-control")).toBe("no-store"); expect(response.headers.get("content-type")).toContain("text/csv");
    expect(await response.text()).toContain('"Parent","Email"');
  });
  it("shows storage errors as unavailable rather than an empty successful export", async () => {
    signedIn = true; read.mockResolvedValue(null); expect((await GET(new NextRequest("https://books.example/api/admin/campaign?format=csv"))).status).toBe(503);
  });
  it("enforces the admin rate limit before accessing records", async () => {
    signedIn = true; allowed = false; expect((await POST(request())).status).toBe(429); expect(retry).not.toHaveBeenCalled();
  });
  it("requires same-origin bounded JSON and a real UUID for retry", async () => {
    signedIn = true;
    expect((await POST(request({ voteId: "bad" }))).status).toBe(400);
    expect((await POST(request(undefined, { origin: "https://evil.example" }))).status).toBe(403);
    expect((await POST(request(undefined, { "content-type": "text/plain" }))).status).toBe(415);
    expect(retry).not.toHaveBeenCalled();
  });
  it("resets queued work and reports only actual provider acceptance", async () => {
    signedIn = true; const response = await POST(request());
    expect(response.status).toBe(200); expect(retry).toHaveBeenCalledWith(id); expect(deliver).toHaveBeenCalledWith(id);
    expect((await response.json()).message).toContain("accepted by the email provider");
    deliver.mockResolvedValue({ ok: false, accepted: 0 }); expect((await (await POST(request())).json()).message).toContain("still pending");
  });
  it("does not send sent/busy work or claim to retry a failed database reset", async () => {
    signedIn = true; retry.mockResolvedValue("busy"); expect((await POST(request())).status).toBe(409);
    retry.mockResolvedValue("unavailable"); expect((await POST(request())).status).toBe(503); expect(deliver).not.toHaveBeenCalled();
  });
});

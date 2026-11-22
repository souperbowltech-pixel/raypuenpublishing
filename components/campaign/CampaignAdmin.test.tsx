import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CampaignVote } from "@/lib/campaign-store";
let signedIn = false; const read = vi.fn();
vi.mock("next/headers", () => ({ cookies: () => ({ get: () => ({ value: "cookie" }) }) }));
vi.mock("@/lib/admin-auth", () => ({ ADMIN_COOKIE: "admin", adminConfigured: () => true, isAdminCookie: () => signedIn }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
vi.mock("@/lib/campaign-store", () => ({ CAMPAIGN_PAGE_SIZE: 50, campaignAdminData: (...a: unknown[]) => read(...a) }));
const { default: Page } = await import("@/app/admin/campaign/page");
const { campaignCsv, deliveryLabel } = await import("@/lib/campaign-admin");
const row: CampaignVote = { id: "00000000-0000-4000-8000-000000000001", createdAt: "2026-11-22T00:00:00Z", character: "sunny",
  firstName: "Ana", email: "ana@example.com", source: "fiesta", phone: null, answer: "<script>alert(1)</script>",
  marketingConsent: false, smsConsent: false, quantity: 2, revoked: false, deliveries: [{ kind: "welcome", sent: false, attempts: 5, failure: "timeout", busy: false }] };
const summary = { votes: 1000, reservations: 1, pendingEmails: 1, failedEmails: 1, groups: [{ character: "sunny", source: "fiesta", votes: 1000 }] };
beforeEach(() => { signedIn = false; read.mockReset().mockResolvedValue({ rows: [row], summary }); });
describe("campaign owner page", () => {
  it("reads no personal records before admin sign-in", async () => {
    const html = renderToStaticMarkup(await Page({ searchParams: {} })); expect(read).not.toHaveBeenCalled(); expect(html).not.toContain(row.email); expect(html).toContain("sign in");
  });
  it("renders counts, source, consent and unpaid reservations while escaping answer HTML", async () => {
    signedIn = true; const html = renderToStaticMarkup(await Page({ searchParams: {} }));
    expect(html).toContain("1000"); expect(html).toContain("Sunny / fiesta"); expect(html).toContain("Not a paid order");
    expect(html).toContain("Needs attention: timeout"); expect(html).toContain("Retry Unsent Email"); expect(html).toContain("&lt;script&gt;"); expect(html).not.toContain("<script>alert");
  });
  it("shows read failures explicitly, not a fabricated empty campaign", async () => {
    signedIn = true; read.mockResolvedValue(null); expect(renderToStaticMarkup(await Page({ searchParams: {} }))).toContain("could not be loaded");
  });
  it("labels withdrawn votes and suppresses their email retry control", async () => {
    signedIn = true; read.mockResolvedValue({ rows: [{ ...row, revoked: true }], summary });
    const html = renderToStaticMarkup(await Page({ searchParams: {} }));
    expect(html).toContain("Withdrawn"); expect(html).not.toContain("Retry Unsent Email");
  });
  it("preserves the current cursor in page exports and offers stable older records", async () => {
    signedIn = true; read.mockResolvedValue({ rows: Array.from({ length: 50 }, (_, i) => ({ ...row, id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}` })), summary });
    const cursor = `${row.createdAt}|${row.id}`;
    const html = renderToStaticMarkup(await Page({ searchParams: { before: cursor } }));
    expect(read).toHaveBeenCalledWith(cursor); expect(html).toContain("Older Records"); expect(html).toContain("Back to Newest"); expect(html).toContain(encodeURIComponent(cursor));
  });
  it("quotes CSV cells, neutralizes formulas and excludes any extra private fields", () => {
    const csv = campaignCsv([{ ...row, firstName: "=DANGEROUS()", answer: ' \t+CMD,"quoted"', phone: "+15551234567", receipt: "private-capability" } as CampaignVote]);
    expect(csv).toContain('"\'=DANGEROUS()"'); expect(csv).toContain('"\' \t+CMD,""quoted"""'); expect(csv).toContain('"\'+15551234567"');
    expect(csv).not.toContain("private-capability");
  });
  it("distinguishes accepted, queued, actively sending and exhausted deliveries", () => {
    expect(deliveryLabel(row, "welcome")).toContain("Needs attention"); expect(deliveryLabel(row, "reservation")).toBe("Not requested");
    expect(deliveryLabel({ ...row, deliveries: [{ ...row.deliveries[0], sent: true }] }, "welcome")).toBe("Accepted by email provider");
    expect(deliveryLabel({ ...row, deliveries: [{ ...row.deliveries[0], busy: true }] }, "welcome")).toBe("Sending");
    expect(deliveryLabel({ ...row, deliveries: [{ ...row.deliveries[0], attempts: 1 }] }, "welcome")).toContain("Queued");
  });
});

import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

/** Every page this route shows Ray leads back to /admin, so he is never left on a dead end. */

const reviewGuideApproval = vi.fn();
vi.mock("@/lib/patrol-store", () => ({ reviewGuideApproval: (...a: unknown[]) => reviewGuideApproval(...a) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: () => ({ ok: true, retryAfter: 0 }), clientIp: () => "127.0.0.1" }));

const { GET, POST } = await import("./route");

const post = (fields: Record<string, string>) => {
  const body = new URLSearchParams(fields).toString();
  return POST(
    new NextRequest("http://localhost/api/admin/approve-guide", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    })
  );
};

describe("/api/admin/approve-guide pages", () => {
  it("leads back to approvals after an approval", async () => {
    reviewGuideApproval.mockResolvedValueOnce({ ok: true, status: "approved" });
    const html = await (await post({ token: "tok", action: "approve" })).text();
    expect(html).toContain("<h1>Approved</h1>");
    expect(html).toContain('href="/admin">Back to approvals</a>');
  });

  it("leads back after a decline, a failure, and from the email's question page", async () => {
    reviewGuideApproval.mockResolvedValueOnce({ ok: true, status: "rejected" });
    expect(await (await post({ token: "tok", action: "reject" })).text()).toContain("Back to approvals");
    reviewGuideApproval.mockResolvedValueOnce({ ok: false, error: "Already decided." });
    expect(await (await post({ token: "tok", action: "approve" })).text()).toContain("Back to approvals");
    const ask = await GET(new NextRequest("http://localhost/api/admin/approve-guide?token=tok&action=approve"));
    expect(await ask.text()).toContain("Back to approvals");
  });

  it("titles its pages without a dash", async () => {
    const ask = await GET(new NextRequest("http://localhost/api/admin/approve-guide?token=tok"));
    expect(await ask.text()).toContain("| Puen Publishing</title>");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  row: { id: "claim-1", approval_token: "AP-test-private", status: "pending", reviewed_at: null as string | null },
  fail: false,
  submitting: false,
  requests: [] as { method: string; url: URL }[],
}));

// Use the real PostgREST client and store function; fake only the HTTP boundary.
vi.mock("@/lib/supabase", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  return {
    isProduction: true,
    supabase: createClient("https://database.example.com", "test-anon-key", {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: {
        fetch: async (input, init) => {
          const url = new URL(String(input));
          const method = init?.method || "GET";
          fixture.requests.push({ method, url });
          if (fixture.fail) return new Response(JSON.stringify({ message: "Database update failed" }), { status: 400 });
          if (fixture.submitting) {
            const table = url.pathname.split("/").pop();
            if (table === "patrol_leaders") {
              return new Response(JSON.stringify(method === "GET" ? [{
                id: "leader-1", email: "leader@example.com", token: "PT-test", gifts_redeemed_count: 3,
                status: "completed", created_at: "2026-11-23T00:00:00Z", updated_at: "2026-11-23T00:00:00Z",
              }] : null));
            }
            if (method === "POST") {
              Object.assign(fixture.row, JSON.parse(String(init?.body)));
              return new Response(JSON.stringify({ id: fixture.row.id }));
            }
            return new Response(JSON.stringify([]));
          }
          const matches = [...url.searchParams.entries()].every(([key, value]) => {
            if (key === "approval_token") return value === `eq.${fixture.row.approval_token}`;
            if (key === "status") return value === `eq.${fixture.row.status}`;
            return true;
          });
          if (method === "PATCH" && matches) Object.assign(fixture.row, JSON.parse(String(init?.body)));
          const headers = new Headers(init?.headers);
          const single = headers.get("accept")?.includes("vnd.pgrst.object");
          return new Response(JSON.stringify(single ? (matches ? fixture.row : null) : (matches ? [fixture.row] : [])), {
            status: 200, headers: { "content-type": "application/json" },
          });
        },
      },
    }),
  };
});
vi.mock("@/lib/alerts", () => ({ alertFailure: vi.fn() }));
vi.mock("@/lib/notifications", () => ({ sendGuideApprovalRequest: vi.fn() }));
import { alertFailure } from "@/lib/alerts";
import { sendGuideApprovalRequest } from "@/lib/notifications";
import { reviewGuideApproval, submitGuideClaim } from "@/lib/patrol-store";

beforeEach(() => {
  fixture.row = { id: "claim-1", approval_token: "AP-test-private", status: "pending", reviewed_at: null };
  fixture.fail = false;
  fixture.submitting = false;
  fixture.requests = [];
  vi.clearAllMocks();
});

describe("Guide approval database transitions", () => {
  it.each([
    ["approve", "approve", "approved"],
    ["approve", "reject", "approved"],
    ["reject", "approve", "rejected"],
    ["reject", "reject", "rejected"],
  ] as const)("atomically keeps %s final after %s", async (first, second, status) => {
    expect(await reviewGuideApproval(fixture.row.approval_token, first)).toEqual({ ok: true, status });
    const reviewedAt = fixture.row.reviewed_at;
    expect((await reviewGuideApproval(fixture.row.approval_token, second)).ok).toBe(false);
    expect(fixture.row.status).toBe(status);
    expect(fixture.row.reviewed_at).toBe(reviewedAt);
    expect(fixture.requests).toHaveLength(2);
    for (const request of fixture.requests) {
      expect(request.method).toBe("PATCH");
      expect(request.url.searchParams.get("status")).toBe("eq.pending");
      expect(request.url.searchParams.get("approval_token")).toBe(`eq.${fixture.row.approval_token}`);
    }
  });

  it("allows only one of two competing decisions to succeed", async () => {
    const results = await Promise.all([
      reviewGuideApproval(fixture.row.approval_token, "approve"),
      reviewGuideApproval(fixture.row.approval_token, "reject"),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(fixture.row.status).toBe(results.find((result) => result.ok)!.status);
  });

  it("rejects an unknown token without changing a pending claim", async () => {
    expect((await reviewGuideApproval("AP-unknown", "approve")).ok).toBe(false);
    expect(fixture.row.status).toBe("pending");
  });

  it("reports a database failure without changing the claim", async () => {
    fixture.fail = true;
    expect((await reviewGuideApproval(fixture.row.approval_token, "approve")).ok).toBe(false);
    expect(fixture.row.status).toBe("pending");
  });

  it("uses the inserted database claim id in a safe email failure alert", async () => {
    fixture.submitting = true;
    vi.mocked(sendGuideApprovalRequest).mockResolvedValue({ sent: false, reason: "rejected" });
    const address = { recipient: "Test Parent", street: "123 Test St", city: "Test City", state: "CA", zip: "92399" };
    const result = await submitGuideClaim("PT-test", address.recipient, address);
    expect(result.ok).toBe(true);
    expect(result.approvalToken).toBe(fixture.row.approval_token);
    const detail = vi.mocked(alertFailure).mock.calls[0][1];
    expect(JSON.stringify(detail)).not.toContain(result.approvalToken!);
    expect(detail).toEqual({ claimId: "claim-1", reason: "rejected" });
    expect(fixture.requests.find((request) => request.method === "POST")!.url.searchParams.get("select")).toBe("id");
    expect(sendGuideApprovalRequest).toHaveBeenCalledWith({
      patrolLeaderEmail: "leader@example.com", recipientName: address.recipient,
      shippingAddress: address, approvalToken: result.approvalToken,
    });
  });
});

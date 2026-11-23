import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase", () => ({ supabase: null, isProduction: false }));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => ({ ok: true, retryAfter: 0 }),
  clientIp: () => "127.0.0.1",
}));
vi.mock("@/lib/alerts", () => ({ alertFailure: vi.fn() }));
vi.mock("@/lib/notifications", () => ({ sendGuideApprovalRequest: vi.fn() }));

import { alertFailure } from "@/lib/alerts";
import { sendGuideApprovalRequest } from "@/lib/notifications";
import {
  createPatrolLeader,
  getPatrolLeaderByToken,
  redeemPatrolGift,
  reviewGuideApproval,
  submitGuideClaim,
} from "@/lib/patrol-store";
import { GET as state } from "@/app/api/patrol/state/route";
import { POST as claim } from "@/app/api/patrol/claim/route";
import { GET as ask, POST as decide } from "@/app/api/admin/approve-guide/route";

const address = { recipient: "Test Parent", street: "123 Test St", city: "Test City", state: "CA", zip: "92399" };

async function completedPatrol() {
  const patrol = await createPatrolLeader("leader@example.com", "cs_test_private");
  expect(patrol).not.toBeNull();
  for (const [i, code] of patrol!.giftCodes.entries()) {
    expect((await redeemPatrolGift(code, `private-family-${i}`)).ok).toBe(true);
  }
  return patrol!;
}

async function pendingClaim() {
  const patrol = await completedPatrol();
  const result = await submitGuideClaim(patrol.token, address.recipient, address);
  expect(result.ok).toBe(true);
  expect(result.approvalToken).toBeDefined();
  return { patrol, token: result.approvalToken! };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(sendGuideApprovalRequest).mockResolvedValue({ sent: true, id: "test-email" });
});

describe("Patrol public responses", () => {
  it("returns only dashboard fields and never serializes the approval credential", async () => {
    const { patrol, token } = await pendingClaim();
    const response = await state(new NextRequest(`http://localhost/api/patrol/state?token=${patrol.token}`));
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toContain("approvalToken");
    expect(text).not.toContain(token);
    expect(JSON.parse(text)).toEqual({
      success: true,
      leader: { email: "leader@example.com", giftsRedeemedCount: 3, status: "claimed" },
      gifts: patrol.giftCodes.map((code, i) => ({ code, slotNumber: i + 1, redeemedAt: expect.any(String) })),
      approval: { status: "pending", recipientName: address.recipient },
    });
  });

  it("returns usable state without an approval, and handles missing or unknown tokens", async () => {
    const patrol = await completedPatrol();
    const response = await state(new NextRequest(`http://localhost/api/patrol/state?token=${patrol.token}`));
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.leader.status).toBe("completed");
    expect(body.approval).toBeUndefined();
    expect((await state(new NextRequest("http://localhost/api/patrol/state"))).status).toBe(400);
    expect((await state(new NextRequest("http://localhost/api/patrol/state?token=unknown"))).status).toBe(404);
  });

  it("keeps both first and repeated claim responses free of approval credentials", async () => {
    const patrol = await completedPatrol();
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await claim(new NextRequest("http://localhost/api/patrol/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ patrolToken: patrol.token, recipientName: address.recipient, ...address }),
      }));
      expect(response.status).toBe(200);
      const text = await response.text();
      const details = await getPatrolLeaderByToken(patrol.token);
      expect(text).not.toContain("approvalToken");
      expect(text).not.toContain(details!.approval!.approvalToken);
      expect(Object.keys(JSON.parse(text)).sort()).toEqual(["message", "success"]);
    }
    expect(sendGuideApprovalRequest).toHaveBeenCalledTimes(1);
  });
});

describe("Guide decisions are final", () => {
  it.each([
    ["approve", "approve", "approved"],
    ["approve", "reject", "approved"],
    ["reject", "approve", "rejected"],
    ["reject", "reject", "rejected"],
  ] as const)("keeps %s final when followed by %s", async (first, second, status) => {
    const { patrol, token } = await pendingClaim();
    expect(await reviewGuideApproval(token, first)).toEqual({ ok: true, status });
    const original = (await getPatrolLeaderByToken(patrol.token))!.approval!;
    expect((await reviewGuideApproval(token, second)).ok).toBe(false);
    expect((await getPatrolLeaderByToken(patrol.token))!.approval).toEqual(original);
  });

  it("keeps the emailed confirmation link and admin form buttons working with the real store", async () => {
    const { patrol, token } = await pendingClaim();
    expect(vi.mocked(sendGuideApprovalRequest).mock.calls[0][0].approvalToken).toBe(token);
    const question = await ask(new NextRequest(`http://localhost/api/admin/approve-guide?token=${token}&action=approve`));
    expect(await question.text()).toContain(`name="token" value="${token}"`);
    expect((await getPatrolLeaderByToken(patrol.token))!.approval!.status).toBe("pending");
    const post = (action: string) => decide(new NextRequest("http://localhost/api/admin/approve-guide", {
      method: "POST",
      body: new URLSearchParams({ token, action }),
    }));
    expect((await post("approve")).status).toBe(200);
    expect((await post("reject")).status).toBe(400);
    expect((await getPatrolLeaderByToken(patrol.token))!.approval!.status).toBe("approved");
  });
});

describe("Guide email failure alerts", () => {
  it.each(["not-configured", "invalid-recipient", "timeout", "rejected", "error"] as const)("logs only the claim id and failure category for %s", async (reason) => {
    vi.mocked(sendGuideApprovalRequest).mockResolvedValue({ sent: false, reason });
    const { patrol, token } = await pendingClaim();
    const approval = (await getPatrolLeaderByToken(patrol.token))!.approval!;
    expect(alertFailure).toHaveBeenCalledTimes(1);
    const detail = vi.mocked(alertFailure).mock.calls[0][1];
    const text = JSON.stringify(detail);
    expect(text).not.toContain(token);
    expect(text).not.toContain(address.recipient);
    expect(text).not.toContain(address.street);
    expect(text).not.toContain("leader@example.com");
    expect(detail).toEqual({ claimId: approval.id, reason });
  });
});

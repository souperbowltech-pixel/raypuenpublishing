import { describe, it, expect, beforeEach } from "vitest";
import {
  createPatrolLeader,
  getPatrolLeaderByToken,
  getPatrolTokenBySession,
  redeemPatrolGift,
  submitGuideClaim,
  reviewGuideApproval,
  generateGiftCodes,
} from "./patrol-store";
import { PARENTS_GUIDE_DIGITAL_PRICE, PATROL_BUNDLE_PRICE } from "./pricing";

describe("Parent's Guide & Patrol Funnel (t12–t15)", () => {
  it("verifies pricing constants for Parent Guide and Patrol", () => {
    expect(PARENTS_GUIDE_DIGITAL_PRICE).toBe(29.97);
    expect(PATROL_BUNDLE_PRICE).toBe(10.0);
  });

  it("generates 3 unique gift codes formatted with GP- prefix", () => {
    const codes = generateGiftCodes("PT-TEST-TOKEN");
    expect(codes).toHaveLength(3);
    expect(codes[0]).toMatch(/^GP-[2-9A-HJ-KM-NP-Z]{6}-1$/);
    expect(codes[1]).toMatch(/^GP-[2-9A-HJ-KM-NP-Z]{6}-2$/);
    expect(codes[2]).toMatch(/^GP-[2-9A-HJ-KM-NP-Z]{6}-3$/);
    expect(new Set(codes).size).toBe(3);
  });

  it("creates a patrol leader with 3 gift slots in in_progress state", async () => {
    const email = `patrol-leader-${Date.now()}@example.com`;
    const res = await createPatrolLeader(email, "cs_test_123");
    expect(res).not.toBeNull();
    if (!res) return;

    expect(res.leader.email).toBe(email);
    expect(res.leader.status).toBe("in_progress");
    expect(res.leader.giftsRedeemedCount).toBe(0);
    expect(res.giftCodes).toHaveLength(3);

    const details = await getPatrolLeaderByToken(res.token);
    expect(details).not.toBeNull();
    expect(details?.gifts).toHaveLength(3);
  });

  it("tracks 3 gift redemptions, advances to completed, and blocks premature claims", async () => {
    const email = `patrol-flow-${Date.now()}@example.com`;
    const res = await createPatrolLeader(email);
    expect(res).not.toBeNull();
    if (!res) return;

    const [code1, code2, code3] = res.giftCodes;

    // Premature claim should fail
    const earlyClaim = await submitGuideClaim(res.token, "Parent Name", {
      recipient: "Parent Name",
      street: "123 Test St",
      city: "Yucaipa",
      state: "CA",
      zip: "92399",
    });
    expect(earlyClaim.ok).toBe(false);

    // Redeem gift 1
    const red1 = await redeemPatrolGift(code1, "family-1");
    expect(red1.ok).toBe(true);

    // Double redemption should fail
    const red1Dup = await redeemPatrolGift(code1, "family-1-dup");
    expect(red1Dup.ok).toBe(false);

    let details = await getPatrolLeaderByToken(res.token);
    expect(details?.leader.giftsRedeemedCount).toBe(1);
    expect(details?.leader.status).toBe("in_progress");

    // Redeem gift 2
    const red2 = await redeemPatrolGift(code2, "family-2");
    expect(red2.ok).toBe(true);
    details = await getPatrolLeaderByToken(res.token);
    expect(details?.leader.giftsRedeemedCount).toBe(2);

    // Redeem gift 3
    const red3 = await redeemPatrolGift(code3, "family-3");
    expect(red3.ok).toBe(true);
    details = await getPatrolLeaderByToken(res.token);
    expect(details?.leader.giftsRedeemedCount).toBe(3);
    expect(details?.leader.status).toBe("completed");

    // Now claim should succeed
    const claim = await submitGuideClaim(res.token, "Parent Name", {
      recipient: "Parent Name",
      street: "123 Test St",
      city: "Yucaipa",
      state: "CA",
      zip: "92399",
    });
    expect(claim.ok).toBe(true);
    expect(claim.approvalToken).toBeDefined();

    // Verify Ray's One-Click Approval Gate
    const approvalToken = claim.approvalToken!;
    const approvalRes = await reviewGuideApproval(approvalToken, "approve");
    expect(approvalRes.ok).toBe(true);
    expect(approvalRes.status).toBe("approved");

    const updatedDetails = await getPatrolLeaderByToken(res.token);
    expect(updatedDetails?.approval?.status).toBe("approved");
  });

  it("handles rejection in Ray's approval gate", async () => {
    const email = `patrol-reject-${Date.now()}@example.com`;
    const res = await createPatrolLeader(email);
    if (!res) return;

    for (const code of res.giftCodes) {
      await redeemPatrolGift(code, `fam-${Math.random()}`);
    }

    const claim = await submitGuideClaim(res.token, "Reject Test", {
      recipient: "Reject Test",
      street: "456 Oak St",
      city: "Redlands",
      state: "CA",
      zip: "92373",
    });
    expect(claim.ok).toBe(true);

    const rej = await reviewGuideApproval(claim.approvalToken!, "reject");
    expect(rej.ok).toBe(true);
    expect(rej.status).toBe("rejected");
  });
});

describe("a paid Patrol can be found from its Stripe session", () => {
  it("returns the token that was created for that session", async () => {
    const sessionId = `cs_test_delivery_${Date.now()}`;
    const created = await createPatrolLeader(`delivery-${Date.now()}@example.com`, sessionId);
    expect(created).not.toBeNull();

    const token = await getPatrolTokenBySession(sessionId);
    expect(token).toBe(created!.token);
  });

  it("returns null for a session that has no patrol, rather than guessing", async () => {
    expect(await getPatrolTokenBySession(`cs_test_never_paid_${Date.now()}`)).toBeNull();
  });

  it("returns null for an empty session id", async () => {
    expect(await getPatrolTokenBySession("")).toBeNull();
  });

  it("does not hand back one buyer's token for another buyer's session", async () => {
    const a = `cs_test_a_${Date.now()}`;
    const b = `cs_test_b_${Date.now()}`;
    const leaderA = await createPatrolLeader(`a-${Date.now()}@example.com`, a);
    const leaderB = await createPatrolLeader(`b-${Date.now()}@example.com`, b);

    expect(await getPatrolTokenBySession(a)).toBe(leaderA!.token);
    expect(await getPatrolTokenBySession(b)).toBe(leaderB!.token);
    expect(leaderA!.token).not.toBe(leaderB!.token);
  });
});

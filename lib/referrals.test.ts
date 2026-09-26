import { describe, it, expect, beforeEach } from "vitest";
import { registerFamily } from "./family-store";
import {
  getOrCreateScoutLocal,
  updateScoutLocal,
  recomputeReferrerProgress,
  deriveScoutFields,
} from "./scout-store";
import { REFERRAL_FRIEND_REQUIREMENT, REFERRAL_INVITE_CAPACITY } from "./gamification";

describe("Real Friend Referral Tracking (t16)", () => {
  beforeEach(() => {
    // Clean in-memory state before each test
  });

  it("links referred family to referrer and updates referrer on Page 1 completion", async () => {
    // 1. Register Referrer (Child A)
    const referrerEmail = `referrer-${Date.now()}@example.com`;
    const regA = await registerFamily(referrerEmail, "Alice");
    expect(regA.ok).toBe(true);
    if (!regA.ok) return;

    const scoutTokenA = regA.session.scoutToken;
    const shareCodeA = regA.session.shareCode;

    // Alice passes academic quiz (400 points)
    const scoutA = updateScoutLocal(scoutTokenA, { quizScore: 400 });
    expect(scoutA.quizScore).toBe(400);
    expect(scoutA.friendsCompleted).toBe(0);
    expect(scoutA.referralScore).toBe(0);
    expect(scoutA.status).toBe("Academic_Pass");
    expect(scoutA.book2Unlocked).toBe(false);

    // 2. Friend 1 (Bob) registers using Alice's shareCode
    const friend1Email = `bob-${Date.now()}@example.com`;
    const regB = await registerFamily(friend1Email, "Bob", shareCodeA);
    expect(regB.ok).toBe(true);
    if (!regB.ok) return;

    const scoutTokenB = regB.session.scoutToken;
    const scoutB = getOrCreateScoutLocal(scoutTokenB);
    expect(scoutB.referredBy).toBe(scoutTokenA);

    // Bob colours Page 2 only — Alice's progress should remain 0
    updateScoutLocal(scoutTokenB, { completedPages: [2] });
    let currentA = getOrCreateScoutLocal(scoutTokenA);
    expect(currentA.friendsCompleted).toBe(0);

    // Bob colours Page 1 — Alice's friendsCompleted becomes 1
    updateScoutLocal(scoutTokenB, { completedPages: [1, 2] });
    currentA = getOrCreateScoutLocal(scoutTokenA);
    expect(currentA.friendsCompleted).toBe(1);
    expect(currentA.referralScore).toBe(0); // Needs 2 friends for 300 pts
    expect(currentA.book2Unlocked).toBe(false);

    // 3. Friend 2 (Charlie) registers using Alice's shareCode
    const friend2Email = `charlie-${Date.now()}@example.com`;
    const regC = await registerFamily(friend2Email, "Charlie", shareCodeA);
    expect(regC.ok).toBe(true);
    if (!regC.ok) return;

    const scoutTokenC = regC.session.scoutToken;

    // Charlie colours Page 1 — Alice's friendsCompleted reaches 2!
    updateScoutLocal(scoutTokenC, { completedPages: [1] });
    currentA = getOrCreateScoutLocal(scoutTokenA);
    expect(currentA.friendsCompleted).toBe(2);
    expect(currentA.referralScore).toBe(300);
    expect(currentA.totalScore).toBe(700);
    expect(currentA.status).toBe("Unlock_Volume_2");
    expect(currentA.book2Unlocked).toBe(true);
  });

  it("handles duplicate page 1 updates idempotently without over-counting", async () => {
    const referrerEmail = `ref-idempotent-${Date.now()}@example.com`;
    const regA = await registerFamily(referrerEmail, "David");
    expect(regA.ok).toBe(true);
    if (!regA.ok) return;

    const scoutTokenA = regA.session.scoutToken;
    const shareCodeA = regA.session.shareCode;

    const regB = await registerFamily(`friend-idem-${Date.now()}@example.com`, "Eve", shareCodeA);
    expect(regB.ok).toBe(true);
    if (!regB.ok) return;

    const scoutTokenB = regB.session.scoutToken;

    // Toggle page 1 multiple times
    updateScoutLocal(scoutTokenB, { completedPages: [1] });
    updateScoutLocal(scoutTokenB, { completedPages: [1, 3, 5] });
    updateScoutLocal(scoutTokenB, { completedPages: [1, 4] });

    const currentA = getOrCreateScoutLocal(scoutTokenA);
    expect(currentA.friendsCompleted).toBe(1);
  });

  it("clamps friendsCompleted at invite capacity", async () => {
    const referrerEmail = `ref-capacity-${Date.now()}@example.com`;
    const regA = await registerFamily(referrerEmail, "Frank");
    if (!regA.ok) return;

    const scoutTokenA = regA.session.scoutToken;
    const shareCodeA = regA.session.shareCode;

    // Register 4 friends who all colour page 1
    for (let i = 1; i <= 4; i++) {
      const regFriend = await registerFamily(`friend-${i}-${Date.now()}@example.com`, `Friend${i}`, shareCodeA);
      if (regFriend.ok) {
        updateScoutLocal(regFriend.session.scoutToken, { completedPages: [1] });
      }
    }

    const currentA = getOrCreateScoutLocal(scoutTokenA);
    expect(currentA.friendsCompleted).toBe(REFERRAL_INVITE_CAPACITY); // 3 max
    expect(currentA.friendsCompleted).toBeLessThanOrEqual(3);
  });

  it("safely ignores invalid or non-existent share codes without failing registration", async () => {
    const reg = await registerFamily(`invalid-ref-${Date.now()}@example.com`, "Grace", "GG-NONEXIST");
    expect(reg.ok).toBe(true);
    if (reg.ok) {
      const scout = getOrCreateScoutLocal(reg.session.scoutToken);
      expect(scout.referredBy).toBeUndefined();
    }
  });

  it("mutation check: deriveScoutFields gives 0 referral score if friendsCompleted < 2", () => {
    const base = {
      token: "MUTATION-CHECK",
      scoutName: "Tester",
      completedPages: [],
      quizScore: 400,
      friendsCompleted: 1,
      book3Sponsored: false,
      updatedAt: new Date().toISOString(),
    };

    const s1 = deriveScoutFields({ ...base, friendsCompleted: 1 });
    expect(s1.referralScore).toBe(0);
    expect(s1.book2Unlocked).toBe(false);

    const s2 = deriveScoutFields({ ...base, friendsCompleted: 2 });
    expect(s2.referralScore).toBe(300);
    expect(s2.book2Unlocked).toBe(true);
  });
});

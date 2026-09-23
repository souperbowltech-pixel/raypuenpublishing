import { describe, it, expect } from "vitest";
import { SPONSOR_TIERS, RETAIL_PRICE, formatCurrency } from "./pricing";

/**
 * These are the numbers real institutions are actually charged. A typo in a
 * flatPrice, or a tier that promises a free printed copy without asking where to
 * send it, is a money-and-goodwill bug that no type checker or linter would
 * catch — so every field of every tier is asserted explicitly.
 *
 * (This file previously tested a per-copy pricing model that no page used. That
 * model was removed on 2026-09-23; the coverage was moved to the live tiers.)
 */
describe("SPONSOR_TIERS — the amounts institutions are really charged", () => {
  it("charges exactly $40 / $200 / $400", () => {
    expect(SPONSOR_TIERS[1].flatPrice).toBe(40.0);
    expect(SPONSOR_TIERS[2].flatPrice).toBe(200.0);
    expect(SPONSOR_TIERS[3].flatPrice).toBe(400.0);
  });

  it("converts to whole cents for Stripe with no rounding drift", () => {
    // app/api/checkout/wholesale/route.ts charges Math.round(flatPrice * 100).
    expect(Math.round(SPONSOR_TIERS[1].flatPrice * 100)).toBe(4000);
    expect(Math.round(SPONSOR_TIERS[2].flatPrice * 100)).toBe(20000);
    expect(Math.round(SPONSOR_TIERS[3].flatPrice * 100)).toBe(40000);
  });

  it("sponsors the promised number of books at each tier", () => {
    expect(SPONSOR_TIERS[1].booksSponsored).toBe(10);
    expect(SPONSOR_TIERS[2].booksSponsored).toBe(48);
    expect(SPONSOR_TIERS[3].booksSponsored).toBe(100);
  });

  it("matches every tier 1:1, exactly as the portal promises", () => {
    for (const tier of Object.values(SPONSOR_TIERS)) {
      expect(tier.totalPrintedWithMatch).toBe(tier.booksSponsored * 2);
    }
  });

  it("only the two premium tiers include a free printed copy", () => {
    expect(SPONSOR_TIERS[1].isPremiumSponsor).toBe(false);
    expect(SPONSOR_TIERS[2].isPremiumSponsor).toBe(true);
    expect(SPONSOR_TIERS[3].isPremiumSponsor).toBe(true);
  });

  it("asks for a shipping address exactly when it owes someone a printed copy", () => {
    // If these two ever disagree we either ship to nowhere, or ask an
    // institution for an address we have no reason to hold.
    for (const tier of Object.values(SPONSOR_TIERS)) {
      expect(tier.requiresShipping).toBe(tier.isPremiumSponsor);
    }
  });

  it("keeps each tier's id matching its key, so the wrong tier can't be charged", () => {
    for (const [key, tier] of Object.entries(SPONSOR_TIERS)) {
      expect(tier.tierId).toBe(Number(key));
    }
  });

  it("describes each tier with its own real price", () => {
    for (const tier of Object.values(SPONSOR_TIERS)) {
      expect(tier.description).toContain(tier.flatPrice.toFixed(2));
    }
  });
});

describe("retail pricing", () => {
  it("sells Book 1 at $6.99", () => {
    expect(RETAIL_PRICE).toBe(6.99);
  });

  it("converts to whole cents for Stripe", () => {
    expect(Math.round(RETAIL_PRICE * 100)).toBe(699);
  });
});

describe("formatCurrency", () => {
  it("formats whole and fractional dollars as USD", () => {
    expect(formatCurrency(40)).toBe("$40.00");
    expect(formatCurrency(6.99)).toBe("$6.99");
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("groups thousands", () => {
    expect(formatCurrency(1000)).toBe("$1,000.00");
  });

  it("rounds to cents rather than showing a long float", () => {
    expect(formatCurrency(4.199999)).toBe("$4.20");
  });
});

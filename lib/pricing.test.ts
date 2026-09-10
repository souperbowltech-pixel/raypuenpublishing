import { describe, it, expect } from "vitest";
import {
  calculateWholesalePrice,
  isValidQuantity,
  formatCurrency,
  wholesaleDiscountLabel,
  RETAIL_PRICE,
  WHOLESALE_UNIT_PRICE,
  DIGITAL_FEE,
  FREE_MANUAL_THRESHOLD,
} from "./pricing";

/**
 * The 100-copy threshold is the entire basis of the institutional sales pitch.
 * An off-by-one error here is the most expensive bug possible in this project,
 * so the boundary (99 / 100 / 101) is tested explicitly and first.
 */
describe("calculateWholesalePrice — the 100-copy boundary (CRITICAL)", () => {
  it("charges the digital fee at 99 copies (below threshold)", () => {
    const r = calculateWholesalePrice(99);
    expect(r.valid).toBe(true);
    expect(r.quantity).toBe(99);
    expect(r.subtotal).toBe(414.81); // 99 * 4.19
    expect(r.digitalFee).toBe(DIGITAL_FEE); // 20.00
    expect(r.feeWaived).toBe(false);
    expect(r.manualIncluded).toBe(false);
    expect(r.total).toBe(434.81); // 414.81 + 20.00
    expect(r.copiesUntilFreeManual).toBe(1);
  });

  it("waives the fee and includes the manual at EXACTLY 100 copies", () => {
    const r = calculateWholesalePrice(100);
    expect(r.valid).toBe(true);
    expect(r.quantity).toBe(100);
    expect(r.subtotal).toBe(419.0); // 100 * 4.19
    expect(r.digitalFee).toBe(0);
    expect(r.feeWaived).toBe(true);
    expect(r.manualIncluded).toBe(true);
    expect(r.total).toBe(419.0); // fee waived
    expect(r.copiesUntilFreeManual).toBe(0);
  });

  it("keeps the fee waived and manual included at 101 copies (above threshold)", () => {
    const r = calculateWholesalePrice(101);
    expect(r.valid).toBe(true);
    expect(r.quantity).toBe(101);
    expect(r.subtotal).toBe(423.19); // 101 * 4.19
    expect(r.digitalFee).toBe(0);
    expect(r.feeWaived).toBe(true);
    expect(r.manualIncluded).toBe(true);
    expect(r.total).toBe(423.19);
    expect(r.copiesUntilFreeManual).toBe(0);
  });

  it("treats the threshold as >= (100 qualifies, 99 does not)", () => {
    expect(calculateWholesalePrice(FREE_MANUAL_THRESHOLD).feeWaived).toBe(true);
    expect(
      calculateWholesalePrice(FREE_MANUAL_THRESHOLD - 1).feeWaived
    ).toBe(false);
  });
});

describe("calculateWholesalePrice — typical small orders", () => {
  it("prices a single copy with the digital fee", () => {
    const r = calculateWholesalePrice(1);
    expect(r.subtotal).toBe(4.19);
    expect(r.digitalFee).toBe(20.0);
    expect(r.total).toBe(24.19);
    expect(r.manualIncluded).toBe(false);
    expect(r.copiesUntilFreeManual).toBe(99);
  });

  it("prices a mid-size order (50 copies) with the fee still applied", () => {
    const r = calculateWholesalePrice(50);
    expect(r.subtotal).toBe(209.5); // 50 * 4.19
    expect(r.digitalFee).toBe(20.0);
    expect(r.total).toBe(229.5);
    expect(r.feeWaived).toBe(false);
    expect(r.copiesUntilFreeManual).toBe(50);
  });

  it("rounds money to exact cents (no floating-point drift)", () => {
    // 3 * 4.19 = 12.569999999... in floating point
    const r = calculateWholesalePrice(3);
    expect(r.subtotal).toBe(12.57);
    expect(r.total).toBe(32.57);
  });
});

describe("calculateWholesalePrice — invalid quantities (never throws)", () => {
  it("rejects a quantity of 0", () => {
    const r = calculateWholesalePrice(0);
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/at least 1/i);
    expect(r.subtotal).toBe(0);
    expect(r.total).toBe(0);
    expect(r.manualIncluded).toBe(false);
  });

  it("rejects negative numbers", () => {
    const r = calculateWholesalePrice(-25);
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/negative/i);
    expect(r.total).toBe(0);
  });

  it("rejects non-integer (decimal) input", () => {
    const r = calculateWholesalePrice(1.5);
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/whole/i);
    expect(r.total).toBe(0);
  });

  it("rejects NaN and Infinity", () => {
    expect(calculateWholesalePrice(NaN).valid).toBe(false);
    expect(calculateWholesalePrice(Infinity).valid).toBe(false);
    expect(calculateWholesalePrice(-Infinity).valid).toBe(false);
  });

  it("rejects non-numeric input passed at runtime", () => {
    // Simulate untrusted input arriving as a string from a form/backend.
    const r = calculateWholesalePrice("100" as unknown as number);
    expect(r.valid).toBe(false);
    expect(r.total).toBe(0);
  });
});

describe("calculateWholesalePrice — very large quantities", () => {
  it("prices 10,000 copies correctly with the reward tier applied", () => {
    const r = calculateWholesalePrice(10_000);
    expect(r.valid).toBe(true);
    expect(r.subtotal).toBe(41_900.0);
    expect(r.digitalFee).toBe(0);
    expect(r.feeWaived).toBe(true);
    expect(r.manualIncluded).toBe(true);
    expect(r.total).toBe(41_900.0);
  });

  it("prices 1,000,000 copies without overflow or drift", () => {
    const r = calculateWholesalePrice(1_000_000);
    expect(r.valid).toBe(true);
    expect(r.subtotal).toBe(4_190_000.0);
    expect(r.total).toBe(4_190_000.0);
    expect(r.feeWaived).toBe(true);
  });
});

describe("isValidQuantity", () => {
  it("accepts positive whole numbers", () => {
    expect(isValidQuantity(1)).toBe(true);
    expect(isValidQuantity(100)).toBe(true);
  });
  it("rejects everything else", () => {
    expect(isValidQuantity(0)).toBe(false);
    expect(isValidQuantity(-1)).toBe(false);
    expect(isValidQuantity(1.5)).toBe(false);
    expect(isValidQuantity(NaN)).toBe(false);
    expect(isValidQuantity(Infinity)).toBe(false);
    expect(isValidQuantity("5" as unknown)).toBe(false);
    expect(isValidQuantity(null as unknown)).toBe(false);
    expect(isValidQuantity(undefined as unknown)).toBe(false);
  });
});

describe("pricing constants & display helpers", () => {
  it("holds the client's agreed prices", () => {
    expect(RETAIL_PRICE).toBe(6.99);
    expect(WHOLESALE_UNIT_PRICE).toBe(4.19);
    expect(DIGITAL_FEE).toBe(20.0);
    expect(FREE_MANUAL_THRESHOLD).toBe(100);
  });

  it("wholesale is a 40% discount off retail", () => {
    expect(wholesaleDiscountLabel()).toBe("40%");
  });

  it("formats currency as US dollars", () => {
    expect(formatCurrency(6.99)).toBe("$6.99");
    expect(formatCurrency(419)).toBe("$419.00");
    expect(formatCurrency(4190000)).toBe("$4,190,000.00");
  });
});

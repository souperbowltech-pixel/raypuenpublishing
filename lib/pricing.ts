/**
 * Pricing constants and calculations for Puen Publishing.
 */

export const RETAIL_PRICE = 6.99;
export const WHOLESALE_UNIT_PRICE = 4.19;
export const DIGITAL_FEE = 20.0;
export const FREE_MANUAL_THRESHOLD = 100;
export const CURRENCY = "USD";

export function wholesaleDiscountLabel(): string {
  return "40%";
}

export interface SponsorTier {
  tierId: 1 | 2 | 3;
  name: string;
  booksSponsored: number;
  totalPrintedWithMatch: number;
  flatPrice: number;
  description: string;
  isPremiumSponsor: boolean;
  requiresShipping: boolean;
}

export const SPONSOR_TIERS: Record<1 | 2 | 3, SponsorTier> = {
  1: {
    tierId: 1,
    name: "Tier 1: Community Seed",
    booksSponsored: 10,
    totalPrintedWithMatch: 20,
    flatPrice: 40.0,
    description: "Sponsor 10 books for a flat $40.00. We match 1:1 to print 20 books for the Nepal flood recovery effort!",
    isPremiumSponsor: false,
    requiresShipping: false,
  },
  2: {
    tierId: 2,
    name: "Tier 2: Co-Op Multiplier",
    booksSponsored: 48,
    totalPrintedWithMatch: 96,
    flatPrice: 200.0,
    description: "Sponsor 48 books for a flat $200.00. We match 1:1 to print 96 books + Premium Sponsor: Ship 1 Free Copy to you!",
    isPremiumSponsor: true,
    requiresShipping: true,
  },
  3: {
    tierId: 3,
    name: "Tier 3: Kingdom Multiplier",
    booksSponsored: 100,
    totalPrintedWithMatch: 200,
    flatPrice: 400.0,
    description: "Sponsor 100 books for a flat $400.00. We match 1:1 to print 200 books + Premium Sponsor: Ship 1 Free Copy to you!",
    isPremiumSponsor: true,
    requiresShipping: true,
  },
};

export interface WholesalePriceBreakdown {
  valid: boolean;
  reason?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  digitalFee: number;
  feeWaived: boolean;
  manualIncluded: boolean;
  total: number;
  effectivePerUnit: number;
  copiesUntilFreeManual: number;
  freeManualThreshold: number;
}

export function isValidQuantity(quantity: unknown): boolean {
  if (typeof quantity !== "number" || isNaN(quantity) || !isFinite(quantity)) {
    return false;
  }
  if (!Number.isInteger(quantity)) {
    return false;
  }
  return quantity >= 1;
}

function roundToCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function calculateWholesalePrice(quantity: unknown): WholesalePriceBreakdown {
  if (typeof quantity !== "number" || isNaN(quantity) || !isFinite(quantity)) {
    return {
      valid: false,
      reason: "Quantity must be a valid number.",
      quantity: 0,
      unitPrice: WHOLESALE_UNIT_PRICE,
      subtotal: 0,
      digitalFee: 0,
      feeWaived: false,
      manualIncluded: false,
      total: 0,
      effectivePerUnit: 0,
      copiesUntilFreeManual: FREE_MANUAL_THRESHOLD,
      freeManualThreshold: FREE_MANUAL_THRESHOLD,
    };
  }

  if (!Number.isInteger(quantity)) {
    return {
      valid: false,
      reason: "Quantity must be a whole number.",
      quantity: 0,
      unitPrice: WHOLESALE_UNIT_PRICE,
      subtotal: 0,
      digitalFee: 0,
      feeWaived: false,
      manualIncluded: false,
      total: 0,
      effectivePerUnit: 0,
      copiesUntilFreeManual: FREE_MANUAL_THRESHOLD,
      freeManualThreshold: FREE_MANUAL_THRESHOLD,
    };
  }

  if (quantity < 0) {
    return {
      valid: false,
      reason: "Quantity cannot be negative.",
      quantity: 0,
      unitPrice: WHOLESALE_UNIT_PRICE,
      subtotal: 0,
      digitalFee: 0,
      feeWaived: false,
      manualIncluded: false,
      total: 0,
      effectivePerUnit: 0,
      copiesUntilFreeManual: FREE_MANUAL_THRESHOLD,
      freeManualThreshold: FREE_MANUAL_THRESHOLD,
    };
  }

  if (quantity === 0) {
    return {
      valid: false,
      reason: "Quantity must be at least 1.",
      quantity: 0,
      unitPrice: WHOLESALE_UNIT_PRICE,
      subtotal: 0,
      digitalFee: 0,
      feeWaived: false,
      manualIncluded: false,
      total: 0,
      effectivePerUnit: 0,
      copiesUntilFreeManual: FREE_MANUAL_THRESHOLD,
      freeManualThreshold: FREE_MANUAL_THRESHOLD,
    };
  }

  const qty = quantity;
  const subtotal = roundToCents(qty * WHOLESALE_UNIT_PRICE);
  const feeWaived = qty >= FREE_MANUAL_THRESHOLD;
  const digitalFee = feeWaived ? 0 : DIGITAL_FEE;
  const total = roundToCents(subtotal + digitalFee);
  const effectivePerUnit = roundToCents(total / qty);
  const copiesUntilFreeManual = Math.max(0, FREE_MANUAL_THRESHOLD - qty);

  return {
    valid: true,
    quantity: qty,
    unitPrice: WHOLESALE_UNIT_PRICE,
    subtotal,
    digitalFee,
    feeWaived,
    manualIncluded: feeWaived,
    total,
    effectivePerUnit,
    copiesUntilFreeManual,
    freeManualThreshold: FREE_MANUAL_THRESHOLD,
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

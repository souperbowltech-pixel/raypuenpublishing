/**
 * Pricing constants and calculations for Puen Publishing.
 *
 * Institutions are priced with the flat `SPONSOR_TIERS` below. An earlier
 * per-copy model ($4.19/book plus a $20 digital fee waived at 100 copies) was
 * superseded and removed on 2026-09-23 — the live portal says "no per-copy
 * math". It is in git history if that model is ever revived.
 */

export const RETAIL_PRICE = 6.99;
export const PARENTS_GUIDE_DIGITAL_PRICE = 29.97;
export const PATROL_BUNDLE_PRICE = 10.0;
export const CURRENCY = "USD";

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

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

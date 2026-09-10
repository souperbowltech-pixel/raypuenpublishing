/**
 * ============================================================================
 *  PUEN PUBLISHING — PRICING ENGINE
 * ============================================================================
 *
 *  This is the SINGLE SOURCE OF TRUTH for every price on the site.
 *  If a price ever needs to change, change it HERE and nowhere else.
 *
 *  ----------------------------------------------------------------------------
 *  HOW TO CHANGE A PRICE (for non-technical editors)
 *  ----------------------------------------------------------------------------
 *  Edit only the numbers in the PRICING block just below. For example, to make
 *  the retail price $7.99, change:  RETAIL_PRICE = 6.99   ->   RETAIL_PRICE = 7.99
 *
 *  Do not add currency symbols or commas — just the plain number (dollars).
 *  The rest of the site updates automatically.
 * ============================================================================
 */

/* ---------------------------------------------------------------------------
 * PRICING  ——  the only numbers you should normally need to edit
 * ------------------------------------------------------------------------- */

/** Price a single book sells for on the public retail page (US dollars). */
export const RETAIL_PRICE = 6.99;

/** Price per book for institutional / bulk orders (40% off retail). */
export const WHOLESALE_UNIT_PRICE = 4.19;

/** One-time digital fee added to SMALL institutional orders (US dollars). */
export const DIGITAL_FEE = 20.0;

/**
 * The quantity at which an institutional order "levels up":
 *  - the DIGITAL_FEE is waived, and
 *  - the Teacher's Master Manual PDF is included for free.
 * Orders of this many copies OR MORE qualify.
 */
export const FREE_MANUAL_THRESHOLD = 100;

/** Currency the prices above are expressed in. Used for formatting only. */
export const CURRENCY = "USD";

/* ---------------------------------------------------------------------------
 * TYPES
 * ------------------------------------------------------------------------- */

/**
 * The complete, itemised result of pricing an institutional order.
 * A backend (Milestone 2) can consume this object directly.
 */
export interface WholesalePriceBreakdown {
  /** Whether the requested quantity was a valid, orderable amount. */
  valid: boolean;
  /** Human-readable reason when `valid` is false (empty string otherwise). */
  reason: string;

  /** The quantity as it was actually priced (0 when the input is invalid). */
  quantity: number;
  /** Price charged per book. */
  unitPrice: number;

  /** quantity × unitPrice, rounded to cents. */
  subtotal: number;

  /** The dollar amount of the digital fee actually charged (0 if waived). */
  digitalFee: number;
  /** True when the digital fee was waived because the order qualified. */
  feeWaived: boolean;

  /** True when the free Teacher's Master Manual PDF is included. */
  manualIncluded: boolean;

  /** subtotal + digitalFee, rounded to cents. */
  total: number;

  /** The threshold used, echoed so the UI never hard-codes it. */
  freeManualThreshold: number;
  /**
   * How many MORE copies are needed to unlock the free-manual / no-fee tier.
   * 0 once the order already qualifies.
   */
  copiesUntilFreeManual: number;
}

/* ---------------------------------------------------------------------------
 * HELPERS
 * ------------------------------------------------------------------------- */

/**
 * Rounds a dollar amount to whole cents, avoiding floating-point drift
 * (e.g. 99 * 4.19 = 414.8100000000001 -> 414.81).
 */
function roundToCents(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * A quantity is valid only if it is a positive whole number.
 * Rejects: 0, negatives, decimals (e.g. 1.5), NaN, Infinity, and non-numbers.
 */
export function isValidQuantity(quantity: unknown): quantity is number {
  return (
    typeof quantity === "number" &&
    Number.isFinite(quantity) &&
    Number.isInteger(quantity) &&
    quantity > 0
  );
}

/* ---------------------------------------------------------------------------
 * THE PRICING FUNCTION  (pure — no side effects, same input => same output)
 * ------------------------------------------------------------------------- */

/**
 * Calculate the full price breakdown for an institutional (wholesale) order.
 *
 * Rules:
 *   - Every book is WHOLESALE_UNIT_PRICE.
 *   - Orders BELOW FREE_MANUAL_THRESHOLD pay the DIGITAL_FEE.
 *   - Orders of FREE_MANUAL_THRESHOLD copies OR MORE:
 *       • have the DIGITAL_FEE waived, AND
 *       • receive the Teacher's Master Manual PDF for free.
 *
 * Invalid quantities (0, negative, non-integer, non-numeric) never throw;
 * they return a zeroed breakdown with `valid: false` and a `reason`, so the
 * live calculator can render a safe state and show an inline message.
 */
export function calculateWholesalePrice(
  quantity: number
): WholesalePriceBreakdown {
  const base: WholesalePriceBreakdown = {
    valid: false,
    reason: "",
    quantity: 0,
    unitPrice: WHOLESALE_UNIT_PRICE,
    subtotal: 0,
    digitalFee: 0,
    feeWaived: false,
    manualIncluded: false,
    total: 0,
    freeManualThreshold: FREE_MANUAL_THRESHOLD,
    copiesUntilFreeManual: FREE_MANUAL_THRESHOLD,
  };

  if (!isValidQuantity(quantity)) {
    let reason = "Please enter a whole number of copies.";
    if (typeof quantity === "number" && Number.isFinite(quantity)) {
      if (quantity === 0) reason = "Please enter at least 1 copy.";
      else if (quantity < 0) reason = "Quantity cannot be negative.";
      else if (!Number.isInteger(quantity))
        reason = "Books are sold in whole copies — no fractions.";
    }
    return { ...base, reason };
  }

  const qualifiesForRewardTier = quantity >= FREE_MANUAL_THRESHOLD;

  const subtotal = roundToCents(quantity * WHOLESALE_UNIT_PRICE);
  const digitalFee = qualifiesForRewardTier ? 0 : DIGITAL_FEE;
  const total = roundToCents(subtotal + digitalFee);

  return {
    valid: true,
    reason: "",
    quantity,
    unitPrice: WHOLESALE_UNIT_PRICE,
    subtotal,
    digitalFee,
    feeWaived: qualifiesForRewardTier,
    manualIncluded: qualifiesForRewardTier,
    total,
    freeManualThreshold: FREE_MANUAL_THRESHOLD,
    copiesUntilFreeManual: qualifiesForRewardTier
      ? 0
      : FREE_MANUAL_THRESHOLD - quantity,
  };
}

/* ---------------------------------------------------------------------------
 * FORMATTING  (display helpers — safe to use anywhere in the UI)
 * ------------------------------------------------------------------------- */

/** Formats a number as a US-dollar string, e.g. 6.99 -> "$6.99". */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: CURRENCY,
  }).format(amount);
}

/** The percentage discount wholesale represents versus retail, e.g. "40%". */
export function wholesaleDiscountLabel(): string {
  const pct = Math.round((1 - WHOLESALE_UNIT_PRICE / RETAIL_PRICE) * 100);
  return `${pct}%`;
}

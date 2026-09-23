/**
 * ============================================================================
 *  CHECKOUT INTEGRATION
 * ============================================================================
 *
 *  Wires the retail purchase to a real Stripe Checkout session.
 *
 *  Institutional checkout deliberately has no helper here: the flat-tier
 *  sponsorship form in `components/institutions/WholesaleForm.tsx` posts to
 *  `/api/checkout/wholesale` directly. A parallel `initiateWholesaleCheckout`
 *  used to live here from the earlier per-copy pricing model; it was never
 *  called and its payload shape had drifted out of sync with the route, so it
 *  was removed on 2026-09-23 rather than left as a trap for the next refactor.
 * ============================================================================
 */

/** Stable product identifier for Book 1. */
export const BOOK_1_SKU = "PUEN-CB-001";

/* ---------------------------------------------------------------------------
 * initiateRetailCheckout — calls /api/checkout/retail & redirects to Stripe
 * ------------------------------------------------------------------------- */

export async function initiateRetailCheckout(
  quantity: number = 1
): Promise<{ url?: string; error?: string }> {
  const safeQuantity =
    Number.isInteger(quantity) && quantity > 0 ? quantity : 1;

  try {
    const res = await fetch("/api/checkout/retail", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ quantity: safeQuantity }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to create checkout session.");
    }

    if (data.url) {
      window.location.href = data.url;
    }

    return data;
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("[initiateRetailCheckout] error ->", error);
    return { error: error.message || "Failed to initiate retail checkout." };
  }
}

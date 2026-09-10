/**
 * ============================================================================
 *  CHECKOUT INTEGRATION — Milestone 2
 * ============================================================================
 *
 *  Wires the retail and wholesale purchases to real Stripe Checkout sessions.
 * ============================================================================
 */

import {
  RETAIL_PRICE,
  CURRENCY,
  calculateWholesalePrice,
  type WholesalePriceBreakdown,
} from "./pricing";

/* ---------------------------------------------------------------------------
 * Shared payload types
 * ------------------------------------------------------------------------- */

export type OrderChannel = "retail" | "wholesale";

export interface RetailOrderPayload {
  channel: "retail";
  createdAt: string; // ISO timestamp
  currency: string;
  items: Array<{
    sku: string;
    title: string;
    quantity: number;
    unitPrice: number;
  }>;
  amountTotal: number;
}

export interface ShippingAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface WholesaleContact {
  institutionName: string;
  institutionType: string; // e.g. "school" | "preschool" | "church" | "other"
  contactName: string;
  email: string;
  phone: string;
}

export interface WholesaleOrderPayload {
  channel: "wholesale";
  createdAt: string; // ISO timestamp
  currency: string;
  sku: string;
  contact: WholesaleContact;
  shippingAddress: ShippingAddress;
  pricing: WholesalePriceBreakdown;
}

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

/* ---------------------------------------------------------------------------
 * initiateWholesaleCheckout — calls /api/checkout/wholesale & redirects to Stripe
 * ------------------------------------------------------------------------- */

export async function initiateWholesaleCheckout(input: {
  contact: WholesaleContact;
  shippingAddress: ShippingAddress;
  quantity: number;
}): Promise<{ url?: string; error?: string }> {
  try {
    const res = await fetch("/api/checkout/wholesale", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to create wholesale checkout session.");
    }

    if (data.url) {
      window.location.href = data.url;
    }

    return data;
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("[initiateWholesaleCheckout] error ->", error);
    return { error: error.message || "Failed to initiate wholesale checkout." };
  }
}

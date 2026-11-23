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

import { book1 } from "@/lib/book";
import { RETAIL_PRICE } from "@/lib/pricing";

/** Stable product identifier for Book 1. */
export const BOOK_1_SKU = "PUEN-CB-001";
/** Stable product identifier for The Neighborhood Chronicles, Book 1. */
export const NC_BOOK_1_SKU = "PUEN-NC-001";

export type PrintedBookKey = "geezy-book-1" | "neighborhood-book-1";

export interface PrintedBook {
  key: PrintedBookKey;
  sku: string;
  /** The line item name on Stripe Checkout and in Ray's order email. */
  title: string;
  description: string;
  /** What one copy costs, in cents: Checkout charges it and Ray's email checks against it. */
  unitAmountCents: number;
  /** The page that sells this book, for the success page's way back. */
  pagePath: string;
  /** This book's buy box on that page, for the cancel page's "Try Again". */
  returnPath: string;
  /** A small label on the buy box, if the book has one. */
  badge: string | null;
}

/**
 * The printed books sold through /api/checkout/retail.
 * Each order reaches Ray by email (the Stripe webhook) to be placed at
 * IngramSpark; the SKU in the session says which book to print.
 */
export const PRINTED_BOOKS: Record<PrintedBookKey, PrintedBook> = {
  "geezy-book-1": {
    key: "geezy-book-1",
    sku: BOOK_1_SKU,
    title: `${book1.title}, ${book1.tagline}`,
    description: "An Interactive Rhythmic Rhyme & Tactile Coloring Quest for Early Learners.",
    unitAmountCents: Math.round(RETAIL_PRICE * 100),
    pagePath: "/",
    returnPath: "/#buy",
    badge: "Free coloring fun",
  },
  "neighborhood-book-1": {
    key: "neighborhood-book-1",
    sku: NC_BOOK_1_SKU,
    title: "The Neighborhood Chronicles, Book 1: David and Goliath",
    description: "A Bible-based character curriculum for children ages 3 to 7.",
    unitAmountCents: Math.round(RETAIL_PRICE * 100),
    pagePath: "/neighborhood",
    returnPath: "/neighborhood#order",
    badge: null,
  },
};

/** The book a request names, or null. Only the keys above count. */
export function findPrintedBook(key: unknown): PrintedBook | null {
  return typeof key === "string" && Object.prototype.hasOwnProperty.call(PRINTED_BOOKS, key)
    ? PRINTED_BOOKS[key as PrintedBookKey]
    : null;
}

/** The book a paid session's SKU stands for, or null for any other SKU. */
export function printedBookBySku(sku: unknown): PrintedBook | null {
  return Object.values(PRINTED_BOOKS).find((book) => book.sku === sku) ?? null;
}

/* ---------------------------------------------------------------------------
 * initiateRetailCheckout, calls /api/checkout/retail & redirects to Stripe
 * ------------------------------------------------------------------------- */

export async function initiateRetailCheckout(
  quantity: number = 1,
  book: PrintedBookKey = "geezy-book-1"
): Promise<{ url?: string; error?: string }> {
  const safeQuantity =
    Number.isInteger(quantity) && quantity > 0 ? quantity : 1;

  try {
    const res = await fetch("/api/checkout/retail", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ quantity: safeQuantity, book }),
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

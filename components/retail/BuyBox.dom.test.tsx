// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BuyBox } from "@/components/retail/BuyBox";
import { PRINTED_BOOKS, findPrintedBook, printedBookBySku, NC_BOOK_1_SKU, BOOK_1_SKU } from "@/lib/checkout";
import { book1 } from "@/lib/book";
import { RETAIL_PRICE } from "@/lib/pricing";

/**
 * The buy box sends the book it was given to /api/checkout/retail, so the
 * Neighborhood Chronicles box on /neighborhood never sells Geezy by mistake.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  // A failed answer keeps the page where it is (a success would navigate away).
  fetchMock = vi.fn(() =>
    Promise.resolve(new Response(JSON.stringify({ error: "Payments are not configured." }), { status: 503 }))
  );
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const buy = () =>
  act(async () => {
    [...container.querySelectorAll("button")].find((b) => b.textContent?.startsWith("Buy Now"))!.click();
  });

const sentBody = () => JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));

describe("BuyBox", () => {
  it("sells Geezy Goober unless told otherwise", async () => {
    act(() => root.render(<BuyBox testMode />));
    await buy();
    expect(sentBody()).toEqual({ quantity: 1, book: "geezy-book-1" });
    expect(container.textContent).toContain("Free coloring fun");
    expect(container.querySelector("#buy")).not.toBeNull();
  });

  it("sells the book it is given, under its own anchor and field ids", async () => {
    act(() => root.render(<BuyBox book="neighborhood-book-1" id="order" testMode />));
    expect(container.querySelector("#order")).not.toBeNull();
    expect(container.querySelector('label[for="order-qty"]')).not.toBeNull();
    expect(container.querySelector("#order-qty")).not.toBeNull();
    await buy();
    expect(sentBody()).toEqual({ quantity: 1, book: "neighborhood-book-1" });
  });

  it("shows the route's error when checkout cannot start", async () => {
    act(() => root.render(<BuyBox book="neighborhood-book-1" id="order" testMode />));
    await buy();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Payments are not configured");
  });
});

describe("BuyBox, what it promises", () => {
  it("sends the quantity typed into the box with its book", async () => {
    act(() => root.render(<BuyBox book="neighborhood-book-1" id="order" testMode />));
    const plus = container.querySelector('[aria-label="Increase quantity"]') as HTMLButtonElement;
    act(() => plus.click());
    act(() => plus.click());
    await buy();
    expect(sentBody()).toEqual({ quantity: 3, book: "neighborhood-book-1" });
  });

  it("shows the price Checkout charges for that book", () => {
    act(() => root.render(<BuyBox book="neighborhood-book-1" id="order" testMode />));
    const cents = PRINTED_BOOKS["neighborhood-book-1"].unitAmountCents;
    expect(container.textContent).toContain(`$${(cents / 100).toFixed(2)}`);
    expect(container.textContent).toContain(`Buy Now · $${(cents / 100).toFixed(2)}`);
  });

  it("shows a book's badge only when it has one", () => {
    act(() => root.render(<BuyBox book="neighborhood-book-1" id="order" testMode />));
    expect(container.textContent).not.toContain("Free coloring fun");
  });

  it("promises no shipping time, since each copy is printed to order by hand", () => {
    act(() => root.render(<BuyBox testMode />));
    expect(container.textContent).not.toMatch(/business days/i);
  });

  it("shows the test card note only in test mode, never to a real buyer", () => {
    act(() => root.render(<BuyBox testMode />));
    expect(container.textContent).toContain("4242");
    act(() => root.render(<BuyBox testMode={false} />));
    expect(container.textContent).not.toContain("4242");
    expect(container.textContent).not.toMatch(/sandbox/i);
  });
});

describe("the printed books on sale", () => {
  it("prices each book in whole cents, and names Geezy exactly as the storefront does", () => {
    expect(PRINTED_BOOKS["geezy-book-1"].title).toBe(`${book1.title}, ${book1.tagline}`);
    expect(PRINTED_BOOKS["geezy-book-1"].sku).toBe(book1.sku);
    for (const book of Object.values(PRINTED_BOOKS)) {
      expect(Number.isInteger(book.unitAmountCents)).toBe(true);
      expect(book.unitAmountCents).toBe(Math.round(RETAIL_PRICE * 100));
    }
  });

  it("leads each book back to its own buy box", () => {
    expect(PRINTED_BOOKS["geezy-book-1"].returnPath).toBe("/#buy");
    expect(PRINTED_BOOKS["neighborhood-book-1"].returnPath).toBe("/neighborhood#order");
  });

  it("finds a book only by its own key, never by an inherited name", () => {
    expect(findPrintedBook("neighborhood-book-1")?.sku).toBe(NC_BOOK_1_SKU);
    for (const key of ["toString", "__proto__", "constructor", "parents-guide", 1, null, undefined]) {
      expect(findPrintedBook(key)).toBeNull();
    }
  });

  it("names the book behind a paid session's SKU, and nothing for any other SKU", () => {
    expect(printedBookBySku(BOOK_1_SKU)?.key).toBe("geezy-book-1");
    expect(printedBookBySku(NC_BOOK_1_SKU)?.key).toBe("neighborhood-book-1");
    expect(printedBookBySku("PUEN-XX-999")).toBeNull();
    expect(printedBookBySku(undefined)).toBeNull();
  });
});

describe("isStripeTestMode", () => {
  it("is false only for a live key, however it is padded", async () => {
    const { isStripeTestMode } = await import("@/lib/stripe");
    expect(isStripeTestMode("sk_live_x")).toBe(false);
    expect(isStripeTestMode("  sk_live_x  ")).toBe(false);
    expect(isStripeTestMode("sk_test_x")).toBe(true);
    expect(isStripeTestMode("")).toBe(true);
    expect(isStripeTestMode(undefined)).toBe(true);
    expect(isStripeTestMode("rk_live_restricted")).toBe(true);
  });
});

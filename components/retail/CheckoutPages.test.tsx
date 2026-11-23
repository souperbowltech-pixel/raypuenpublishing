import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ShippingReturns } from "@/components/retail/ShippingReturns";

/**
 * The pages Stripe sends a buyer back to (app/ .tsx tests are not collected,
 * so they are tested from here). A Neighborhood Chronicles buyer must never be
 * led to Geezy Goober's buy box, and no page may promise a shipping time.
 */

const retrieve = vi.fn();
// Set to make Stripe unreachable. Kept outside the spy: a rejected promise
// returned through a vi.fn is reported by the runner even when it is caught.
let stripeDown: Error | null = null;
vi.mock("@/lib/stripe", () => ({
  stripe: {
    checkout: {
      sessions: { retrieve: (...a: unknown[]) => (stripeDown ? Promise.reject(stripeDown) : retrieve(...a)) },
    },
  },
}));
vi.mock("@/lib/patrol-store", () => ({ getPatrolTokenBySession: async () => null }));

const { default: SuccessPage } = await import("@/app/checkout/success/page");
const { default: CancelPage } = await import("@/app/checkout/cancel/page");

const paid = (metadata: Record<string, string>) => ({ payment_status: "paid", metadata });
const success = async (session: unknown) => {
  retrieve.mockResolvedValue(session);
  return renderToStaticMarkup(await SuccessPage({ searchParams: { session_id: "cs_test_1" } }));
};

beforeEach(() => {
  retrieve.mockReset();
  stripeDown = null;
});

describe("/checkout/success", () => {
  it("names the NC book bought, leads back to its page, and promises no shipping time", async () => {
    const html = await success(paid({ channel: "retail", sku: "PUEN-NC-001", quantity: "1" }));
    expect(html).toContain("Your copy of The Neighborhood Chronicles, Book 1: David and Goliath will be printed for you");
    expect(html).not.toContain("Geezy");
    expect(html).not.toMatch(/business days/);
    expect(html).toContain('href="/neighborhood"');
  });

  it("names Geezy Goober for a Geezy order and leads back to the storefront", async () => {
    const html = await success(paid({ channel: "retail", sku: "PUEN-CB-001", quantity: "2" }));
    expect(html).toContain("Your copy of The Adventures of Geezy Goober");
    expect(html).not.toMatch(/business days/);
    expect(html).toMatch(/href="\/"/);
  });

  it("promises no printing or dispatch for a Patrol or a digital Guide", async () => {
    for (const order_type of ["patrol_bundle", "guide_digital"]) {
      const html = await success(paid({ order_type }));
      expect(html).not.toContain("printed");
      expect(html).not.toContain("Dispatched");
    }
  });

  it("promises nothing about printing for a paid session it cannot name", async () => {
    const html = await success(paid({ channel: "retail", sku: "PUEN-XX-999" }));
    expect(html).toContain("Your order is recorded and we will be in touch about it.");
    expect(html).not.toContain("printed for you");
  });
});

describe("/checkout/success, other orders", () => {
  it.each(["paid", "no_payment_required"])("gives a confirmed sponsorship (%s) its invoice and manual fulfilment copy", async (payment_status) => {
    const html = await success({ payment_status, metadata: { order_type: "institutional_sponsorship" } });
    expect(html).toContain("An itemised invoice is emailed to you for your records");
    expect(html).toContain("printed for you and sent to the address you gave");
    expect(html).not.toMatch(/business\s+days/i);
  });

  it.each(["unpaid", "unknown", undefined])(
    "makes no shipping promise for an unconfirmed sponsorship (%s)", async (payment_status) => {
      const html = await success({ payment_status, metadata: { order_type: "institutional_sponsorship" } });
      expect(html).not.toContain("printed for you");
      expect(html).not.toContain("What happens next?");
      expect(html).not.toMatch(/business\s+days/i);
    }
  );

  it("makes no shipping promise when a sponsorship query cannot be verified", async () => {
    stripeDown = new Error("network");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const html = renderToStaticMarkup(await SuccessPage({
      searchParams: { session_id: "cs_test_1", type: "institutional_sponsorship" },
    }));
    expect(html).not.toContain("printed for you");
    expect(html).not.toContain("What happens next?");
    expect(html).not.toMatch(/business\s+days/i);
  });

  it("names no book for a retail session without a SKU", async () => {
    const html = await success(paid({ channel: "retail" }));
    expect(html).toContain("Your order is recorded and we will be in touch about it.");
  });

  it("names no book and leads home when Stripe cannot be asked", async () => {
    stripeDown = new Error("network");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const html = renderToStaticMarkup(await SuccessPage({ searchParams: { session_id: "cs_test_1" } }));
    expect(html).not.toContain("Your copy of");
    expect(html).toMatch(/href="\/"/);
  });
});

describe("storefront shipping copy", () => {
  it("renders manual fulfilment wording and keeps the separate returns policy", () => {
    const html = renderToStaticMarkup(<ShippingReturns />);
    expect(html).toContain("printed for you and sent to the address you gave");
    expect(html).not.toMatch(/business\s+days/i);
    expect(html).toContain("Unopened books can be returned within 30 days for a full refund.");
  });
});

describe("/checkout/cancel", () => {
  it("sends an NC buyer back to the NC box", () => {
    const html = renderToStaticMarkup(<CancelPage searchParams={{ book: "neighborhood-book-1" }} />);
    expect(html).toContain('href="/neighborhood#order"');
    expect(html).not.toContain('href="/#buy"');
  });

  it("sends anyone else back to Geezy Goober's box, as before", () => {
    for (const book of [undefined, "geezy-book-1", "toString", "javascript:alert(1)"]) {
      const html = renderToStaticMarkup(<CancelPage searchParams={{ book }} />);
      expect(html).toContain('href="/#buy"');
      expect(html).not.toContain("javascript:");
    }
  });
});

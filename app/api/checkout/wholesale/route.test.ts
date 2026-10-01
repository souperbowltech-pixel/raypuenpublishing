import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

/**
 * API-03 — a $200 or $400 order can be taken with nowhere to ship it.
 *
 * WholesaleForm enforces "Tier 2 and 3 require a shipping address" in the browser,
 * but the server-side route must enforce it as well. Any direct API call, retry tool,
 * or client-side bug must not produce a paid Premium Sponsor order without an address
 * to ship the complimentary copy to.
 *
 * These tests pin:
 * - Tier 2 ($200) and Tier 3 ($400) requests without a shipping address reject with 400.
 * - Incomplete shipping addresses (missing line1, city, state, or zip, or whitespace-only) reject with 400.
 * - Tier 1 ($40, non-premium) does not require a shipping address and succeeds.
 * - Complete shipping addresses on Premium tiers are attached to Stripe metadata.
 */

const createSessionMock = vi.fn();

vi.mock("@/lib/stripe", () => ({
  stripe: {
    checkout: {
      sessions: {
        create: (...args: unknown[]) => createSessionMock(...args),
      },
    },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => ({ ok: true, retryAfter: 0 }),
  clientIp: () => "127.0.0.1",
}));

const { POST } = await import("./route");

function buildRequest(body: unknown): NextRequest {
  return {
    headers: {
      get: (name: string) => {
        if (name.toLowerCase() === "content-type") return "application/json";
        return null;
      },
    },
    json: async () => body,
  } as unknown as NextRequest;
}

const validInstitution = {
  name: "Lincoln Elementary School",
  contactName: "Principal Skinner",
  email: "skinner@springfield.edu",
  phone: "555-0100",
};

const completeAddress = {
  line1: "123 Schoolhouse Rd",
  city: "Springfield",
  state: "OR",
  zip: "97477",
};

describe("POST /api/checkout/wholesale (API-03 shipping address enforcement)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createSessionMock.mockResolvedValue({
      url: "https://checkout.stripe.com/test-session",
    });
  });

  it("rejects Tier 2 ($200) with 400 when shippingAddress is omitted", async () => {
    const req = buildRequest({
      tierId: 2,
      institution: validInstitution,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain("A complete shipping address");
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it("rejects Tier 3 ($400) with 400 when shippingAddress is omitted", async () => {
    const req = buildRequest({
      tierId: 3,
      institution: validInstitution,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain("A complete shipping address");
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it("rejects Premium Sponsor with 400 when shippingAddress is missing any required field", async () => {
    const incompleteAddresses = [
      { line1: "", city: "Springfield", state: "OR", zip: "97477" },
      { line1: "123 Main St", city: "", state: "OR", zip: "97477" },
      { line1: "123 Main St", city: "Springfield", state: "", zip: "97477" },
      { line1: "123 Main St", city: "Springfield", state: "OR", zip: "" },
      { line1: "   ", city: "   ", state: "   ", zip: "   " },
    ];

    for (const address of incompleteAddresses) {
      createSessionMock.mockClear();
      const req = buildRequest({
        tierId: 2,
        institution: validInstitution,
        shippingAddress: address,
      });

      const res = await POST(req);
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.error).toContain("A complete shipping address");
      expect(createSessionMock).not.toHaveBeenCalled();
    }
  });

  it("allows Tier 1 ($40) without a shipping address and creates a Stripe checkout session", async () => {
    const req = buildRequest({
      tierId: 1,
      institution: validInstitution,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.url).toBe("https://checkout.stripe.com/test-session");
    expect(createSessionMock).toHaveBeenCalledTimes(1);

    const sessionArgs = createSessionMock.mock.calls[0][0];
    expect(sessionArgs.metadata.tier_id).toBe("1");
    expect(sessionArgs.metadata.premium_sponsor).toBeUndefined();
    expect(sessionArgs.metadata.sponsor_shipping).toBeUndefined();
  });

  it("accepts Premium Sponsor Tier 2 when a complete shipping address is provided", async () => {
    const req = buildRequest({
      tierId: 2,
      institution: validInstitution,
      shippingAddress: completeAddress,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.url).toBe("https://checkout.stripe.com/test-session");
    expect(createSessionMock).toHaveBeenCalledTimes(1);

    const sessionArgs = createSessionMock.mock.calls[0][0];
    expect(sessionArgs.metadata.tier_id).toBe("2");
    expect(sessionArgs.metadata.premium_sponsor).toBe("true");
    expect(sessionArgs.metadata.note).toBe("Premium Sponsor: Ship 1 Free Copy");
    expect(sessionArgs.metadata.sponsor_shipping).toBe(
      "123 Schoolhouse Rd, Springfield, OR 97477"
    );
  });
});

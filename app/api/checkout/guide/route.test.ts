import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { PARENTS_GUIDE_DIGITAL_PRICE } from "@/lib/pricing";

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

let rateLimitOk = true;
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => ({ ok: rateLimitOk, retryAfter: 60 }),
  clientIp: () => "127.0.0.1",
}));

let guideLive = false;
vi.mock("@/lib/pricing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/pricing")>();
  return {
    ...actual,
    get PARENTS_GUIDE_DIGITAL_LIVE() {
      return guideLive;
    },
  };
});

const { POST } = await import("./route");

function buildRequest(): NextRequest {
  return {
    headers: {
      get: (name: string) => {
        if (name.toLowerCase() === "content-type") return "application/json";
        return null;
      },
    },
  } as unknown as NextRequest;
}

describe("POST /api/checkout/guide (Parent's Guide Digital Edition checkout)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guideLive = false;
    rateLimitOk = true;
    createSessionMock.mockResolvedValue({
      url: "https://checkout.stripe.com/guide-test-session",
    });
  });

  it("returns 503 when the guide is not on sale yet (PARENTS_GUIDE_DIGITAL_LIVE = false)", async () => {
    guideLive = false;
    const req = buildRequest();
    const res = await POST(req);

    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toBe("The digital Parent's Guide is not on sale yet.");
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  describe("when PARENTS_GUIDE_DIGITAL_LIVE = true", () => {
    beforeEach(() => {
      guideLive = true;
    });

    it("returns 429 when rate limited", async () => {
      rateLimitOk = false;
      const req = buildRequest();
      const res = await POST(req);

      expect(res.status).toBe(429);
      const data = await res.json();
      expect(data.error).toBe("Too many requests");
      expect(createSessionMock).not.toHaveBeenCalled();
    });

    it("creates a Stripe checkout session with guide_digital metadata and correct price", async () => {
      const req = buildRequest();
      const res = await POST(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.url).toBe("https://checkout.stripe.com/guide-test-session");

      expect(createSessionMock).toHaveBeenCalledTimes(1);
      const sessionArgs = createSessionMock.mock.calls[0][0];

      // Price is $29.97 (2997 cents)
      expect(sessionArgs.line_items[0].price_data.unit_amount).toBe(
        Math.round(PARENTS_GUIDE_DIGITAL_PRICE * 100)
      );
      expect(sessionArgs.line_items[0].price_data.unit_amount).toBe(2997);

      expect(sessionArgs.metadata).toEqual({
        channel: "guide_digital",
        order_type: "guide_digital",
      });

      expect(sessionArgs.success_url).toContain("/checkout/success?session_id={CHECKOUT_SESSION_ID}");
      expect(sessionArgs.cancel_url).toContain("/guide");
    });

    it("returns 500 when Stripe session creation fails", async () => {
      createSessionMock.mockRejectedValueOnce(new Error("Stripe API down"));

      const req = buildRequest();
      const res = await POST(req);

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe("Failed to create checkout session");
    });
  });
});

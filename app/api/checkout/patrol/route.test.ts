import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { PATROL_BUNDLE_PRICE } from "@/lib/pricing";

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

describe("POST /api/checkout/patrol (Patrol Leader Bundle $10 checkout)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitOk = true;
    createSessionMock.mockResolvedValue({
      url: "https://checkout.stripe.com/patrol-test-session",
    });
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

  it("creates a $10 Stripe checkout session with patrol_bundle metadata", async () => {
    const req = buildRequest();
    const res = await POST(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.url).toBe("https://checkout.stripe.com/patrol-test-session");

    expect(createSessionMock).toHaveBeenCalledTimes(1);
    const sessionArgs = createSessionMock.mock.calls[0][0];

    // Price is $10.00 (1000 cents)
    expect(sessionArgs.line_items[0].price_data.unit_amount).toBe(Math.round(PATROL_BUNDLE_PRICE * 100));
    expect(sessionArgs.line_items[0].price_data.unit_amount).toBe(1000);

    // Channel and order type metadata
    expect(sessionArgs.metadata).toEqual({
      channel: "patrol_bundle",
      order_type: "patrol_bundle",
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

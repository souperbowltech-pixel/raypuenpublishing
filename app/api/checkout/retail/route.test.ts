import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

/**
 * SEC-04 regression tests — retail checkout quantity bounds and validation.
 *
 * Validates that retail quantity:
 * - Defaults to 1 when omitted.
 * - Accepts whole numbers between 1 and 50.
 * - Rejects non-numbers, non-integers, numbers < 1, and numbers > 50 with 400.
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

function buildRequest(body?: unknown): NextRequest {
  return {
    headers: {
      get: (name: string) => {
        if (name.toLowerCase() === "content-type") return "application/json";
        return null;
      },
    },
    json: async () => body ?? {},
  } as unknown as NextRequest;
}

describe("POST /api/checkout/retail (SEC-04 quantity bounds)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createSessionMock.mockResolvedValue({
      url: "https://checkout.stripe.com/test-retail-session",
    });
  });

  it("defaults quantity to 1 when body has no quantity", async () => {
    const req = buildRequest({});
    const res = await POST(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.url).toBe("https://checkout.stripe.com/test-retail-session");

    expect(createSessionMock).toHaveBeenCalledTimes(1);
    const args = createSessionMock.mock.calls[0][0];
    expect(args.line_items[0].quantity).toBe(1);
  });

  it("accepts valid whole number quantities between 1 and 50", async () => {
    for (const qty of [1, 5, 25, 50]) {
      createSessionMock.mockClear();
      const req = buildRequest({ quantity: qty });
      const res = await POST(req);

      expect(res.status).toBe(200);
      expect(createSessionMock).toHaveBeenCalledTimes(1);
      const args = createSessionMock.mock.calls[0][0];
      expect(args.line_items[0].quantity).toBe(qty);
    }
  });

  it("rejects invalid quantities with 400", async () => {
    const invalidInputs = [
      0,
      -1,
      -10,
      51,
      100,
      1.5,
      3.14,
      "5",
      "one",
      null,
      {},
      [],
      NaN,
      Infinity,
    ];

    for (const invalid of invalidInputs) {
      createSessionMock.mockClear();
      const req = buildRequest({ quantity: invalid });
      const res = await POST(req);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Quantity must be a whole number between 1 and 50.");
      expect(createSessionMock).not.toHaveBeenCalled();
    }
  });
});

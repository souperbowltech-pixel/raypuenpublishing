import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

/**
 * Go-live guard: when STRIPE_SECRET_KEY is missing or is still the build-time
 * placeholder, no checkout route may reach Stripe.
 *
 * This is the failure that only appears on the morning live keys go in. Without
 * the guard the SDK is constructed with the placeholder, the request travels to
 * Stripe, and the buyer meets an opaque authentication error with their card in
 * their hand. Every route must refuse first and say so plainly.
 */

const createSessionMock = vi.fn();
const NOT_CONFIGURED = "Payments are not configured. Please try again shortly.";

vi.mock("@/lib/stripe", () => ({
  stripe: {
    checkout: {
      sessions: { create: (...args: unknown[]) => createSessionMock(...args) },
    },
  },
  isStripeConfigured: () => false,
  STRIPE_NOT_CONFIGURED_MESSAGE: NOT_CONFIGURED,
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => ({ ok: true, retryAfter: 0 }),
  clientIp: () => "127.0.0.1",
}));

vi.mock("@/lib/site", () => ({ getSiteOrigin: () => "https://puenpublishing.com" }));

function buildRequest(body: unknown): NextRequest {
  return {
    headers: { get: () => null },
    json: async () => body,
  } as unknown as NextRequest;
}

// A plausible body for each route, so the 503 cannot be mistaken for a
// validation rejection that would have happened anyway.
const routes: Array<[string, () => Promise<{ POST: (r: NextRequest) => Promise<Response> }>, unknown]> = [
  ["retail", () => import("./retail/route"), { quantity: 1 }],
  ["wholesale", () => import("./wholesale/route"), {
    tierId: 1,
    institution: { email: "head@school.test", name: "Test School", contact: "A Head" },
  }],
  ["sponsor", () => import("./sponsor/route"), { scoutToken: "SC-TESTTOKEN" }],
  ["patrol", () => import("./patrol/route"), { email: "parent@example.test" }],
];

describe("every checkout route refuses to run without a real Stripe key", () => {
  beforeEach(() => {
    createSessionMock.mockClear();
  });

  for (const [name, load, body] of routes) {
    it(`${name} returns 503 and never calls Stripe`, async () => {
      const { POST } = await load();
      const res = await POST(buildRequest(body));

      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.error).toBe(NOT_CONFIGURED);

      // The whole point: no session is created, so no customer is ever sent to
      // a Stripe page backed by a placeholder key.
      expect(createSessionMock).not.toHaveBeenCalled();
    });
  }

  it("guide refuses too, though its own closed-for-sale gate answers first", async () => {
    // The Guide is not on sale until the manuscript exists
    // (PARENTS_GUIDE_DIGITAL_LIVE), and that gate sits above the Stripe guard
    // deliberately: "not on sale yet" is the truer answer to a buyer than
    // "payments are not configured". Either way Stripe is never reached.
    const { POST } = await import("./guide/route");
    const res = await POST(buildRequest({ email: "parent@example.test" }));

    expect(res.status).toBe(503);
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it("never leaks any key material in the refusal", async () => {
    const { POST } = await import("./retail/route");
    const res = await POST(buildRequest({ quantity: 1 }));
    const text = JSON.stringify(await res.json());
    expect(text).not.toMatch(/sk_|pk_|whsec_|placeholder/i);
  });
});

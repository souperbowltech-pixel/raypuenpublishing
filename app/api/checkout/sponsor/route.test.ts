import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { DEMO_SCOUT_TOKEN } from "@/lib/family";
import { GRANDPA_SPONSOR_PRICE } from "@/lib/gamification";

const createSessionMock = vi.fn();
const findScoutByShareCodeMock = vi.fn();
const getOrCreateScoutAsyncMock = vi.fn();

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

vi.mock("@/lib/family-store", () => ({
  findScoutByShareCode: (...args: unknown[]) => findScoutByShareCodeMock(...args),
}));

vi.mock("@/lib/scout-store", () => ({
  getOrCreateScoutAsync: (...args: unknown[]) => getOrCreateScoutAsyncMock(...args),
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

describe("POST /api/checkout/sponsor (Grandpa Multiplier $40 checkout)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitOk = true;
    createSessionMock.mockResolvedValue({
      url: "https://checkout.stripe.com/sponsor-test-session",
    });
  });

  it("returns 429 when rate limited", async () => {
    rateLimitOk = false;
    const req = buildRequest({ scoutCode: "GG-234567" });
    const res = await POST(req);

    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toBe("Too many requests");
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it("rejects invalid or missing scout codes with 400", async () => {
    const invalidInputs = [
      {},
      { scoutCode: "" },
      { scoutCode: "INVALID" },
      { scoutCode: "GG-000000" }, // 0 is invalid in share code alphabet
      { scoutCode: null },
    ];

    for (const body of invalidInputs) {
      const req = buildRequest(body);
      const res = await POST(req);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("This sponsor link isn't valid");
      expect(createSessionMock).not.toHaveBeenCalled();
    }
  });

  it("rejects with 400 when share code is well-formed but not found in database", async () => {
    findScoutByShareCodeMock.mockResolvedValueOnce(null);

    const req = buildRequest({ scoutCode: "GG-234567" });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("This sponsor link isn't valid");
    expect(findScoutByShareCodeMock).toHaveBeenCalledWith("GG-234567");
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it("creates a $40 Stripe checkout session when a valid share code matches a registered scout", async () => {
    findScoutByShareCodeMock.mockResolvedValueOnce({
      scoutToken: "scout_real_child_token",
      firstName: "Bobby",
    });

    const req = buildRequest({ scoutCode: "GG-234567" });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.url).toBe("https://checkout.stripe.com/sponsor-test-session");

    expect(createSessionMock).toHaveBeenCalledTimes(1);
    const sessionArgs = createSessionMock.mock.calls[0][0];

    // Price is flat $40 (4000 cents)
    expect(sessionArgs.line_items[0].price_data.unit_amount).toBe(Math.round(GRANDPA_SPONSOR_PRICE * 100));
    expect(sessionArgs.line_items[0].price_data.unit_amount).toBe(4000);

    // Metadata binds order_type and scout credentials
    expect(sessionArgs.metadata).toEqual({
      order_type: "grandpa_sponsorship",
      scout_token: "scout_real_child_token",
      scout_name: "Bobby",
    });

    // Success and cancel URLs return to /sponsor
    expect(sessionArgs.success_url).toContain("/sponsor?done=1&session_id={CHECKOUT_SESSION_ID}");
    expect(sessionArgs.cancel_url).toContain("/sponsor?code=GG-234567");
  });

  it("creates a $40 Stripe checkout session for DEMO_SCOUT_TOKEN preview", async () => {
    getOrCreateScoutAsyncMock.mockResolvedValueOnce({
      scoutName: "Captain Ray Demo",
    });

    const req = buildRequest({ scoutToken: DEMO_SCOUT_TOKEN });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.url).toBe("https://checkout.stripe.com/sponsor-test-session");

    expect(createSessionMock).toHaveBeenCalledTimes(1);
    const sessionArgs = createSessionMock.mock.calls[0][0];
    expect(sessionArgs.metadata).toEqual({
      order_type: "grandpa_sponsorship",
      scout_token: DEMO_SCOUT_TOKEN,
      scout_name: "Captain Ray Demo",
    });
    expect(sessionArgs.cancel_url).toContain(`/sponsor?token=${DEMO_SCOUT_TOKEN}`);
  });

  it("returns 500 when Stripe session creation fails", async () => {
    findScoutByShareCodeMock.mockResolvedValueOnce({
      scoutToken: "scout_real_child_token",
      firstName: "Bobby",
    });
    createSessionMock.mockRejectedValueOnce(new Error("Stripe network timeout"));

    const req = buildRequest({ scoutCode: "GG-234567" });
    const res = await POST(req);

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Unable to initiate sponsorship checkout");
  });
});

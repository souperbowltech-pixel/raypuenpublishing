import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

/**
 * BUG-05 regression tests — sponsor-confirm fallback order recording & sync.
 *
 * The Grandpa sponsorship confirm route (app/api/checkout/sponsor/confirm/route.ts)
 * is called when the sponsor returns to the dashboard to confirm Book 3 unlock.
 * These tests pin the fix from commit 7dad223:
 * - recordOrder is called with order details and stripeSessionId.
 * - markOrder is called with fulfillmentStatus: "fulfilled" on successful unlock save.
 * - markOrder is called with fulfillmentStatus: "failed" when unlock save fails.
 * - addSubscriberToMailerLite is called with customer details and scout token.
 * - Unpaid or mismatched sessions do not write order records.
 */

const retrieveSessionMock = vi.fn();
const recordOrderMock = vi.fn();
const markOrderMock = vi.fn();
const updateScoutAsyncMock = vi.fn();
const alertFailureMock = vi.fn();
const addSubscriberMock = vi.fn();

vi.mock("@/lib/stripe", () => ({
  stripe: {
    checkout: {
      sessions: {
        retrieve: (...args: unknown[]) => retrieveSessionMock(...args),
      },
    },
  },
}));

vi.mock("@/lib/orders", () => ({
  recordOrder: (...args: unknown[]) => recordOrderMock(...args),
  markOrder: (...args: unknown[]) => markOrderMock(...args),
}));

vi.mock("@/lib/scout-store", () => ({
  updateScoutAsync: (...args: unknown[]) => updateScoutAsyncMock(...args),
}));

vi.mock("@/lib/alerts", () => ({
  alertFailure: (...args: unknown[]) => alertFailureMock(...args),
}));

vi.mock("@/lib/mailerlite", () => ({
  addSubscriberToMailerLite: (...args: unknown[]) => addSubscriberMock(...args),
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

const paidSession = {
  id: "cs_test_sponsor_confirm_123",
  payment_status: "paid",
  amount_total: 4000,
  currency: "usd",
  customer_email: "grandpa@example.com",
  customer_details: { email: "grandpa@example.com", name: "Grandpa Joe" },
  metadata: {
    order_type: "grandpa_sponsorship",
    scout_token: "SCOUT-TEST-TOKEN",
  },
};

describe("POST /api/checkout/sponsor/confirm (BUG-05 order recording & sync)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MAILERLITE_RETAIL_GROUP_ID = "ml_group_123";
    recordOrderMock.mockResolvedValue({ ok: true });
    markOrderMock.mockResolvedValue(undefined);
    addSubscriberMock.mockResolvedValue(undefined);
    alertFailureMock.mockResolvedValue(undefined);
  });

  it("records order, marks fulfilled, and syncs MailerLite on successful sponsorship confirmation", async () => {
    retrieveSessionMock.mockResolvedValue(paidSession);
    updateScoutAsyncMock.mockResolvedValue({
      persisted: true,
      state: { scoutName: "Timmy" },
    });

    const req = buildRequest({ session_id: "cs_test_sponsor_confirm_123" });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ success: true, paid: true, scoutName: "Timmy" });

    expect(recordOrderMock).toHaveBeenCalledTimes(1);
    expect(recordOrderMock).toHaveBeenCalledWith({
      stripeSessionId: "cs_test_sponsor_confirm_123",
      orderType: "grandpa_sponsorship",
      customerEmail: "grandpa@example.com",
      customerName: "Grandpa Joe",
      amountTotal: 4000,
      currency: "usd",
      scoutToken: "SCOUT-TEST-TOKEN",
      metadata: paidSession.metadata,
    });

    expect(markOrderMock).toHaveBeenCalledTimes(1);
    expect(markOrderMock).toHaveBeenCalledWith("cs_test_sponsor_confirm_123", {
      fulfillmentStatus: "fulfilled",
      lastError: null,
    });

    expect(addSubscriberMock).toHaveBeenCalledTimes(1);
    expect(addSubscriberMock).toHaveBeenCalledWith({
      email: "grandpa@example.com",
      name: "Grandpa Joe",
      groupId: "ml_group_123",
      fields: {
        order_type: "grandpa_sponsorship",
        scout_token: "SCOUT-TEST-TOKEN",
      },
    });
  });

  it("records order and marks failed when Book 3 unlock does not persist", async () => {
    retrieveSessionMock.mockResolvedValue(paidSession);
    updateScoutAsyncMock.mockResolvedValue({
      persisted: false,
      error: "Supabase connection refused",
      state: { scoutName: "Timmy" },
    });

    const req = buildRequest({ session_id: "cs_test_sponsor_confirm_123" });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({
      success: true,
      paid: true,
      unlockPending: true,
      scoutName: "Timmy",
    });

    expect(recordOrderMock).toHaveBeenCalledTimes(1);
    expect(markOrderMock).toHaveBeenCalledTimes(1);
    expect(markOrderMock).toHaveBeenCalledWith("cs_test_sponsor_confirm_123", {
      fulfillmentStatus: "failed",
      lastError: "Supabase connection refused",
    });

    expect(alertFailureMock).toHaveBeenCalledTimes(1);
    expect(addSubscriberMock).not.toHaveBeenCalled();
  });

  it("does not record order when session is not paid", async () => {
    retrieveSessionMock.mockResolvedValue({
      ...paidSession,
      payment_status: "unpaid",
    });

    const req = buildRequest({ session_id: "cs_test_sponsor_confirm_123" });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ success: false, paid: false });

    expect(recordOrderMock).not.toHaveBeenCalled();
    expect(updateScoutAsyncMock).not.toHaveBeenCalled();
    expect(markOrderMock).not.toHaveBeenCalled();
    expect(addSubscriberMock).not.toHaveBeenCalled();
  });

  it("rejects with 400 when session order_type is not grandpa_sponsorship", async () => {
    retrieveSessionMock.mockResolvedValue({
      ...paidSession,
      metadata: { order_type: "retail", scout_token: "SCOUT-TEST-TOKEN" },
    });

    const req = buildRequest({ session_id: "cs_test_sponsor_confirm_123" });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Not a valid sponsorship session.");

    expect(recordOrderMock).not.toHaveBeenCalled();
    expect(updateScoutAsyncMock).not.toHaveBeenCalled();
  });
});

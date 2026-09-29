import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * The route that moves money — and the last CRITICAL gap left by the audit
 * (TEST-01). Until now nothing tested it, including the two rules that cost
 * real money if they break:
 *
 *  - an unsigned event is never processed;
 *  - an unlock that did not reach the database must NOT mark an order fulfilled,
 *    because Stripe then stops retrying and a paid $40 sponsorship is lost
 *    (this is BUG-01, and this file is its regression test).
 */

const stripeMock = { webhooks: { constructEvent: vi.fn() } };
const recordOrder = vi.fn();
const markOrder = vi.fn();
const updateScoutAsync = vi.fn();
const createPatrolLeader = vi.fn();
const sendPatrolReceipt = vi.fn();
const addSubscriberToMailerLite = vi.fn();
const alertFailure = vi.fn();

vi.mock("@/lib/stripe", () => ({ stripe: stripeMock }));
vi.mock("@/lib/orders", () => ({
  recordOrder: (...a: unknown[]) => recordOrder(...a),
  markOrder: (...a: unknown[]) => markOrder(...a),
}));
vi.mock("@/lib/scout-store", () => ({ updateScoutAsync: (...a: unknown[]) => updateScoutAsync(...a) }));
vi.mock("@/lib/patrol-store", () => ({ createPatrolLeader: (...a: unknown[]) => createPatrolLeader(...a) }));
vi.mock("@/lib/notifications", () => ({ sendPatrolReceipt: (...a: unknown[]) => sendPatrolReceipt(...a) }));
vi.mock("@/lib/mailerlite", () => ({
  addSubscriberToMailerLite: (...a: unknown[]) => addSubscriberToMailerLite(...a),
}));
vi.mock("@/lib/alerts", () => ({ alertFailure: (...a: unknown[]) => alertFailure(...a) }));
vi.mock("@/lib/supabase", () => ({ isProduction: false }));

const { POST } = await import("@/app/api/webhooks/stripe/route");

type SessionOverrides = Record<string, unknown>;

const session = (over: SessionOverrides = {}) => ({
  id: "cs_test_webhook_1",
  amount_total: 4000,
  currency: "usd",
  customer_details: { email: "buyer@example.com", name: "A Buyer" },
  metadata: { order_type: "retail" },
  ...over,
});

const post = (signature: string | null = "t=1,v1=signed") =>
  POST({
    text: async () => "{}",
    headers: { get: (name: string) => (name === "stripe-signature" ? signature : null) },
  } as never);

beforeEach(() => {
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  vi.clearAllMocks();
  recordOrder.mockResolvedValue({ ok: true });
  markOrder.mockResolvedValue(undefined);
  updateScoutAsync.mockResolvedValue({ state: {}, persisted: true });
  createPatrolLeader.mockResolvedValue({ leader: {}, token: "PT-1", giftCodes: ["GP-1", "GP-2", "GP-3"] });
  sendPatrolReceipt.mockResolvedValue({ sent: true, id: "msg_1" });
  addSubscriberToMailerLite.mockResolvedValue({ data: { id: "sub_1" } });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.STRIPE_WEBHOOK_SECRET;
});

describe("nothing is processed without a valid signature", () => {
  it("refuses a request with no signature header", async () => {
    const res = await post(null);
    expect(res.status).toBe(400);
    expect(recordOrder).not.toHaveBeenCalled();
  });

  it("refuses an event whose signature does not verify", async () => {
    stripeMock.webhooks.constructEvent.mockImplementation(() => {
      throw new Error("No signatures found matching the expected signature");
    });
    const res = await post();
    expect(res.status).toBe(400);
    expect(recordOrder).not.toHaveBeenCalled();
  });

  it("refuses to run at all when no signing secret is configured", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const res = await post();
    expect(res.status).toBe(500);
    expect(stripeMock.webhooks.constructEvent).not.toHaveBeenCalled();
    expect(recordOrder).not.toHaveBeenCalled();
  });
});

describe("a paid order is always recorded first", () => {
  beforeEach(() => {
    stripeMock.webhooks.constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: session() },
    });
  });

  it("records the order and answers 200", async () => {
    const res = await post();
    expect(res.status).toBe(200);
    expect(recordOrder).toHaveBeenCalledWith(
      expect.objectContaining({ stripeSessionId: "cs_test_webhook_1", orderType: "retail" })
    );
  });

  it("asks Stripe to retry when the order could not be saved", async () => {
    recordOrder.mockResolvedValue({ ok: false, skipped: false, error: "connection refused" });
    const res = await post();
    expect(res.status).toBe(500);
    expect(alertFailure).toHaveBeenCalled();
  });

  it("ignores an event type it does not handle", async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue({ type: "payment_intent.created", data: { object: {} } });
    const res = await post();
    expect(res.status).toBe(200);
    expect(recordOrder).not.toHaveBeenCalled();
  });
});

describe("a Book 3 unlock that did not save must not close the order (BUG-01)", () => {
  const sponsorship = (scoutToken = "SCOUT-TOKEN-1") => ({
    type: "checkout.session.completed",
    data: {
      object: session({ metadata: { order_type: "grandpa_sponsorship", scout_token: scoutToken } }),
    },
  });

  it("returns 500 and marks the order failed when the write did not persist", async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue(sponsorship());
    updateScoutAsync.mockResolvedValue({ state: {}, persisted: false, error: "row missing" });

    const res = await post();

    expect(res.status).toBe(500);
    expect(markOrder).toHaveBeenCalledWith(
      "cs_test_webhook_1",
      expect.objectContaining({ fulfillmentStatus: "failed" })
    );
    expect(markOrder).not.toHaveBeenCalledWith(
      "cs_test_webhook_1",
      expect.objectContaining({ fulfillmentStatus: "fulfilled" })
    );
  });

  it("marks it fulfilled only when the unlock really persisted", async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue(sponsorship());
    updateScoutAsync.mockResolvedValue({ state: {}, persisted: true });

    const res = await post();

    expect(res.status).toBe(200);
    expect(markOrder).toHaveBeenCalledWith(
      "cs_test_webhook_1",
      expect.objectContaining({ fulfillmentStatus: "fulfilled" })
    );
  });

  it("never unlocks for a scout token that is not token-shaped", async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue(sponsorship("../../etc/passwd"));
    const res = await post();
    expect(updateScoutAsync).not.toHaveBeenCalled();
    expect(markOrder).toHaveBeenCalledWith(
      "cs_test_webhook_1",
      expect.objectContaining({ fulfillmentStatus: "failed" })
    );
    expect(res.status).toBe(200);
  });

  it("survives the unlock throwing, and still does not close the order", async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue(sponsorship());
    updateScoutAsync.mockRejectedValue(new Error("supabase exploded"));

    const res = await post();

    expect(res.status).toBe(500);
    expect(markOrder).not.toHaveBeenCalledWith(
      "cs_test_webhook_1",
      expect.objectContaining({ fulfillmentStatus: "fulfilled" })
    );
  });
});

describe("the $10 Patrol", () => {
  const patrolEvent = {
    type: "checkout.session.completed",
    data: { object: session({ metadata: { order_type: "patrol_bundle" } }) },
  };

  beforeEach(() => stripeMock.webhooks.constructEvent.mockReturnValue(patrolEvent));

  it("creates the Patrol and emails the buyer their link and codes", async () => {
    await post();
    expect(createPatrolLeader).toHaveBeenCalledWith("buyer@example.com", "cs_test_webhook_1");
    expect(sendPatrolReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ to: "buyer@example.com", token: "PT-1", giftCodes: ["GP-1", "GP-2", "GP-3"] })
    );
  });

  it("keeps the order fulfilled when only the email failed", async () => {
    // The success page shows the same link, so a missing email is not a missing
    // Patrol — but it must still raise an alert rather than pass silently.
    sendPatrolReceipt.mockResolvedValue({ sent: false, reason: "not-configured" });
    const res = await post();

    expect(res.status).toBe(200);
    expect(markOrder).toHaveBeenCalledWith(
      "cs_test_webhook_1",
      expect.objectContaining({ fulfillmentStatus: "fulfilled" })
    );
    expect(alertFailure).toHaveBeenCalled();
  });

  it("asks Stripe to retry when the Patrol itself could not be created", async () => {
    createPatrolLeader.mockResolvedValue(null);
    const res = await post();
    expect(res.status).toBe(500);
    expect(sendPatrolReceipt).not.toHaveBeenCalled();
  });

  it("never writes the patrol token to the log", async () => {
    const logged: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args) => void logged.push(args.join(" ")));
    await post();
    expect(logged.join("\n")).not.toContain("PT-1");
  });
});

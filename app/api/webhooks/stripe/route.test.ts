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
const sendBookOrderNotice = vi.fn();
const addSubscriberToMailerLite = vi.fn();
const alertFailure = vi.fn();
// The order's notice columns as the database keeps them: a live claim, then a sent time.
const noticeClaims = new Set<string>();
const noticesSent = new Set<string>();
let claimAvailable = true;
let markSentOk = true;

vi.mock("@/lib/stripe", () => ({
  // The routes now refuse to run on the build-time placeholder key.
  isStripeConfigured: () => true,
  STRIPE_NOT_CONFIGURED_MESSAGE: "Payments are not configured. Please try again shortly.", stripe: stripeMock }));
vi.mock("@/lib/orders", () => ({
  recordOrder: (...a: unknown[]) => recordOrder(...a),
  markOrder: (...a: unknown[]) => markOrder(...a),
  claimOrderNotice: async (id: string) => {
    if (!claimAvailable) return "unavailable";
    if (noticesSent.has(id)) return "already-sent";
    if (noticeClaims.has(id)) return "in-progress";
    noticeClaims.add(id);
    return "claimed";
  },
  markOrderNoticeSent: async (id: string) => {
    if (!markSentOk) return false;
    noticesSent.add(id);
    noticeClaims.delete(id);
    return true;
  },
  releaseOrderNotice: async (id: string) => {
    noticeClaims.delete(id);
    return true;
  },
}));
vi.mock("@/lib/scout-store", () => ({ updateScoutAsync: (...a: unknown[]) => updateScoutAsync(...a) }));
vi.mock("@/lib/patrol-store", () => ({ createPatrolLeader: (...a: unknown[]) => createPatrolLeader(...a) }));
vi.mock("@/lib/notifications", async (importActual) => ({
  shippingFromSession: (await importActual<typeof import("@/lib/notifications")>()).shippingFromSession,
  sendPatrolReceipt: (...a: unknown[]) => sendPatrolReceipt(...a),
  sendBookOrderNotice: (...a: unknown[]) => sendBookOrderNotice(...a),
}));
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
  sendBookOrderNotice.mockResolvedValue({ sent: true, id: "msg_2" });
  noticeClaims.clear();
  noticesSent.clear();
  claimAvailable = true;
  markSentOk = true;
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

describe("a paid book order reaches Ray, since nothing prints by itself yet", () => {
  const bookOrder = (over: SessionOverrides = {}) => ({
    type: "checkout.session.completed",
    data: {
      object: session({
        amount_total: 2998,
        metadata: { channel: "retail", sku: "PUEN-CB-001", quantity: "2" },
        collected_information: {
          shipping_details: {
            name: "Grace Miller",
            address: { line1: "12 Elm St", line2: null, city: "Austin", state: "TX", postal_code: "78701", country: "US" },
          },
        },
        ...over,
      }),
    },
  });

  it("emails Ray the copies, the buyer and where to ship", async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue(bookOrder());
    const res = await post();
    expect(res.status).toBe(200);
    expect(sendBookOrderNotice).toHaveBeenCalledTimes(1);
    expect(sendBookOrderNotice).toHaveBeenCalledWith({
      sessionId: "cs_test_webhook_1",
      sku: "PUEN-CB-001",
      quantity: 2,
      unitAmount: 1499,
      amountTotal: 2998,
      currency: "usd",
      buyerName: "A Buyer",
      buyerEmail: "buyer@example.com",
      shipTo: { recipient: "Grace Miller", street: "12 Elm St", city: "Austin", state: "TX", zip: "78701", country: "US" },
    });
  });

  it("sends one email when Stripe delivers the same order twice, so nothing is printed twice", async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue(bookOrder());
    expect((await post()).status).toBe(200);
    expect((await post()).status).toBe(200);
    expect(sendBookOrderNotice).toHaveBeenCalledTimes(1);
  });

  it("waits for the retry when the order could not be saved", async () => {
    recordOrder.mockResolvedValue({ ok: false, skipped: false, error: "connection refused" });
    stripeMock.webhooks.constructEvent.mockReturnValue(bookOrder());
    expect((await post()).status).toBe(500);
    expect(sendBookOrderNotice).not.toHaveBeenCalled();
  });

  it("still emails when there is no database to save to", async () => {
    recordOrder.mockResolvedValue({ ok: false, skipped: true });
    stripeMock.webhooks.constructEvent.mockReturnValue(bookOrder());
    expect((await post()).status).toBe(200);
    expect(sendBookOrderNotice).toHaveBeenCalledTimes(1);
  });

  it("gives the claim back, notes it on the order and asks Stripe to retry when the email failed", async () => {
    sendBookOrderNotice.mockResolvedValueOnce({ sent: false, reason: "timeout" });
    stripeMock.webhooks.constructEvent.mockReturnValue(bookOrder());
    expect((await post()).status).toBe(500);
    expect(markOrder).toHaveBeenCalledWith("cs_test_webhook_1", { lastError: "Order email to Ray not sent: timeout" });
    expect(alertFailure).toHaveBeenCalledWith("Book order paid but the order email to Ray did not go out", {
      session: "cs_test_webhook_1",
      reason: "timeout",
    });

    // Stripe's retry: the claim was given back, so this time it goes.
    expect((await post()).status).toBe(200);
    expect(sendBookOrderNotice).toHaveBeenCalledTimes(2);
  });

  it("does not retry a failure no retry can fix, so the webhook is not failed for days", async () => {
    const permanent = [
      { reason: "not-configured" },
      { reason: "invalid-recipient" },
      { reason: "rejected", error: "HTTP 403: The send.puenpublishing.com domain is not verified" },
      { reason: "rejected", error: "HTTP 422: Invalid from field" },
    ];
    for (const failure of permanent) {
      noticeClaims.clear();
      sendBookOrderNotice.mockResolvedValueOnce({ sent: false, ...failure });
      stripeMock.webhooks.constructEvent.mockReturnValue(bookOrder());
      expect((await post()).status).toBe(200);
      expect(markOrder).toHaveBeenCalledWith("cs_test_webhook_1", {
        lastError: `Order email to Ray not sent: ${failure.reason}`,
      });
    }
  });

  it("retries a failure that may pass: a timeout, a busy or failing Resend", async () => {
    const transient = [
      { reason: "timeout" },
      { reason: "error" },
      { reason: "rejected", error: "HTTP 429: Too many requests" },
      { reason: "rejected", error: "HTTP 503: Service unavailable" },
    ];
    for (const failure of transient) {
      noticeClaims.clear();
      sendBookOrderNotice.mockResolvedValueOnce({ sent: false, ...failure });
      stripeMock.webhooks.constructEvent.mockReturnValue(bookOrder());
      expect((await post()).status).toBe(500);
    }
  });

  it("leaves the email to the delivery that is already sending it, and asks Stripe to come back", async () => {
    // Another delivery holds a live claim (or died holding one, until it lapses).
    noticeClaims.add("cs_test_webhook_1");
    stripeMock.webhooks.constructEvent.mockReturnValue(bookOrder());
    expect((await post()).status).toBe(500);
    expect(sendBookOrderNotice).not.toHaveBeenCalled();

    // Once the claim is gone, the next retry sends.
    noticeClaims.clear();
    expect((await post()).status).toBe(200);
    expect(sendBookOrderNotice).toHaveBeenCalledTimes(1);
  });

  it("says so when the email went but could not be marked as sent", async () => {
    markSentOk = false;
    stripeMock.webhooks.constructEvent.mockReturnValue(bookOrder());
    expect((await post()).status).toBe(200);
    expect(alertFailure).toHaveBeenCalledWith(
      "Book order emailed to Ray, but not marked as sent: a redelivery could email it again",
      { session: "cs_test_webhook_1" }
    );
  });

  it("treats an email that throws like one that failed", async () => {
    sendBookOrderNotice.mockRejectedValueOnce(new Error("boom"));
    stripeMock.webhooks.constructEvent.mockReturnValue(bookOrder());
    expect((await post()).status).toBe(500);
    expect(noticeClaims.size).toBe(0);
  });

  it("sends anyway when the claim cannot be checked, and does not retry a failure it cannot undo", async () => {
    claimAvailable = false;
    stripeMock.webhooks.constructEvent.mockReturnValue(bookOrder());
    expect((await post()).status).toBe(200);
    expect(sendBookOrderNotice).toHaveBeenCalledTimes(1);

    sendBookOrderNotice.mockResolvedValueOnce({ sent: false, reason: "rejected" });
    expect((await post()).status).toBe(200);
    expect(alertFailure).toHaveBeenCalledWith(
      "Book order paid but the order email to Ray did not go out",
      expect.objectContaining({ reason: "rejected" })
    );
  });

  it("reads the address where older Stripe API versions put it", async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue(
      bookOrder({
        collected_information: undefined,
        shipping_details: { name: "Old Version", address: { line1: "1 Oak", city: "Reno", state: "NV", postal_code: "89501", country: "US" } },
      })
    );
    await post();
    expect(sendBookOrderNotice).toHaveBeenCalledWith(
      expect.objectContaining({ shipTo: expect.objectContaining({ recipient: "Old Version", street: "1 Oak" }) })
    );
  });

  it("passes on a missing address and a missing buyer email as missing", async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue(
      bookOrder({ collected_information: undefined, customer_details: null, customer_email: null })
    );
    await post();
    expect(sendBookOrderNotice).toHaveBeenCalledWith(expect.objectContaining({ shipTo: null, buyerEmail: null }));
  });

  it("passes a quantity that is not a plain number on as unknown rather than guessing", async () => {
    for (const quantity of ["2abc", "two", "-1", ""]) {
      noticeClaims.clear();
      noticesSent.clear();
      sendBookOrderNotice.mockClear();
      stripeMock.webhooks.constructEvent.mockReturnValue(bookOrder({ metadata: { channel: "retail", sku: "PUEN-CB-001", quantity } }));
      await post();
      expect(sendBookOrderNotice).toHaveBeenCalledWith(expect.objectContaining({ quantity: null }));
    }
  });

  it("sends no print email for a paid session the retail checkout did not make, and says so", async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue(bookOrder({ metadata: {} }));
    expect((await post()).status).toBe(200);
    expect(sendBookOrderNotice).not.toHaveBeenCalled();
    expect(alertFailure).toHaveBeenCalledWith("Paid session not recognised: no order email was sent", {
      session: "cs_test_webhook_1",
    });
  });

  it("sends no book email for orders that are not printed books", async () => {
    for (const orderType of ["guide_digital", "institutional_sponsorship", "patrol_bundle", "grandpa_sponsorship"]) {
      stripeMock.webhooks.constructEvent.mockReturnValue(bookOrder({ metadata: { order_type: orderType } }));
      await post();
    }
    expect(sendBookOrderNotice).not.toHaveBeenCalled();
  });
});

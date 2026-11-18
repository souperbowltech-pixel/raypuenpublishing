import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  sendPatrolReceipt,
  sendGuideApprovalRequest,
  approvalRecipient,
  formatAddress,
  sendBookOrderNotice,
  shippingFromSession,
} from "@/lib/notifications";
import { publisherBrand } from "@/lib/book";

/**
 * What these two messages must contain, because somebody is stuck without it:
 * the parent cannot re-enter their Patrol without the hub link, and Ray cannot
 * release a printed Guide without the approve link.
 */

const KEY = "re_test_key_not_real";
let fetchMock: ReturnType<typeof vi.fn>;

const sentBody = () => JSON.parse(fetchMock.mock.calls[0][1].body);

beforeEach(() => {
  process.env.RESEND_API_KEY = KEY;
  process.env.EMAIL_FROM = "Puen Publishing <hello@send.puenpublishing.com>";
  process.env.NEXT_PUBLIC_SITE_URL = "https://puenpublishing.com";
  fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ id: "msg_1" }),
    text: async () => '{"id":"msg_1"}',
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  delete process.env.ADMIN_EMAIL;
});

const address = {
  recipient: "Caroline Adeyemi",
  street: "14 Fern Hollow Road",
  city: "Yucaipa",
  state: "CA",
  zip: "92399",
  country: "USA",
};

describe("the Patrol receipt", () => {
  it("carries the hub link the parent cannot get back in without", async () => {
    await sendPatrolReceipt({ to: "parent@example.com", token: "PT-ABC123", giftCodes: ["GP-AAA111-1"] });
    expect(sentBody().text).toContain("/dashboard/patrol?token=PT-ABC123");
  });

  it("lists every gift code they paid for", async () => {
    await sendPatrolReceipt({
      to: "parent@example.com",
      token: "PT-ABC123",
      giftCodes: ["GP-AAA111-1", "GP-AAA111-2", "GP-AAA111-3"],
    });
    const { text } = sentBody();
    expect(text).toContain("GP-AAA111-1");
    expect(text).toContain("GP-AAA111-2");
    expect(text).toContain("GP-AAA111-3");
  });

  it("warns that the link is the keys to their Patrol", async () => {
    await sendPatrolReceipt({ to: "parent@example.com", token: "PT-ABC123", giftCodes: [] });
    expect(sentBody().text).toContain("keep this link");
  });

  it("escapes a token so it survives being a URL", async () => {
    await sendPatrolReceipt({ to: "parent@example.com", token: "PT ABC/123", giftCodes: [] });
    expect(sentBody().text).toContain("PT%20ABC%2F123");
  });

  it("reports honestly when email is not set up", async () => {
    delete process.env.RESEND_API_KEY;
    const result = await sendPatrolReceipt({ to: "parent@example.com", token: "PT-A", giftCodes: [] });
    expect(result).toEqual({ sent: false, reason: "not-configured" });
  });
});

describe("the free-Guide approval request", () => {
  const claim = {
    patrolLeaderEmail: "leader@example.com",
    recipientName: "Caroline Adeyemi",
    shippingAddress: address,
    approvalToken: "AP-XYZ789",
  };

  it("carries both the approve and the decline link", async () => {
    await sendGuideApprovalRequest(claim);
    const { text } = sentBody();
    expect(text).toContain("/api/admin/approve-guide?token=AP-XYZ789&action=approve");
    expect(text).toContain("/api/admin/approve-guide?token=AP-XYZ789&action=reject");
  });

  it("says plainly that nothing ships until he presses one", async () => {
    await sendGuideApprovalRequest(claim);
    expect(sentBody().text).toContain("Nothing is printed or posted until you press one of these");
  });

  it("gives him the address to send it to", async () => {
    await sendGuideApprovalRequest(claim);
    const { text } = sentBody();
    expect(text).toContain("14 Fern Hollow Road");
    expect(text).toContain("Yucaipa, CA, 92399");
  });

  it("replies to the parent who claimed it", async () => {
    await sendGuideApprovalRequest(claim);
    expect(sentBody().reply_to).toBe("leader@example.com");
  });

  it("goes to the publisher's inbox unless an admin address is configured", async () => {
    expect(approvalRecipient()).toBe(publisherBrand.imprint.email);
    process.env.ADMIN_EMAIL = "ray@example.com";
    expect(approvalRecipient()).toBe("ray@example.com");
  });
});

describe("formatAddress", () => {
  it("lays the address out as it would be written on the parcel", () => {
    expect(formatAddress(address)).toBe(
      "Caroline Adeyemi\n14 Fern Hollow Road\nYucaipa, CA, 92399\nUSA"
    );
  });

  it("leaves out the parts that are missing rather than printing blanks", () => {
    expect(formatAddress({ recipient: "A", street: "B", city: "C", state: "", zip: "" })).toBe("A\nB\nC");
  });
});

describe("shippingFromSession", () => {
  const details = {
    name: "Grace Miller",
    address: { line1: "12 Elm St", line2: "Apt 4", city: "Austin", state: "TX", postal_code: "78701", country: "US" },
  };

  it("reads the address where newer Stripe versions put it", () => {
    expect(shippingFromSession({ collected_information: { shipping_details: details } })).toEqual({
      recipient: "Grace Miller",
      street: "12 Elm St, Apt 4",
      city: "Austin",
      state: "TX",
      zip: "78701",
      country: "US",
    });
  });

  it("falls back to where older Stripe versions put it", () => {
    expect(shippingFromSession({ shipping_details: details })?.street).toBe("12 Elm St, Apt 4");
  });

  it("answers null when Checkout collected no address", () => {
    expect(shippingFromSession({})).toBeNull();
    expect(shippingFromSession({ collected_information: { shipping_details: { name: "X", address: null } } })).toBeNull();
  });
});

describe("the book order email to Ray", () => {
  const order = {
    sessionId: "cs_live_abc123",
    sku: "PUEN-CB-001",
    title: "The Adventures of Geezy Goober, Volume 1: The Search for the Magic Pen",
    quantity: 2,
    unitAmount: 1499,
    amountTotal: 2998,
    currency: "usd",
    buyerName: "Grace Miller",
    buyerEmail: "Grace@Example.com",
    shipTo: address,
  };

  it("tells him what to print, how many and where to send it", async () => {
    await sendBookOrderNotice(order);
    const body = sentBody();
    expect(body.subject).toBe("New book order: 2 copies for Caroline Adeyemi");
    expect(body.text).toContain("IngramSpark");
    expect(body.text).toContain("Copies: 2");
    expect(body.text).toContain("Paid: $29.98 USD");
    expect(body.text).toContain("Buyer: Grace Miller, grace@example.com");
    expect(body.text).toContain(formatAddress(address));
    expect(body.text).toContain("Order reference: cs_live_abc123");
    expect(body.text).toContain("A paid order for The Adventures of Geezy Goober, Volume 1: The Search for the Magic Pen (PUEN-CB-001)");
    // A send that timed out here but reached Resend is not sent twice by the retry.
    expect(fetchMock.mock.calls[0][1].headers["Idempotency-Key"]).toBe("book-order/cs_live_abc123");
    expect(body.text).not.toContain("does not match");
  });

  it("names the book that was bought, so Ray prints the right one", async () => {
    await sendBookOrderNotice({ ...order, sku: "PUEN-NC-001", title: "The Neighborhood Chronicles, Book 1: David and Goliath" });
    expect(sentBody().text).toContain("A paid order for The Neighborhood Chronicles, Book 1: David and Goliath (PUEN-NC-001)");
  });

  it("warns him before printing when the amount paid does not match the copies", async () => {
    await sendBookOrderNotice({ ...order, quantity: 50 });
    expect(sentBody().text).toContain("Please check this order in Stripe before printing");
  });

  it("never lets a line break in a name or address start a line of its own", async () => {
    await sendBookOrderNotice({
      ...order,
      buyerName: "Eve\nCopies: 50",
      shipTo: { ...address, recipient: "Eve\u2028Ship to: elsewhere", street: "1 Main St\r\nCopies: 50" },
    });
    const lines: string[] = sentBody().text.split("\n");
    expect(lines.filter((line) => line.startsWith("Copies:"))).toEqual(["Copies: 2"]);
    expect(lines.filter((line) => line.startsWith("Ship to:"))).toEqual(["Ship to:"]);
    expect(sentBody().text).toContain("1 Main St Copies: 50");
  });

  it("goes to the publisher's inbox unless an admin address is configured", async () => {
    await sendBookOrderNotice(order);
    expect(sentBody().to).toBe(publisherBrand.imprint.email);
    process.env.ADMIN_EMAIL = "ray@example.com";
    fetchMock.mockClear();
    await sendBookOrderNotice(order);
    expect(sentBody().to).toBe("ray@example.com");
  });

  it("lets him reply straight to the buyer", async () => {
    await sendBookOrderNotice(order);
    expect(sentBody().reply_to).toBe("grace@example.com");
  });

  it("says plainly what is missing instead of printing blanks", async () => {
    await sendBookOrderNotice({ ...order, quantity: null, amountTotal: null, buyerEmail: "not an email", buyerName: null, shipTo: null });
    const body = sentBody();
    expect(body.text).toContain("Copies: not given, please check the order in Stripe");
    expect(body.text).toContain("Paid: not given by Stripe");
    expect(body.text).toContain("Buyer: not given by Stripe");
    expect(body.text).toContain("No address was collected");
    expect(body.reply_to).toBeUndefined();
    expect(body.subject).toBe("New book order: ? copies");
  });

  it("keeps a line break in the buyer's name out of the subject line", async () => {
    await sendBookOrderNotice({ ...order, quantity: 1, shipTo: { ...address, recipient: "Eve\r\nBcc: x@evil.test" } });
    const subject: string = sentBody().subject;
    expect(subject).not.toMatch(/[\r\n]/);
    expect(subject).toBe("New book order: 1 copy for Eve Bcc: x@evil.test");
  });

  it("reports honestly when email is not set up", async () => {
    delete process.env.RESEND_API_KEY;
    const result = await sendBookOrderNotice(order);
    expect(result.sent).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

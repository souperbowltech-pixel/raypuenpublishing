import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  sendPatrolReceipt,
  sendGuideApprovalRequest,
  approvalRecipient,
  formatAddress,
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

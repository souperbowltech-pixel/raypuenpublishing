import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendEmail, emailConfigured, redactEmail } from "@/lib/email";

/**
 * The one rule: a message counts as sent only when Resend says so.
 *
 * Every other outcome — no key, a bad address, a timeout, a rejection, a 200
 * with no id — must come back as `sent: false` with a reason the caller can act
 * on, because a caller that believes a failed email was delivered will tell a
 * customer their download is on its way when it is not.
 */

const KEY = "re_test_key_not_real";
const FROM = "Puen Publishing <hello@send.puenpublishing.com>";

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.RESEND_API_KEY = KEY;
  process.env.EMAIL_FROM = FROM;
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
});

const ok = (id = "49a3999c-0ce1-4ea6-ab68-afcd6dc2e794") => ({
  ok: true,
  status: 200,
  json: async () => ({ id }),
  text: async () => JSON.stringify({ id }),
});

const message = { to: "parent@example.com", subject: "Your Patrol", text: "Hello" };

describe("emailConfigured", () => {
  it("needs both the key and the from address", () => {
    expect(emailConfigured()).toBe(true);
    delete process.env.EMAIL_FROM;
    expect(emailConfigured()).toBe(false);
    process.env.EMAIL_FROM = FROM;
    delete process.env.RESEND_API_KEY;
    expect(emailConfigured()).toBe(false);
  });
});

describe("sendEmail", () => {
  it("reports sent only with the id Resend returns", async () => {
    fetchMock.mockResolvedValue(ok("abc-123"));
    await expect(sendEmail(message)).resolves.toEqual({ sent: true, id: "abc-123" });
  });

  it("posts to Resend with the bearer token and the configured sender", async () => {
    fetchMock.mockResolvedValue(ok());
    await sendEmail(message);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe(`Bearer ${KEY}`);
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ from: FROM, to: "parent@example.com", subject: "Your Patrol", text: "Hello" });
  });

  it("can send under another name from the same configured address", async () => {
    fetchMock.mockResolvedValue(ok());
    await sendEmail({ ...message, fromName: "Ray's Office" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).from).toBe(`"Ray's Office" <hello@send.puenpublishing.com>`);
  });

  it("uses a bare configured address as it is when renaming the sender", async () => {
    process.env.EMAIL_FROM = "hello@send.puenpublishing.com";
    fetchMock.mockResolvedValue(ok());
    await sendEmail({ ...message, fromName: "Puen Publishing" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).from).toBe(`"Puen Publishing" <hello@send.puenpublishing.com>`);
  });

  it("keeps a sender name from adding headers or a second address", async () => {
    fetchMock.mockResolvedValue(ok());
    await sendEmail({ ...message, fromName: 'Evil\r\nBcc: x@evil.example <"a@b.example">' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).from).toBe(
      `"Evil Bcc: x@evil.example a@b.example" <hello@send.puenpublishing.com>`
    );
  });

  it("keeps commas, colons and brackets inside one quoted name", async () => {
    fetchMock.mockResolvedValue(ok());
    await sendEmail({ ...message, fromName: "Smith, Ray (Office); a@b" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).from).toBe(
      `"Smith, Ray (Office); a@b" <hello@send.puenpublishing.com>`
    );
  });

  it("renames a configured sender whose own name is quoted", async () => {
    process.env.EMAIL_FROM = `"Quoted, Name" <hello@send.puenpublishing.com>`;
    fetchMock.mockResolvedValue(ok());
    await sendEmail({ ...message, fromName: "Puen Publishing" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).from).toBe(`"Puen Publishing" <hello@send.puenpublishing.com>`);
  });

  it("sends a configured sender it cannot read unchanged, rather than rebuilding it", async () => {
    process.env.EMAIL_FROM = "Name hello@send.puenpublishing.com";
    fetchMock.mockResolvedValue(ok());
    await sendEmail({ ...message, fromName: "Puen Publishing" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).from).toBe("Name hello@send.puenpublishing.com");
  });

  it("falls back to the configured sender when the name is blank", async () => {
    fetchMock.mockResolvedValue(ok());
    await sendEmail({ ...message, fromName: "   " });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).from).toBe(FROM);
  });

  it("does not send at all when it is not configured", async () => {
    delete process.env.RESEND_API_KEY;
    await expect(sendEmail(message)).resolves.toEqual({ sent: false, reason: "not-configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses an address that is not one, before calling out", async () => {
    const result = await sendEmail({ ...message, to: "not-an-address" });
    expect(result).toMatchObject({ sent: false, reason: "invalid-recipient" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats a rejection as a failure, and keeps the reason", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => '{"message":"domain is not verified"}',
      json: async () => ({ message: "domain is not verified" }),
    });
    const result = await sendEmail(message);
    expect(result.sent).toBe(false);
    expect(result).toMatchObject({ reason: "rejected" });
    expect((result as { error?: string }).error).toContain("domain is not verified");
  });

  it("treats a 200 with no id as a failure, not a send", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}), text: async () => "{}" });
    await expect(sendEmail(message)).resolves.toMatchObject({ sent: false, reason: "rejected" });
  });

  it("reports a timeout as a timeout", async () => {
    fetchMock.mockImplementation(() => {
      const err = new Error("The operation was aborted");
      err.name = "AbortError";
      return Promise.reject(err);
    });
    await expect(sendEmail(message)).resolves.toMatchObject({ sent: false, reason: "timeout" });
  });

  it("survives the network failing", async () => {
    fetchMock.mockRejectedValue(new Error("getaddrinfo ENOTFOUND"));
    await expect(sendEmail(message)).resolves.toMatchObject({ sent: false, reason: "error" });
  });

  it("never lets the API key escape in a result", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => `unauthorized for ${KEY}`,
      json: async () => ({}),
    });
    const result = await sendEmail(message);
    // The body is echoed back for diagnosis, so prove the key cannot ride along.
    expect(JSON.stringify(result)).not.toContain(KEY);
  });
});

describe("redactEmail", () => {
  it("keeps the domain and hides the person", () => {
    expect(redactEmail("caroline@example.com")).toBe("c***@example.com");
  });

  it("does not pretend a non-address is one", () => {
    expect(redactEmail("nonsense")).toBe("(invalid)");
    expect(redactEmail("@example.com")).toBe("(invalid)");
  });
});

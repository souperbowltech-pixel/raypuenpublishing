import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addSubscriberToMailerLite } from "./mailerlite";

const request = vi.fn<typeof fetch>();
const logs = () => JSON.stringify([
  vi.mocked(console.log).mock.calls,
  vi.mocked(console.warn).mock.calls,
  vi.mocked(console.error).mock.calls,
]);

beforeEach(() => {
  request.mockReset();
  vi.stubGlobal("fetch", request);
  vi.stubEnv("MAILERLITE_API_KEY", "test-key");
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("MailerLite email log privacy", () => {
  it.each([
    ["caroline@example.com", "c***@example.com"],
    [" Reader@Example.com ", "r***@example.com"],
    ["a@example.com", "a***@example.com"],
    [`${"a".repeat(240)}@example.com`, "a***@example.com"],
  ])("redacts a successful sync for %s while sending the full address to the API", async (email, redacted) => {
    const data = { data: { id: "subscriber-1" } };
    request.mockResolvedValue(Response.json(data));

    expect(await addSubscriberToMailerLite({ email })).toEqual(data);
    expect(request).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(request.mock.calls[0][1]?.body))).toEqual({
      email: email.trim().toLowerCase(), status: "active",
    });
    expect(console.log).toHaveBeenCalledWith(
      `[MailerLite] Subscriber synced successfully: ${redacted} (ID: subscriber-1)`
    );
    expect(logs()).not.toContain(email.trim().toLowerCase());
    expect(logs()).not.toContain(email);
  });

  it("also redacts success after retrying rejected custom fields", async () => {
    request.mockResolvedValueOnce(Response.json({ message: "Unknown field" }, { status: 422 }))
      .mockResolvedValueOnce(Response.json({ data: { id: "subscriber-2" } }));
    expect(await addSubscriberToMailerLite({ email: "reader@example.com", fields: { source: "order" } }))
      .toEqual({ data: { id: "subscriber-2" } });
    expect(request).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(request.mock.calls[1][1]?.body))).toEqual({
      email: "reader@example.com", status: "active",
    });
    expect(console.log).toHaveBeenCalledWith(
      "[MailerLite] Subscriber synced successfully: r***@example.com (ID: subscriber-2)"
    );
    expect(logs()).not.toContain("reader@example.com");
  });

  it.each([
    ["", "(none)"],
    ["not-an-email", "(invalid)"],
    ["reader@example", "r***@example"],
    [`private ${"x".repeat(250)}@example.com`, "p***@example.com"],
  ])(
    "rejects invalid input without logging the supplied value %#", async (email, redacted) => {
      expect(await addSubscriberToMailerLite({ email })).toBeNull();
      expect(request).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        "[MailerLite] Invalid email address, skipping sync:",
        redacted
      );
      if (email) expect(logs()).not.toContain(email);
    }
  );

  it("does not log success when the API rejects the subscriber", async () => {
    request.mockResolvedValue(Response.json({ message: "Unavailable" }, { status: 503 }));
    expect(await addSubscriberToMailerLite({ email: "reader@example.com" })).toEqual({ message: "Unavailable" });
    expect(console.log).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith("[MailerLite API Error]:", 503, { message: "Unavailable" });
    expect(logs()).not.toContain("reader@example.com");
  });

  it("returns null and logs failure when the connection fails", async () => {
    request.mockRejectedValue(new Error("Connection failed"));
    expect(await addSubscriberToMailerLite({ email: "reader@example.com" })).toBeNull();
    expect(console.log).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith("[MailerLite] Network error:", expect.any(Error));
    expect(logs()).not.toContain("reader@example.com");
  });

  it("does not send or log an address when the API key is missing", async () => {
    vi.stubEnv("MAILERLITE_API_KEY", "");
    expect(await addSubscriberToMailerLite({ email: "reader@example.com" })).toBeNull();
    expect(request).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith("[MailerLite] MAILERLITE_API_KEY is not configured.");
    expect(logs()).not.toContain("reader@example.com");
  });
});

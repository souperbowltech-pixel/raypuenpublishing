import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { alertFailure } from "./alerts";

const sendEmailMock = vi.fn();
let emailConfiguredMock = false;

vi.mock("@/lib/email", () => ({
  sendEmail: (...args: unknown[]) => sendEmailMock(...args),
  emailConfigured: () => emailConfiguredMock,
}));

vi.mock("@/lib/notifications", () => ({
  approvalRecipient: () => "admin@puenpublishing.com",
}));

describe("alertFailure (OPS-05 structured alerting and email fallback)", () => {
  const originalEnv = process.env.ALERT_WEBHOOK_URL;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    emailConfiguredMock = false;
    delete process.env.ALERT_WEBHOOK_URL;
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    if (originalEnv !== undefined) {
      process.env.ALERT_WEBHOOK_URL = originalEnv;
    } else {
      delete process.env.ALERT_WEBHOOK_URL;
    }
  });

  it("always logs the alert context and details to console.error", async () => {
    await alertFailure("Something failed", { orderId: "ord_123", amount: 40 });

    expect(consoleErrorSpy).toHaveBeenCalledWith("[ALERT] Something failed", {
      orderId: "ord_123",
      amount: 40,
    });
  });

  it("delivers alert via webhook POST when ALERT_WEBHOOK_URL is configured", async () => {
    process.env.ALERT_WEBHOOK_URL = "https://hooks.slack.com/services/TEST/WEBHOOK";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    try {
      await alertFailure("Critical DB failure", { table: "scout_profiles", code: "500" });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe("https://hooks.slack.com/services/TEST/WEBHOOK");
      expect(options.method).toBe("POST");
      expect(options.headers).toEqual({ "Content-Type": "application/json" });

      const parsedBody = JSON.parse(options.body);
      expect(parsedBody.text).toContain("🚨 Puen Publishing — Critical DB failure");
      expect(parsedBody.text).toContain("• table: scout_profiles");
      expect(parsedBody.text).toContain("• code: 500");

      // When webhook succeeds, email fallback is not used
      expect(sendEmailMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("swallows webhook fetch failures without throwing into the request path", async () => {
    process.env.ALERT_WEBHOOK_URL = "https://hooks.slack.com/services/TEST/WEBHOOK";
    const fetchMock = vi.fn().mockRejectedValue(new Error("Connection refused"));
    vi.stubGlobal("fetch", fetchMock);

    try {
      await expect(alertFailure("Network failure")).resolves.toBeUndefined();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[ALERT] Failed to deliver alert webhook:",
        expect.any(Error)
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("falls back to alert email when ALERT_WEBHOOK_URL is unset and email is configured", async () => {
    delete process.env.ALERT_WEBHOOK_URL;
    emailConfiguredMock = true;
    sendEmailMock.mockResolvedValueOnce({ sent: true, id: "email_msg_123" });

    await alertFailure("Webhook missing failure", { reason: "timeout", service: "Supabase" });

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const emailArgs = sendEmailMock.mock.calls[0][0];
    expect(emailArgs.to).toBe("admin@puenpublishing.com");
    expect(emailArgs.subject).toBe("🚨 Puen Publishing Alert — Webhook missing failure");
    expect(emailArgs.text).toContain("Context: Webhook missing failure");
    expect(emailArgs.text).toContain("• reason: timeout");
    expect(emailArgs.text).toContain("• service: Supabase");
  });

  it("swallows alert email delivery errors without throwing", async () => {
    delete process.env.ALERT_WEBHOOK_URL;
    emailConfiguredMock = true;
    sendEmailMock.mockRejectedValueOnce(new Error("SMTP failure"));

    await expect(alertFailure("Email failure test")).resolves.toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[ALERT] Failed to deliver alert email:",
      expect.any(Error)
    );
  });

  it("quietly no-ops further delivery when neither webhook nor email is configured", async () => {
    delete process.env.ALERT_WEBHOOK_URL;
    emailConfiguredMock = false;

    await expect(alertFailure("No transports available")).resolves.toBeUndefined();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});

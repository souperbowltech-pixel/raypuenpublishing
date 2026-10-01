import { sendEmail, emailConfigured } from "@/lib/email";
import { approvalRecipient } from "@/lib/notifications";

/**
 * Failure alerting for revenue-critical server paths (Stripe webhook, etc.).
 *
 * Always logs to the server console. When ALERT_WEBHOOK_URL is set, also POSTs a
 * `{ text }` payload — the format Slack, Discord (via /slack) and most incident
 * tools accept — so a paid order that fails to process is never silent.
 *
 * When ALERT_WEBHOOK_URL is unset, falls back to transactional email to the administrator
 * (via lib/notifications and lib/email) if email is configured.
 */
export async function alertFailure(
  context: string,
  detail: Record<string, unknown> = {}
): Promise<void> {
  console.error(`[ALERT] ${context}`, detail);

  const lines = Object.entries(detail).map(([k, v]) => `• ${k}: ${String(v)}`);
  const url = process.env.ALERT_WEBHOOK_URL;

  if (url) {
    try {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: [`🚨 Puen Publishing — ${context}`, ...lines].join("\n") }),
      });
    } catch (err) {
      // Alerting must never throw into the request path.
      console.error("[ALERT] Failed to deliver alert webhook:", err);
    }
    return;
  }

  if (emailConfigured()) {
    try {
      await sendEmail({
        to: approvalRecipient(),
        subject: `🚨 Puen Publishing Alert — ${context}`,
        text: [`🚨 Puen Publishing Failure Alert`, "", `Context: ${context}`, ...lines].join("\n"),
      });
    } catch (err) {
      console.error("[ALERT] Failed to deliver alert email:", err);
    }
  }
}

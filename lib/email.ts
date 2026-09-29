import { normalizeEmail } from "@/lib/family";

/**
 * One-to-one transactional email.
 *
 * Four promises in this product are broken only for want of this: the Parent's
 * Guide download, the Patrol receipt, Ray's free-guide approval, and signing in
 * on a second device. MailerLite sends newsletters and cannot do any of them.
 *
 * Sent through Resend's HTTP API directly rather than its SDK — one POST with a
 * bearer token needs no new dependency, and calling `fetch` ourselves is the
 * only way to put a deadline on it.
 *
 * The rule this module exists to keep: **never report an email as sent unless
 * Resend accepted it.** Three separate faults in this project have been some
 * version of "reported success without asking", and an email nobody receives is
 * the same fault wearing a different hat.
 */

export type EmailResult =
  | { sent: true; id: string }
  | { sent: false; reason: EmailFailure; error?: string };

export type EmailFailure =
  | "not-configured" // no API key or no from address — expected in local dev
  | "invalid-recipient"
  | "timeout"
  | "rejected" // Resend answered, and said no
  | "error"; // network or anything unforeseen

export interface EmailMessage {
  to: string;
  subject: string;
  /** Always send a text part: some readers never render the HTML one. */
  text: string;
  html?: string;
  replyTo?: string;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const TIMEOUT_MS = 8_000;

/** True when both the key and the sending address are present. */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

/**
 * An address safe to put in a log: the domain, and the first character only.
 * A child's family address must never be written out in full (AUDIT SEC-05).
 */
export function redactEmail(address: string): string {
  const at = address.lastIndexOf("@");
  if (at < 1) return "(invalid)";
  return `${address[0]}***${address.slice(at)}`;
}

/**
 * Remove anything key-shaped from text that came back from the provider.
 *
 * An error body is quoted into the result and the log so a failure can be
 * diagnosed, and an authentication error is exactly the case where the provider
 * may echo the credential back at us. Diagnostics must never become a way for a
 * secret to reach a log file.
 */
function scrubSecrets(text: string, apiKey: string): string {
  return text.split(apiKey).join("re_***").replace(/re_[A-Za-z0-9_-]{8,}/g, "re_***");
}

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    // Local dev and any deployment where email is not set up yet. Deliberately
    // not an error: the caller decides whether that is acceptable.
    return { sent: false, reason: "not-configured" };
  }

  const recipient = normalizeEmail(message.to);
  if (!recipient.ok) {
    return { sent: false, reason: "invalid-recipient", error: recipient.error };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: recipient.value,
        subject: message.subject,
        text: message.text,
        ...(message.html ? { html: message.html } : {}),
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      // Read the body for the reason, but never let it carry the key back out.
      let detail = `HTTP ${response.status}`;
      try {
        const body = await response.text();
        if (body) detail = `HTTP ${response.status}: ${scrubSecrets(body, apiKey).slice(0, 300)}`;
      } catch {
        // the status alone is enough to act on
      }
      console.error(`[email] Resend rejected a message to ${redactEmail(recipient.value)}: ${detail}`);
      return { sent: false, reason: "rejected", error: detail };
    }

    const data = (await response.json()) as { id?: string };
    if (!data?.id) {
      // A 200 with no id is not a send. Treat it as a failure, not a success.
      return { sent: false, reason: "rejected", error: "Resend returned no message id" };
    }

    return { sent: true, id: data.id };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    const detail = scrubSecrets(err instanceof Error ? err.message : String(err), apiKey);
    console.error(
      `[email] could not send to ${redactEmail(recipient.value)}: ${aborted ? `timed out after ${TIMEOUT_MS}ms` : detail}`
    );
    return { sent: false, reason: aborted ? "timeout" : "error", error: detail };
  } finally {
    clearTimeout(timer);
  }
}

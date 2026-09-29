import { sendEmail, type EmailResult } from "@/lib/email";
import { getSiteOrigin } from "@/lib/site";
import { publisherBrand } from "@/lib/book";
import type { ShippingAddress } from "@/lib/patrol-store";

/**
 * The two messages this product cannot work without.
 *
 * Both exist because something real was unreachable: a parent who paid $10 could
 * only find their Patrol if they kept the checkout page open, and a completed
 * Patrol reached Ray nowhere at all — the approval link went into a log.
 *
 * Every function here returns the send result unchanged. A caller that wants to
 * tell somebody "we have emailed you" has to look at it first.
 */

/** Where a free-printed-Guide claim goes for approval. */
export function approvalRecipient(): string {
  return process.env.ADMIN_EMAIL || publisherBrand.imprint.email;
}

export interface PatrolReceipt {
  to: string;
  token: string;
  giftCodes: string[];
}

/**
 * The buyer's copy of their own Patrol: the hub link and the three gift codes.
 *
 * Sent in plain words. The parent reading it is not technical, and the only
 * thing they must not lose is the link.
 */
export async function sendPatrolReceipt({ to, token, giftCodes }: PatrolReceipt): Promise<EmailResult> {
  const hubUrl = `${getSiteOrigin()}/dashboard/patrol?token=${encodeURIComponent(token)}`;
  const codes = giftCodes.map((code, i) => `  ${i + 1}. ${code}`).join("\n");

  const text = [
    "Thank you for starting a Chief Scout Patrol.",
    "",
    "Your Patrol hub — keep this link, it is the only way back in:",
    hubUrl,
    "",
    "Your three gift invitations:",
    codes,
    "",
    "Give one code to each of three families. When a family registers with their",
    "code and confirms their own email, your Patrol shows them as joined. Once all",
    "three have joined, your free printed Parent's Guide can be claimed from the",
    "same page.",
    "",
    "Anyone holding your hub link can open your Patrol, so keep it to yourself.",
    "",
    publisherBrand.fullCredit,
  ].join("\n");

  return sendEmail({
    to,
    subject: "Your Chief Scout Patrol — your link and your three gift codes",
    text,
  });
}

export interface GuideApprovalRequest {
  patrolLeaderEmail: string;
  recipientName: string;
  shippingAddress: ShippingAddress;
  approvalToken: string;
}

/** The address as it would be written on the parcel, one line per line. */
export function formatAddress(address: ShippingAddress): string {
  return [
    address.recipient,
    address.street,
    [address.city, address.state, address.zip].filter(Boolean).join(", "),
    address.country,
  ]
    .filter((line) => line && line.trim())
    .join("\n");
}

/**
 * Ray's one-click approval. Nothing ships until he presses it, which is half of
 * the anti-fraud rule he chose (option C), so this message is the whole gate.
 */
export async function sendGuideApprovalRequest({
  patrolLeaderEmail,
  recipientName,
  shippingAddress,
  approvalToken,
}: GuideApprovalRequest): Promise<EmailResult> {
  const origin = getSiteOrigin();
  const approveUrl = `${origin}/api/admin/approve-guide?token=${encodeURIComponent(approvalToken)}&action=approve`;
  const rejectUrl = `${origin}/api/admin/approve-guide?token=${encodeURIComponent(approvalToken)}&action=reject`;

  const text = [
    "A Chief Scout Patrol has reached three of three families, and the free",
    "printed Parent's Guide is waiting for your approval.",
    "",
    `Patrol Leader: ${patrolLeaderEmail}`,
    `Send the Guide to: ${recipientName}`,
    "Address:",
    formatAddress(shippingAddress),
    "",
    "Approve and queue it for printing:",
    approveUrl,
    "",
    "Decline it:",
    rejectUrl,
    "",
    "Nothing is printed or posted until you press one of these.",
    "",
    publisherBrand.fullCredit,
  ].join("\n");

  return sendEmail({
    to: approvalRecipient(),
    subject: `Free Parent's Guide claim to approve — ${recipientName}`,
    text,
    replyTo: patrolLeaderEmail,
  });
}

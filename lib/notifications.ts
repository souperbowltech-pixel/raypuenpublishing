import { sendEmail, type EmailResult } from "@/lib/email";
import { getSiteOrigin } from "@/lib/site";
import { book1, publisherBrand } from "@/lib/book";
import { normalizeEmail } from "@/lib/family";
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

/**
 * The address block of a Checkout Session. Newer Stripe API versions put it
 * under collected_information, older ones on the session itself.
 */
interface StripeShipping {
  name?: string | null;
  address?: {
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    country?: string | null;
  } | null;
}

/** Where the buyer asked for the book to go, or null when Checkout collected none. */
export function shippingFromSession(session: {
  collected_information?: { shipping_details?: StripeShipping | null } | null;
  shipping_details?: StripeShipping | null;
}): ShippingAddress | null {
  const details = session.collected_information?.shipping_details ?? session.shipping_details;
  const address = details?.address;
  if (!details || !address) return null;
  return {
    recipient: details.name ?? "",
    street: [address.line1, address.line2].filter(Boolean).join(", "),
    city: address.city ?? "",
    state: address.state ?? "",
    zip: address.postal_code ?? "",
    country: address.country ?? undefined,
  };
}

export interface BookOrderNotice {
  sessionId: string;
  sku: string;
  quantity: number | null;
  /** What one copy cost at checkout, in cents, to check the amount against. */
  unitAmount: number;
  amountTotal: number | null;
  currency: string | null;
  buyerName?: string | null;
  buyerEmail?: string | null;
  shipTo: ShippingAddress | null;
}

/** Money as the buyer saw it: 2998 usd becomes "$29.98 USD". The shop sells in dollars only. */
function formatPaid(amountTotal: number | null, currency: string | null): string {
  if (amountTotal === null || !Number.isFinite(amountTotal)) return "not given by Stripe";
  const code = (currency || "usd").toUpperCase();
  return code === "USD" ? `$${(amountTotal / 100).toFixed(2)} USD` : `${amountTotal} ${code} (Stripe's smallest unit)`;
}

/**
 * One line of text. Ray acts on this email, so a line break typed into a name
 * or an address must not start a line of its own, such as a second "Copies:".
 */
function oneLine(text: string | null | undefined): string {
  return (text ?? "").replace(/[\r\n\t\u000B\u000C\u0085\u2028\u2029]+/g, " ").trim();
}

/**
 * Ray's copy of a paid book order. Nothing is printed by itself yet
 * (PRINT_FULFILLMENT_LIVE is off), so this email is how an order reaches the
 * printer: Ray places it at IngramSpark and ships it to the address here.
 */
export async function sendBookOrderNotice(order: BookOrderNotice): Promise<EmailResult> {
  const copies = order.quantity && order.quantity > 0 ? order.quantity : null;
  const buyerEmail = normalizeEmail(order.buyerEmail);
  const buyer = [oneLine(order.buyerName), buyerEmail.ok ? buyerEmail.value : ""].filter(Boolean).join(", ");
  const shipTo = order.shipTo && {
    recipient: oneLine(order.shipTo.recipient),
    street: oneLine(order.shipTo.street),
    city: oneLine(order.shipTo.city),
    state: oneLine(order.shipTo.state),
    zip: oneLine(order.shipTo.zip),
    country: oneLine(order.shipTo.country) || undefined,
  };
  const amountMatches =
    copies !== null && order.amountTotal !== null && order.amountTotal === copies * order.unitAmount;

  const text = [
    `A paid order for ${book1.title} (${oneLine(order.sku)}) has come in.`,
    "",
    "Books are not sent to the printer automatically yet. Please place this order",
    "at IngramSpark and have it shipped to the address below.",
    "",
    `Copies: ${copies ?? "not given, please check the order in Stripe"}`,
    `Paid: ${formatPaid(order.amountTotal, order.currency)}`,
    ...(amountMatches
      ? []
      : ["Please check this order in Stripe before printing: the amount paid does not match the copies at the book's price."]),
    `Buyer: ${buyer || "not given by Stripe"}`,
    "",
    "Ship to:",
    shipTo ? formatAddress(shipTo) : "No address was collected. Please check the order in Stripe.",
    "",
    `Order reference: ${oneLine(order.sessionId)}`,
    "",
    publisherBrand.fullCredit,
  ].join("\n");

  const recipient = shipTo?.recipient ?? "";
  const subject = `New book order: ${copies ?? "?"} ${copies === 1 ? "copy" : "copies"}${recipient ? ` for ${recipient}` : ""}`;

  return sendEmail({
    to: approvalRecipient(),
    subject: subject.slice(0, 150),
    text,
    fromName: "Puen Publishing",
    idempotencyKey: `book-order/${order.sessionId}`,
    ...(buyerEmail.ok ? { replyTo: buyerEmail.value } : {}),
  });
}

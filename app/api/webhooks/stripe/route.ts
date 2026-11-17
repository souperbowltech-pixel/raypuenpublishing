import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { addSubscriberToMailerLite } from "@/lib/mailerlite";
import { updateScoutAsync } from "@/lib/scout-store";
import { recordOrder, markOrder, claimOrderNotice, markOrderNoticeSent, releaseOrderNotice } from "@/lib/orders";
import { BOOK_1_SKU } from "@/lib/checkout";
import { RETAIL_PRICE } from "@/lib/pricing";
import { alertFailure } from "@/lib/alerts";
import { isProduction } from "@/lib/supabase";
import { createPatrolLeader } from "@/lib/patrol-store";
import { sendBookOrderNotice, sendPatrolReceipt, shippingFromSession } from "@/lib/notifications";
import { redactEmail, redactToken } from "@/lib/redact";

const TOKEN_REGEX = /^[A-Za-z0-9_-]{3,64}$/;

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // Require a configured signing secret — never trust an unsigned event.
  if (!webhookSecret) {
    console.error("[Stripe Webhook] STRIPE_WEBHOOK_SECRET is not configured.");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: any;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return NextResponse.json({ error: "Webhook signature failed" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const customerEmail = session.customer_details?.email || session.customer_email;
    const customerName = session.customer_details?.name || undefined;
    const orderType = session.metadata?.order_type || "retail";

    console.log(`[Stripe Webhook] Order completed: ${session.id} (${orderType}) for ${redactEmail(customerEmail)}`);

    const grandpaToken =
      orderType === "grandpa_sponsorship" && TOKEN_REGEX.test(session.metadata?.scout_token || "")
        ? (session.metadata.scout_token as string)
        : null;

    // Steps that must succeed for Stripe to stop retrying (all are idempotent).
    let retryNeeded = false;

    // 1. Persist the paid order first so no order can be lost.
    const recorded = await recordOrder({
      stripeSessionId: session.id,
      orderType,
      customerEmail,
      customerName,
      amountTotal: session.amount_total,
      currency: session.currency,
      scoutToken: grandpaToken,
      metadata: session.metadata || {},
    });
    if (!recorded.ok && recorded.skipped && isProduction) {
      // No database on the live site: don't make Stripe retry forever, but say so.
      await alertFailure("Paid order not saved: database not configured on the live site", {
        session: session.id,
        orderType,
        email: redactEmail(customerEmail),
      });
    }
    if (!recorded.ok && !recorded.skipped) {
      retryNeeded = true;
      await alertFailure("Paid order could not be saved", {
        session: session.id,
        orderType,
        email: redactEmail(customerEmail),
        error: recorded.error,
      });
    }

    // 1b. A printed book: nothing goes to the printer by itself yet, so Ray
    // gets the order by email and places it at IngramSpark. Only the retail
    // checkout's own session counts: any other paid session without an
    // order_type (a payment link, say) would otherwise read as a print order.
    if (orderType === "retail" && (recorded.ok || recorded.skipped)) {
      if (session.metadata?.channel !== "retail" || session.metadata?.sku !== BOOK_1_SKU) {
        await alertFailure("Paid session not recognised: no order email was sent", { session: session.id });
      } else if (!(await sendBookNoticeOnce(session, customerName, customerEmail, recorded.ok))) {
        retryNeeded = true;
      }
    }

    // 2. Grandpa multiplier: a confirmed $40 sponsorship unlocks Book 3 for the
    // scout named in the session metadata (independent of the peer 700 track).
    if (orderType === "grandpa_sponsorship") {
      if (grandpaToken) {
        try {
          const result = await updateScoutAsync(grandpaToken, { book3Sponsored: true });
          if (!result.persisted) {
            // The unlock did not reach the database. Never mark this order
            // fulfilled — return non-2xx so Stripe retries (every step is
            // idempotent) and leave the order visible as unfinished.
            retryNeeded = true;
            await markOrder(session.id, {
              fulfillmentStatus: "failed",
              lastError: result.error || "Book 3 unlock was not saved",
            });
            await alertFailure("Grandpa sponsorship paid but Book 3 unlock was not saved", {
              session: session.id,
              email: redactEmail(customerEmail),
              error: result.error,
            });
          } else {
            console.log(`[Grandpa Sponsor] Book 3 unlocked for scout ${redactToken(grandpaToken)}`);
            await markOrder(session.id, { fulfillmentStatus: "fulfilled", lastError: null });
          }
        } catch (err: any) {
          retryNeeded = true;
          await markOrder(session.id, { fulfillmentStatus: "failed", lastError: String(err?.message || err) });
          await alertFailure("Grandpa sponsorship paid but Book 3 unlock failed", {
            session: session.id,
            scoutToken: redactToken(grandpaToken),
            email: redactEmail(customerEmail),
            error: err?.message || err,
          });
        }
      } else {
        await markOrder(session.id, { fulfillmentStatus: "failed", lastError: "Missing/invalid scout_token" });
        await alertFailure("Grandpa sponsorship paid but scout_token is missing/invalid", {
          session: session.id,
          email: redactEmail(customerEmail),
        });
      }
    }

    // 2b. Patrol bundle: $10 creates Patrol Leader record with 3 gift codes
    if (orderType === "patrol_bundle" && customerEmail) {
      try {
        const patrol = await createPatrolLeader(customerEmail, session.id);
        if (patrol) {
          // The token is deliberately not logged: a log line is enough to open
          // somebody's Patrol (AUDIT SEC-05).
          console.log(`[Patrol Webhook] Created a patrol leader for session ${session.id}`);
          await markOrder(session.id, { fulfillmentStatus: "fulfilled", lastError: null });

          // The buyer's copy. The checkout success page shows the same link, so
          // a failure here costs them the email, not the Patrol — which is why
          // the order stays fulfilled either way.
          const receipt = await sendPatrolReceipt({
            to: customerEmail,
            token: patrol.token,
            giftCodes: patrol.giftCodes,
          });
          if (!receipt.sent) {
            await alertFailure("Patrol created but the receipt email did not go out", {
              session: session.id,
              reason: receipt.reason,
            });
          }
        } else {
          retryNeeded = true;
          await markOrder(session.id, { fulfillmentStatus: "failed", lastError: "Patrol leader creation failed" });
        }
      } catch (err: any) {
        retryNeeded = true;
        await markOrder(session.id, { fulfillmentStatus: "failed", lastError: String(err?.message || err) });
        await alertFailure("Patrol bundle paid but patrol leader creation failed", {
          session: session.id,
          email: redactEmail(customerEmail),
          error: err?.message || err,
        });
      }
    }

    // 2c. Digital Guide purchase fulfillment
    if (orderType === "guide_digital") {
      await markOrder(session.id, { fulfillmentStatus: "fulfilled", lastError: null });
    }

    // 3. Auto-sync buyer to MailerLite (alert-only: a retry can't fix a bad key/field).
    if (customerEmail) {
      const isWholesale = orderType === "institutional_sponsorship";
      const groupId = isWholesale
        ? process.env.MAILERLITE_INSTITUTION_GROUP_ID
        : process.env.MAILERLITE_RETAIL_GROUP_ID;

      const synced = await addSubscriberToMailerLite({
        email: customerEmail,
        name: customerName,
        groupId: groupId || undefined,
        fields: {
          order_type: orderType,
          stripe_session_id: session.id,
        },
      });
      if (process.env.MAILERLITE_API_KEY && !synced?.data?.id) {
        await alertFailure("MailerLite sync failed for a paid order", {
          session: session.id,
          email: redactEmail(customerEmail),
        });
      }
    }

    // Non-2xx makes Stripe retry the event with backoff; everything above is idempotent.
    if (retryNeeded) {
      return NextResponse.json({ error: "Order processing incomplete; retry" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}

/**
 * Whether a retry could fix a failed send. Missing settings, a bad recipient
 * and a 4xx from Resend (unverified domain, revoked key, bad sender) fail the
 * same way every time, and retrying them would fail the whole webhook for
 * Stripe's three-day retry window, which can get the endpoint disabled.
 */
function emailFailureIsTransient(reason: string, error?: string): boolean {
  if (reason === "timeout" || reason === "error") return true;
  if (reason !== "rejected") return false;
  const status = Number(/^HTTP (\d{3})/.exec(error ?? "")?.[1]);
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

/**
 * Email Ray one paid book order, once. A redelivered event upserts the same
 * order row, so the order's notice columns decide who sends: a delivery takes
 * a short claim first, and the sent time is written only after Resend
 * accepted the email, so a duplicate email can never become a duplicate print
 * run. A claim from a delivery that died lapses by itself (NOTICE_LEASE_MS),
 * so the email is delayed, never lost. Returns false when Stripe should retry.
 * If the claim cannot be checked (migration not run, database down), the
 * email goes anyway: a possible duplicate is better than an order nobody hears
 * about.
 */
async function sendBookNoticeOnce(
  session: any,
  customerName: string | undefined,
  customerEmail: string | null | undefined,
  saved: boolean
): Promise<boolean> {
  const claim = saved ? await claimOrderNotice(session.id) : "unavailable";
  if (claim === "already-sent") return true;
  // Another delivery is sending right now; if it fails, this retry finds the claim lapsed.
  if (claim === "in-progress") return false;

  const rawQuantity = String(session.metadata?.quantity ?? "");
  let sent = false;
  let reason = "error";
  let detail: string | undefined;
  try {
    const notice = await sendBookOrderNotice({
      sessionId: session.id,
      sku: BOOK_1_SKU,
      quantity: /^\d+$/.test(rawQuantity) ? Number(rawQuantity) : null,
      unitAmount: Math.round(RETAIL_PRICE * 100),
      amountTotal: session.amount_total ?? null,
      currency: session.currency ?? null,
      buyerName: customerName,
      buyerEmail: customerEmail,
      shipTo: shippingFromSession(session),
    });
    sent = notice.sent;
    if (!notice.sent) {
      reason = notice.reason;
      detail = notice.error;
    }
  } catch (err) {
    console.error("[Stripe Webhook] Order email threw:", err);
  }

  if (sent) {
    if (claim === "claimed" && !(await markOrderNoticeSent(session.id))) {
      await alertFailure("Book order emailed to Ray, but not marked as sent: a redelivery could email it again", {
        session: session.id,
      });
    }
    return true;
  }

  if (claim === "claimed") await releaseOrderNotice(session.id);
  if (saved) await markOrder(session.id, { lastError: `Order email to Ray not sent: ${reason}` });
  await alertFailure("Book order paid but the order email to Ray did not go out", { session: session.id, reason });
  // Retry only what a retry can fix, and only when this delivery held the
  // claim: without one, a retry could send twice.
  return claim !== "claimed" || !emailFailureIsTransient(reason, detail);
}

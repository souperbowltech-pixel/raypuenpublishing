import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { addSubscriberToMailerLite } from "@/lib/mailerlite";
import { updateScoutAsync } from "@/lib/scout-store";
import { recordOrder, markOrder } from "@/lib/orders";
import { alertFailure } from "@/lib/alerts";
import { isProduction } from "@/lib/supabase";

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

    console.log(`[Stripe Webhook] Order completed: ${session.id} (${orderType}) for ${customerEmail}`);

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
        email: customerEmail,
      });
    }
    if (!recorded.ok && !recorded.skipped) {
      retryNeeded = true;
      await alertFailure("Paid order could not be saved", {
        session: session.id,
        orderType,
        email: customerEmail,
        error: recorded.error,
      });
    }

    // 2. Grandpa multiplier: a confirmed $40 sponsorship unlocks Book 3 for the
    // scout named in the session metadata (independent of the peer 700 track).
    if (orderType === "grandpa_sponsorship") {
      if (grandpaToken) {
        try {
          await updateScoutAsync(grandpaToken, { book3Sponsored: true });
          console.log(`[Grandpa Sponsor] Book 3 unlocked for scout ${grandpaToken}`);
          await markOrder(session.id, { fulfillmentStatus: "fulfilled", lastError: null });
        } catch (err: any) {
          retryNeeded = true;
          await markOrder(session.id, { fulfillmentStatus: "failed", lastError: String(err?.message || err) });
          await alertFailure("Grandpa sponsorship paid but Book 3 unlock failed", {
            session: session.id,
            scoutToken: grandpaToken,
            email: customerEmail,
            error: err?.message || err,
          });
        }
      } else {
        await markOrder(session.id, { fulfillmentStatus: "failed", lastError: "Missing/invalid scout_token" });
        await alertFailure("Grandpa sponsorship paid but scout_token is missing/invalid", {
          session: session.id,
          email: customerEmail,
        });
      }
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
          email: customerEmail,
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

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;

  try {
    if (webhookSecret && signature) {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } else {
      // In development / sandbox before webhook secret is configured
      event = JSON.parse(body) as Stripe.Event;
      // eslint-disable-next-line no-console
      console.warn(
        "[Stripe Webhook] Warning: Processing webhook without signature verification (STRIPE_WEBHOOK_SECRET not set)."
      );
    }
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error(`[Stripe Webhook Signature Error]: ${err.message}`);
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    );
  }

  // Handle successful checkout
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    // eslint-disable-next-line no-console
    console.log("✅ [Stripe Webhook] Payment received successfully!");
    // eslint-disable-next-line no-console
    console.log("Order details:", {
      id: session.id,
      customerEmail: session.customer_details?.email,
      customerName: session.customer_details?.name,
      amountTotal: session.amount_total ? session.amount_total / 100 : 0,
      currency: session.currency,
      shippingAddress:
        (session as any).shipping_details?.address ||
        session.customer_details?.address,
    });

    // NOTE: This is where Lulu API print job and MailerLite email sync hook in
  }

  return NextResponse.json({ received: true });
}

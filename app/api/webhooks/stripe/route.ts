import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { addSubscriberToMailerLite } from "@/lib/mailerlite";

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

    // Auto-sync buyer to MailerLite
    if (customerEmail) {
      const isWholesale = orderType === "institutional_sponsorship";
      const groupId = isWholesale
        ? process.env.MAILERLITE_INSTITUTION_GROUP_ID
        : process.env.MAILERLITE_RETAIL_GROUP_ID;

      await addSubscriberToMailerLite({
        email: customerEmail,
        name: customerName,
        groupId: groupId || undefined,
        fields: {
          order_type: orderType,
          stripe_session_id: session.id,
        },
      });
      console.log(`[MailerLite] Subscriber synced: ${customerEmail} to group ${groupId}`);
    }
  }

  return NextResponse.json({ received: true });
}

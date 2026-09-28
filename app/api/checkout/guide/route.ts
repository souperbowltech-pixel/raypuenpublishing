import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { PARENTS_GUIDE_DIGITAL_PRICE, PARENTS_GUIDE_DIGITAL_LIVE } from "@/lib/pricing";
import { publisherBrand } from "@/lib/book";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { getSiteOrigin } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // Closed until the Guide can actually be delivered (see PARENTS_GUIDE_DIGITAL_LIVE).
  // Enforced here and not only on the page, because a hidden button is not a rule.
  if (!PARENTS_GUIDE_DIGITAL_LIVE) {
    return NextResponse.json(
      { error: "The digital Parent's Guide is not on sale yet." },
      { status: 503 }
    );
  }

  const limit = rateLimit(`checkout-guide:${clientIp(request)}`, 10, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  try {
    const origin = getSiteOrigin();

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Parent's Guide & Teacher's Master Manual (Digital Edition)",
              description:
                "Instant Digital Download: Master curriculum, virtue lessons, and companion guide for The Geezy Goober.",
            },
            unit_amount: Math.round(PARENTS_GUIDE_DIGITAL_PRICE * 100), // $29.97 -> 2997 cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      metadata: {
        channel: "guide_digital",
        order_type: "guide_digital",
      },
      custom_text: {
        submit: { message: publisherBrand.fullCredit },
      },
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/guide`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[Guide Checkout Error]:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}

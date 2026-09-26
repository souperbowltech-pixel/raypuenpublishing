import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { PARENTS_GUIDE_DIGITAL_PRICE } from "@/lib/pricing";
import { publisherBrand } from "@/lib/book";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const limit = rateLimit(`checkout-guide:${clientIp(request)}`, 10, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  try {
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      request.headers.get("origin") ||
      "https://puenpublishing.com";

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

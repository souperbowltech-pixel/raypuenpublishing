import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { PATROL_BUNDLE_PRICE } from "@/lib/pricing";
import { publisherBrand } from "@/lib/book";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const limit = rateLimit(`checkout-patrol:${clientIp(request)}`, 10, 60_000);
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
              name: "Chief Scout Patrol Leader Bundle",
              description:
                "3 Gift Explorer Memberships for friends + Free Printed Parent's Guide upon 3 registrations.",
            },
            unit_amount: Math.round(PATROL_BUNDLE_PRICE * 100), // $10.00 -> 1000 cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      metadata: {
        channel: "patrol_bundle",
        order_type: "patrol_bundle",
      },
      custom_text: {
        submit: { message: publisherBrand.fullCredit },
      },
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/guide`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[Patrol Checkout Error]:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}

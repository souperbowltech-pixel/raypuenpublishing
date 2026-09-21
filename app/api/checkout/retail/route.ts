import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { RETAIL_PRICE } from "@/lib/pricing";
import { BOOK_1_SKU } from "@/lib/checkout";
import { publisherBrand } from "@/lib/book";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // Rate limit: 10 requests / minute / IP
  const limit = rateLimit(`checkout-retail:${clientIp(request)}`, 10, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  try {
    const body = await request.json();
    const quantity =
      Number.isInteger(body.quantity) && body.quantity > 0 ? body.quantity : 1;

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      request.headers.get("origin") ||
      "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "The Geezy Goober's Guide to Icky Sfand: The Search for the Magic Pen (Volume 1)",
              description:
                "An Interactive Rhythmic Rhyme & Tactile Coloring Quest for Early Learners.",
              metadata: {
                sku: BOOK_1_SKU,
              },
            },
            unit_amount: Math.round(RETAIL_PRICE * 100), // $6.99 -> 699 cents
          },
          quantity,
        },
      ],
      mode: "payment",
      shipping_address_collection: {
        allowed_countries: ["US", "CA", "GB", "AU"],
      },
      metadata: {
        channel: "retail",
        sku: BOOK_1_SKU,
        quantity: quantity.toString(),
      },
      // Legal credit line, shown to the customer on the Stripe Checkout page.
      custom_text: {
        submit: { message: publisherBrand.fullCredit },
      },
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/cancel`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[Retail Checkout Error]:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}

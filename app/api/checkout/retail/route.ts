import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { RETAIL_PRICE } from "@/lib/pricing";
import { BOOK_1_SKU } from "@/lib/checkout";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
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
              name: "The Geezy Goober's Guide to Icky Sfand",
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
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/cancel`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("[Retail Checkout Error]:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create checkout session" },
      { status: 500 }
    );
  }
}

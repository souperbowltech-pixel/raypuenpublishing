import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { GRANDPA_SPONSOR_PRICE } from "@/lib/gamification";
import { publisherBrand } from "@/lib/book";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const TOKEN_REGEX = /^[A-Za-z0-9_-]{3,64}$/;

/**
 * Ray's directive #6 — the "Grandpa multiplier". A relative sponsors a child for
 * a flat $40; on payment the Stripe webhook flips `book3_sponsored` for the scout
 * token in the metadata, which unlocks Book 3 independently of the peer track.
 */
export async function POST(req: NextRequest) {
  // Rate limit: 10 requests / minute / IP
  const limit = rateLimit(`checkout-sponsor:${clientIp(req)}`, 10, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  try {
    const body = await req.json();
    const scoutToken = typeof body.scoutToken === "string" ? body.scoutToken.trim() : "";
    const scoutName =
      typeof body.scoutName === "string" ? body.scoutName.replace(/[<>]/g, "").slice(0, 60) : "";

    if (!TOKEN_REGEX.test(scoutToken)) {
      return NextResponse.json({ error: "A valid scout token is required." }, { status: 400 });
    }

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      req.headers.get("origin") ||
      "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Grandpa Multiplier — Sponsor Book 3",
              description:
                "A flat $40 sponsorship that unlocks Book 3 free for a young Scout, in parallel with their peer Book 2 track.",
            },
            unit_amount: Math.round(GRANDPA_SPONSOR_PRICE * 100), // $40.00 -> 4000 cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      metadata: {
        order_type: "grandpa_sponsorship",
        scout_token: scoutToken,
        scout_name: scoutName,
      },
      // Legal credit line, shown to the sponsor on the Stripe Checkout page.
      custom_text: {
        submit: { message: publisherBrand.fullCredit },
      },
      success_url: `${origin}/dashboard/book2?sponsored=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dashboard/book2`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[Grandpa Sponsor Checkout Error]:", error);
    return NextResponse.json(
      { error: "Unable to initiate sponsorship checkout" },
      { status: 500 }
    );
  }
}

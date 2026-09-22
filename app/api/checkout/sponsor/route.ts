import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { GRANDPA_SPONSOR_PRICE } from "@/lib/gamification";
import { publisherBrand } from "@/lib/book";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { DEMO_SCOUT_TOKEN, SHARE_CODE_REGEX } from "@/lib/family";
import { findScoutByShareCode } from "@/lib/family-store";
import { getOrCreateScoutAsync } from "@/lib/scout-store";

export const dynamic = "force-dynamic";

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
    // Sponsors only ever hold the child's public share code (from the Grandpa QR);
    // the private scout token is looked up here and never sent to the browser.
    // The demo profile is reachable by its demo token for previews.
    const code = typeof body.scoutCode === "string" ? body.scoutCode.trim().toUpperCase() : "";
    let scoutToken = "";
    let scoutName = "";
    if (SHARE_CODE_REGEX.test(code)) {
      const scout = await findScoutByShareCode(code);
      if (scout) {
        scoutToken = scout.scoutToken;
        scoutName = scout.firstName;
      }
    } else if (body.scoutToken === DEMO_SCOUT_TOKEN) {
      scoutToken = DEMO_SCOUT_TOKEN;
      scoutName = (await getOrCreateScoutAsync(DEMO_SCOUT_TOKEN)).scoutName;
    }
    if (!scoutToken) {
      return NextResponse.json({ error: "This sponsor link isn't valid. Please ask the family for a new one." }, { status: 400 });
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
      // The sponsor is usually a relative on their own device, so they return to
      // the sponsor page (which confirms the payment), not to the child's dashboard.
      success_url: `${origin}/sponsor?done=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: code ? `${origin}/sponsor?code=${encodeURIComponent(code)}` : `${origin}/sponsor?token=${DEMO_SCOUT_TOKEN}`,
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

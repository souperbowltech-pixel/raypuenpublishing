import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { SPONSOR_TIERS } from "@/lib/pricing";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  // Rate limit: 10 requests / minute / IP
  const limit = rateLimit(`checkout-wholesale:${clientIp(req)}`, 10, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  try {
    const body = await req.json();
    const { tierId, institution, shippingAddress } = body;

    // Validate the contact email.
    const email = String(institution?.email ?? "").trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: "A valid contact email is required." },
        { status: 400 }
      );
    }

    // Normalize the tier to 1 | 2 | 3 (default 1).
    const normalizedTierId: 1 | 2 | 3 =
      tierId === 2 || tierId === 3 ? tierId : 1;
    const tier = SPONSOR_TIERS[normalizedTierId];

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      req.headers.get("origin") ||
      "http://localhost:3000";

    const sessionMetadata: Record<string, string> = {
      order_type: "institutional_sponsorship",
      tier_id: String(tier.tierId),
      tier_name: tier.name,
      books_sponsored: String(tier.booksSponsored),
      total_printed_with_match: String(tier.totalPrintedWithMatch),
      institution_name: institution?.name || "",
      contact_name: institution?.contactName || "",
      phone: institution?.phone || "",
    };

    if (tier.isPremiumSponsor) {
      sessionMetadata.premium_sponsor = "true";
      sessionMetadata.note = "Premium Sponsor: Ship 1 Free Copy";
      if (shippingAddress) {
        sessionMetadata.sponsor_shipping = `${shippingAddress.line1}, ${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.zip}`;
      }
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${tier.name} — ${tier.booksSponsored} Books (Matched to ${tier.totalPrintedWithMatch})`,
              description: tier.description,
            },
            unit_amount: Math.round(tier.flatPrice * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      customer_email: email,
      metadata: sessionMetadata,
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}&type=wholesale`,
      cancel_url: `${origin}/institutions`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Wholesale checkout error:", error);
    return NextResponse.json(
      { error: "Unable to initiate sponsorship checkout" },
      { status: 500 }
    );
  }
}

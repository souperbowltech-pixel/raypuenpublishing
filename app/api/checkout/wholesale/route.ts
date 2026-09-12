import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { SPONSOR_TIERS } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tierId = 1, institution, shippingAddress } = body;

    const tier = SPONSOR_TIERS[tierId as 1 | 2 | 3] || SPONSOR_TIERS[1];

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
      customer_email: institution?.email || undefined,
      metadata: sessionMetadata,
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}&type=wholesale`,
      cancel_url: `${origin}/institutions`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Wholesale checkout error:", error);
    return NextResponse.json(
      { error: error.message || "Unable to initiate sponsorship checkout" },
      { status: 500 }
    );
  }
}

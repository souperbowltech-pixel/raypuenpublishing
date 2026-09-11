import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { calculateWholesalePrice } from "@/lib/pricing";
import { BOOK_1_SKU, WholesaleContact, ShippingAddress } from "@/lib/checkout";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body: {
      contact: WholesaleContact;
      shippingAddress: ShippingAddress;
      quantity: number;
    } = await request.json();

    if (!body || !body.contact || !body.quantity) {
      return NextResponse.json(
        { error: "Invalid order data provided." },
        { status: 400 }
      );
    }

    // Always recalculate on the server for security
    const pricing = calculateWholesalePrice(body.quantity);

    if (!pricing.valid) {
      return NextResponse.json(
        { error: pricing.reason || "Invalid quantity for wholesale order." },
        { status: 400 }
      );
    }

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      request.headers.get("origin") ||
      "http://localhost:3000";

    const line_items: any[] = [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Children's Coloring Book — Institutional Wholesale (${pricing.quantity} copies)`,
            description: `Wholesale bulk copies for ${body.contact.institutionName}. Includes 40% institutional discount.`,
            metadata: {
              sku: BOOK_1_SKU,
            },
          },
          unit_amount: Math.round(pricing.unitPrice * 100), // $4.19 -> 419 cents
        },
        quantity: pricing.quantity,
      },
    ];

    // If digital fee is NOT waived, add it as a line item
    if (!pricing.feeWaived && pricing.digitalFee > 0) {
      line_items.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: "Digital Curriculum & Administration Fee",
            description: "One-time digital fee (waived on orders of 100+ copies).",
          },
          unit_amount: Math.round(pricing.digitalFee * 100), // $20.00 -> 2000 cents
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      customer_email: body.contact.email,
      line_items,
      mode: "payment",
      shipping_address_collection: {
        allowed_countries: ["US", "CA", "GB", "AU"],
      },
      metadata: {
        channel: "wholesale",
        institutionName: body.contact.institutionName,
        institutionType: body.contact.institutionType,
        contactName: body.contact.contactName,
        email: body.contact.email,
        phone: body.contact.phone,
        quantity: pricing.quantity.toString(),
        manualIncluded: pricing.manualIncluded ? "true" : "false",
        shippingLine1: body.shippingAddress?.line1 || "",
        shippingCity: body.shippingAddress?.city || "",
        shippingState: body.shippingAddress?.state || "",
        shippingPostalCode: body.shippingAddress?.postalCode || "",
        shippingCountry: body.shippingAddress?.country || "US",
      },
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}&channel=wholesale`,
      cancel_url: `${origin}/checkout/cancel`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("[Wholesale Checkout Error]:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create wholesale checkout session" },
      { status: 500 }
    );
  }
}

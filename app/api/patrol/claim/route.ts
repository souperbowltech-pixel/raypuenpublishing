import { NextRequest, NextResponse } from "next/server";
import { submitGuideClaim } from "@/lib/patrol-store";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const limit = rateLimit(`patrol-claim:${clientIp(req)}`, 5, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { patrolToken, recipientName, street, city, state, zip, country } = body;

  if (!patrolToken || typeof patrolToken !== "string") {
    return NextResponse.json({ error: "Missing patrolToken" }, { status: 400 });
  }
  if (!recipientName || typeof recipientName !== "string") {
    return NextResponse.json({ error: "Please enter the recipient name" }, { status: 400 });
  }
  if (!street || !city || !state || !zip) {
    return NextResponse.json({ error: "Please complete all shipping address fields" }, { status: 400 });
  }

  const shippingAddress = {
    recipient: recipientName.trim(),
    street: String(street).trim(),
    city: String(city).trim(),
    state: String(state).trim().toUpperCase(),
    zip: String(zip).trim(),
    country: String(country || "US").trim().toUpperCase(),
  };

  const result = await submitGuideClaim(patrolToken.trim(), recipientName.trim(), shippingAddress);

  if (!result.ok) {
    return NextResponse.json({ error: result.error || "Claim submission failed" }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    message: "Your shipping details have been submitted! Ray's team will review and approve fulfillment.",
  });
}

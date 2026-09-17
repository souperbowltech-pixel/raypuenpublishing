import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { updateScoutAsync } from "@/lib/scout-store";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const TOKEN_REGEX = /^[A-Za-z0-9_-]{3,64}$/;

/**
 * Fallback confirmation for the Grandpa sponsorship, mirroring the retail success
 * page's direct-sync pattern: when the sponsor returns to the dashboard we verify
 * the Stripe session server-side (paid + correct order type) and unlock Book 3.
 * This guarantees the unlock even when the Stripe webhook is not yet configured.
 * The scout token is always read from the authoritative Stripe metadata, never
 * from the client.
 */
export async function POST(req: NextRequest) {
  const limit = rateLimit(`sponsor-confirm:${clientIp(req)}`, 20, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  try {
    const body = await req.json();
    const sessionId = typeof body.session_id === "string" ? body.session_id : "";
    if (!sessionId || sessionId.length > 200) {
      return NextResponse.json({ error: "A valid session_id is required." }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const orderType = session.metadata?.order_type;
    const scoutToken = session.metadata?.scout_token || "";
    const paid = session.payment_status === "paid";

    if (orderType !== "grandpa_sponsorship" || !TOKEN_REGEX.test(scoutToken)) {
      return NextResponse.json({ error: "Not a valid sponsorship session." }, { status: 400 });
    }

    if (!paid) {
      return NextResponse.json({ success: false, paid: false });
    }

    const scout = await updateScoutAsync(scoutToken, { book3Sponsored: true });
    return NextResponse.json({ success: true, paid: true, scout });
  } catch (error) {
    console.error("[Grandpa Sponsor Confirm Error]:", error);
    return NextResponse.json({ error: "Unable to confirm sponsorship" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { isLikelyBot, validateSchoolRequest } from "@/lib/school-requests";
import { notifySchoolRequest, saveSchoolRequest } from "@/lib/school-request-store";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Saved requests per connection per hour. A school district often sends every
 * school through one address, and the same letter reaches them all, so this is
 * generous. Only valid requests count: a typo must never lock a principal out.
 */
const REQUESTS_PER_HOUR = 20;

/** The form on /neighborhood: one school's request, saved for Ray. */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const fields = body as Record<string, unknown>;

  // A bot gets the same answer as a person, so it learns nothing, and nothing is saved.
  if (isLikelyBot(fields)) {
    console.info("[school-requests] honeypot filled; request dropped");
    return NextResponse.json({ success: true });
  }

  const parsed = validateSchoolRequest(fields);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error, field: parsed.field }, { status: 400 });
  }

  const limit = await rateLimit(`school-request:${clientIp(req)}`, REQUESTS_PER_HOUR, 60 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests from this connection. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  const saved = await saveSchoolRequest(parsed.value);
  if (!saved.ok) {
    return NextResponse.json(
      { error: "We could not send your request right now. Please try again in a few minutes." },
      { status: 503 }
    );
  }

  // The row is saved, so the principal is answered with success whatever the
  // email does. A failure here must not invite a second, duplicate submission.
  try {
    await notifySchoolRequest(parsed.value);
  } catch (err) {
    console.error("[school-requests] notification threw", err instanceof Error ? err.message : "unknown");
  }
  return NextResponse.json({ success: true });
}

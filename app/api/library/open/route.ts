import { NextRequest, NextResponse } from "next/server";
import { openCode, type OpenResult } from "@/lib/library-store";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
// Fetching the master, stamping it and storing the copy takes a few seconds at most;
// this leaves room for a slow storage day without letting a stuck call run on.
export const maxDuration = 60;

/**
 * Tries per connection per minute. Every try counts, right or wrong, because
 * this is the one place a stranger could guess at codes. A person with a real
 * code needs one or two.
 */
const TRIES_PER_MINUTE = 10;

type Refusal = Extract<OpenResult, { ok: false }>["reason"];

const REFUSALS: Record<Refusal, { status: number; error: string }> = {
  invalid: { status: 400, error: "That code is not valid. Please check it and try again." },
  used: { status: 410, error: "This code has already been used. Please ask for a new one." },
  expired: { status: 410, error: "This code has expired. Please ask for a new one." },
  cancelled: { status: 410, error: "This code is no longer active." },
  "missing-master": { status: 503, error: "This book is not ready to download yet. Please try again later." },
  unavailable: { status: 503, error: "We could not prepare your copy right now. Please try again in a few minutes." },
  // A master that cannot be stamped will not fix itself, so the reader is asked to tell us; the log says which.
  error: { status: 500, error: "Something went wrong preparing your copy. Please let us know so we can fix it." },
};

/** The form on /library: a code in, a short-lived link to the reader's own copy out. */
export async function POST(req: NextRequest) {
  const limit = rateLimit(`library-open:${clientIp(req)}`, TRIES_PER_MINUTE, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many tries from this connection. Please wait a minute." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const code = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>).code : undefined;
  if (typeof code !== "string") {
    return NextResponse.json({ error: "Please enter your code." }, { status: 400 });
  }

  let result: OpenResult;
  try {
    result = await openCode(code);
  } catch (err) {
    console.error("[library] open threw", err instanceof Error ? err.message : "unknown");
    result = { ok: false, reason: "error" };
  }

  if (!result.ok) {
    const refusal = REFUSALS[result.reason];
    return NextResponse.json({ error: refusal.error }, { status: refusal.status });
  }
  // The link itself is the credential for the next few minutes, so it must not be cached anywhere.
  return NextResponse.json({ url: result.url }, { headers: { "Cache-Control": "no-store" } });
}

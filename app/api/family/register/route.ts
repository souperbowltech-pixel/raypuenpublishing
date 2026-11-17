import { NextRequest, NextResponse } from 'next/server';
import { normalizeEmail, validateFirstName } from '@/lib/family';
import { registerFamily } from '@/lib/family-store';
import { setSessionCookie } from '@/lib/scout-access';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * Sign-ups allowed per IP per hour. At a church or co-op table every phone on
 * the venue Wi-Fi shares one address, so this must cover a busy table (about
 * one family a minute). Emails are not confirmed, so this count is the only
 * brake on junk sign-ups; what keeps it safe to raise is that a sign-up sends
 * no email and calls no paid service: it writes three rows, plus a referral
 * lookup and an optional gift redemption.
 */
const REGISTRATIONS_PER_HOUR = 60;

/** QR-code registration: parent email + the child's first name → own dashboard. */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const name = validateFirstName(body.childFirstName);
  if (!name.ok) return NextResponse.json({ error: name.error, field: 'childFirstName' }, { status: 400 });
  const email = normalizeEmail(body.parentEmail);
  if (!email.ok) return NextResponse.json({ error: email.error, field: 'parentEmail' }, { status: 400 });
  if (body.isParentOrGuardian !== true) {
    return NextResponse.json(
      { error: 'Please confirm you are the parent or guardian.', field: 'isParentOrGuardian' },
      { status: 400 }
    );
  }

  // Counted only once the form is valid, so a typo or a missed checkbox at a
  // busy table never uses up the venue's hour. A returning parent's
  // email_taken does count: it reaches the database.
  const limit = await rateLimit(`family-register:${clientIp(req)}`, REGISTRATIONS_PER_HOUR, 60 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many sign-ups from this connection. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    );
  }

  const refCode =
    typeof body.referralCode === 'string'
      ? body.referralCode
      : typeof body.refCode === 'string'
      ? body.refCode
      : typeof body.ref === 'string'
      ? body.ref
      : undefined;

  const giftCode =
    typeof body.giftCode === 'string'
      ? body.giftCode
      : typeof body.gift === 'string'
      ? body.gift
      : undefined;

  const result = await registerFamily(email.value, name.value, refCode, giftCode);
  if (!result.ok) {
    const message =
      result.reason === 'email_taken'
        ? 'This email already has an Explorer account. Please continue on the device you first signed up with.'
        : 'We could not create your account right now. Please try again in a few minutes.';
    return NextResponse.json(
      { error: message, reason: result.reason, field: result.reason === 'email_taken' ? 'parentEmail' : undefined },
      { status: result.reason === 'email_taken' ? 409 : 503 }
    );
  }

  const res = NextResponse.json({
    success: true,
    family: { firstName: result.session.firstName, shareCode: result.session.shareCode },
  });
  setSessionCookie(res, result.sessionToken);
  return res;
}

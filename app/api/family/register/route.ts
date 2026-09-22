import { NextRequest, NextResponse } from 'next/server';
import { normalizeEmail, validateFirstName } from '@/lib/family';
import { registerFamily } from '@/lib/family-store';
import { setSessionCookie } from '@/lib/scout-access';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** QR-code registration: parent email + the child's first name → own dashboard. */
export async function POST(req: NextRequest) {
  const limit = rateLimit(`family-register:${clientIp(req)}`, 5, 60 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many sign-ups from this connection. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
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

  const result = await registerFamily(email.value, name.value);
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

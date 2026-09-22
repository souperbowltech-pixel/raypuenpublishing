import { NextRequest, NextResponse } from 'next/server';
import { getFamilySession } from '@/lib/family-store';
import { SESSION_COOKIE } from '@/lib/family';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** The family signed in on this device (never the private scout token). */
export async function GET(req: NextRequest) {
  const limit = rateLimit(`family-me:${clientIp(req)}`, 60, 60_000);
  if (!limit.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const family = await getFamilySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!family) return NextResponse.json({ signedIn: false }, { status: 401 });

  return NextResponse.json(
    { signedIn: true, family: { firstName: family.firstName, shareCode: family.shareCode, parentEmail: family.parentEmail } },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

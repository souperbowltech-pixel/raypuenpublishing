import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateScoutAsync, toPublicScoutState } from '@/lib/scout-store';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { resolveScoutAccess } from '@/lib/scout-access';
import { DEMO_SCOUT_TOKEN } from '@/lib/family';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Rate limit: 60 requests / minute / IP
  const limit = await rateLimit(`scout-state:${clientIp(req)}`, 60, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    );
  }

  // The demo profile when asked for by token; otherwise only the child of the
  // family signed in on this device.
  const access = await resolveScoutAccess(req, new URL(req.url).searchParams.get('token'));
  if (!access) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const scout = await getOrCreateScoutAsync(access.scoutToken);
  const body = {
    ...toPublicScoutState(scout),
    ...(access.kind === 'family'
      ? { shareCode: access.family.shareCode }
      : { token: DEMO_SCOUT_TOKEN }),
  };
  return NextResponse.json(
    { success: true, mode: access.kind, scout: body },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

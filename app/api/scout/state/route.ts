import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateScoutAsync } from '@/lib/scout-store';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { resolveScoutAccess } from '@/lib/scout-access';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Rate limit: 60 requests / minute / IP
  const limit = rateLimit(`scout-state:${clientIp(req)}`, 60, 60_000);
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
  // A registered family's private token stays on the server.
  const body = access.kind === 'family'
    ? { ...scout, token: undefined, shareCode: access.family.shareCode }
    : scout;
  return NextResponse.json(
    { success: true, mode: access.kind, scout: body },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

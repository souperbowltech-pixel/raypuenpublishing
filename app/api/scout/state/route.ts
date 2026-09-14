import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateScoutAsync } from '@/lib/scout-store';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const TOKEN_REGEX = /^[A-Za-z0-9_-]{3,64}$/;

function sanitizeName(raw: string | null): string | undefined {
  if (!raw) return undefined;
  const cleaned = raw
    .replace(/[<>]/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim()
    .slice(0, 60);
  return cleaned || undefined;
}

export async function GET(req: NextRequest) {
  // Rate limit: 60 requests / minute / IP
  const limit = rateLimit(`scout-state:${clientIp(req)}`, 60, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    );
  }

  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token') || 'CAPTAIN-RAY-700';
  const name = sanitizeName(searchParams.get('name'));

  if (!TOKEN_REGEX.test(token)) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  const scout = await getOrCreateScoutAsync(token, name);
  return NextResponse.json({ success: true, scout });
}

import { NextRequest, NextResponse } from 'next/server';
import { endFamilySession } from '@/lib/family-store';
import { SESSION_COOKIE } from '@/lib/family';
import { clearSessionCookie } from '@/lib/scout-access';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  await endFamilySession(req.cookies.get(SESSION_COOKIE)?.value);
  const res = NextResponse.json({ success: true });
  clearSessionCookie(res);
  return res;
}

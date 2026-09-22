import type { NextRequest, NextResponse } from 'next/server';
import { getFamilySession, type FamilySession } from '@/lib/family-store';
import { DEMO_SCOUT_TOKEN, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from '@/lib/family';

export type ScoutAccess =
  | { kind: 'family'; scoutToken: string; family: FamilySession }
  | { kind: 'demo'; scoutToken: string };

/**
 * Which scout a request may read or change. Only two answers exist: the demo
 * profile (when explicitly asked for), or the child of the family signed in on
 * this device. A token in the request can never reach anyone else's child.
 */
export async function resolveScoutAccess(req: NextRequest, requestedToken?: string | null): Promise<ScoutAccess | null> {
  if (requestedToken === DEMO_SCOUT_TOKEN) return { kind: 'demo', scoutToken: DEMO_SCOUT_TOKEN };
  const family = await getFamilySession(req.cookies.get(SESSION_COOKIE)?.value);
  return family ? { kind: 'family', scoutToken: family.scoutToken, family } : null;
}

export function setSessionCookie(res: NextResponse, sessionToken: string) {
  res.cookies.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}

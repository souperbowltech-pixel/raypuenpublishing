import { NextRequest, NextResponse } from 'next/server';
import { updateScoutAsync, PersistentScoutState } from '@/lib/scout-store';
import {
  gradeQuiz,
  REFERRAL_FRIEND_REQUIREMENT,
  REFERRAL_INVITE_CAPACITY,
} from '@/lib/gamification';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { resolveScoutAccess } from '@/lib/scout-access';
import { validateFirstName } from '@/lib/family';

export const dynamic = 'force-dynamic';

function sanitizeName(raw: unknown): string {
  return String(raw ?? '')
    .replace(/[<>]/g, '')
    // strip control chars
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim()
    .slice(0, 60);
}

export async function POST(req: NextRequest) {
  // Rate limit: 30 requests / minute / IP
  const limit = rateLimit(`scout-update:${clientIp(req)}`, 30, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    );
  }

  try {
    const body = await req.json();
    const access = await resolveScoutAccess(req, typeof body.token === 'string' ? body.token : null);
    if (!access) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    }

    // STRICT whitelist — never accept quizScore/referralScore/totalScore/status
    // from the client. Everything is derived server-side.
    const updates: Partial<PersistentScoutState> = {};

    if (body.scoutName !== undefined) {
      if (access.kind === 'family') {
        // Registered children keep Ray's first-name-only rule.
        const name = validateFirstName(body.scoutName);
        if (!name.ok) return NextResponse.json({ error: name.error }, { status: 400 });
        updates.scoutName = name.value;
      } else {
        updates.scoutName = sanitizeName(body.scoutName);
      }
    }

    if (body.completedPages !== undefined) {
      const seen = new Set<number>();
      if (Array.isArray(body.completedPages)) {
        for (const p of body.completedPages) {
          const n = Math.round(Number(p));
          if (Number.isFinite(n) && n >= 1 && n <= 19) seen.add(n);
        }
      }
      updates.completedPages = Array.from(seen).sort((a, b) => a - b);
    }

    if (body.quizAnswers !== undefined) {
      const rawBook = Number(body.quizBook);
      const quizBook: 1 | 2 | 3 =
        rawBook === 1 || rawBook === 3 ? (rawBook as 1 | 3) : 2;
      const answers =
        body.quizAnswers && typeof body.quizAnswers === 'object'
          ? (body.quizAnswers as Record<string, number>)
          : {};
      updates.quizScore = gradeQuiz(quizBook, answers);
    }

    // Referral (Ray's directive #2): the 300 points are derived server-side from
    // how many of the 3 invited friends coloured their Page 1 — the points fire
    // once ANY 2 of 3 are complete. In production this count is driven by the
    // friends' own logins; here we only accept demo controls, and only when the
    // env flag is explicitly enabled.
    if (access.kind === 'demo' && process.env.ALLOW_DEMO_REFERRAL === 'true') {
      if (body.demoFriendsCompleted !== undefined) {
        const n = Math.round(Number(body.demoFriendsCompleted));
        updates.friendsCompleted = Number.isFinite(n)
          ? Math.max(0, Math.min(REFERRAL_INVITE_CAPACITY, n))
          : 0;
      } else if (body.demoReferral !== undefined) {
        // Back-compat: a truthy demoReferral means the friend gate is met.
        updates.friendsCompleted = body.demoReferral === true ? REFERRAL_FRIEND_REQUIREMENT : 0;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const result = await updateScoutAsync(access.scoutToken, updates);
    const out = access.kind === 'family'
      ? { ...result.state, token: undefined, shareCode: access.family.shareCode }
      : result.state;

    if (!result.persisted) {
      // Never report a save that did not happen: the dashboard rolls its
      // optimistic update back and offers a retry instead of silently losing work.
      return NextResponse.json(
        {
          success: false,
          saved: false,
          error: 'Your progress could not be saved. Please try again.',
          mode: access.kind,
          scout: out,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({ success: true, saved: true, mode: access.kind, scout: out });
  } catch (err) {
    console.error('[scout/update] error:', err);
    return NextResponse.json(
      { error: 'Failed to update scout state' },
      { status: 500 }
    );
  }
}

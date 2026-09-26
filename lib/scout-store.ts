import fs from 'fs';
import path from 'path';
import { supabase, isProduction } from '@/lib/supabase';
import { alertFailure } from '@/lib/alerts';
import {
  BOOK2_GATE_CONFIG,
  REFERRAL_FRIEND_REQUIREMENT,
  REFERRAL_INVITE_CAPACITY,
} from '@/lib/gamification';

export interface PersistentScoutState {
  token: string;
  scoutName: string;
  completedPages: number[];
  quizScore: number;
  /** Number of invited friends (0–3) who logged in and coloured their Page 1. */
  friendsCompleted: number;
  /** Derived: 300 once `friendsCompleted` reaches the 2-friend requirement. */
  referralScore: number;
  totalScore: number;
  hasPassedQuiz: boolean;
  hasRecruitedFriend: boolean;
  /** Peer track: reaching 700 pts unlocks Book 2 free. */
  book2Unlocked: boolean;
  /** Grandpa track: a relative's $40 sponsorship unlocks Book 3 free. */
  book3Sponsored: boolean;
  book3Unlocked: boolean;
  /** Token of the scout who invited this child, if registered via a friend link. */
  referredBy?: string;
  status: 'In_Progress' | 'Academic_Pass' | 'Unlock_Volume_2';
  updatedAt: string;
}

/** The authoritative, non-derived inputs a scout record is built from. */
export interface ScoutInput {
  token: string;
  scoutName: string;
  completedPages: number[];
  quizScore: number;
  friendsCompleted: number;
  book3Sponsored: boolean;
  referredBy?: string;
  updatedAt: string;
}

/**
 * Recompute every derived field from the authoritative inputs (`quizScore` and
 * `friendsCompleted`) plus the `book3Sponsored` flag, so the peer (Book 2) and
 * Grandpa (Book 3) tracks stay consistent everywhere. Also clamps the inputs.
 */
export function deriveScoutFields(s: ScoutInput): PersistentScoutState {
  const quizScore = clampInt(s.quizScore, 0, BOOK2_GATE_CONFIG.academicPassThreshold);
  const friendsCompleted = clampInt(s.friendsCompleted, 0, REFERRAL_INVITE_CAPACITY);
  const book3Sponsored = Boolean(s.book3Sponsored);

  const hasRecruitedFriend = friendsCompleted >= REFERRAL_FRIEND_REQUIREMENT;
  const referralScore = hasRecruitedFriend ? BOOK2_GATE_CONFIG.friendReferralPoints : 0;
  const totalScore = quizScore + referralScore;
  const hasPassedQuiz = quizScore >= BOOK2_GATE_CONFIG.academicPassThreshold;
  const book2Unlocked = totalScore >= BOOK2_GATE_CONFIG.unlockThreshold;

  const status: PersistentScoutState['status'] = book2Unlocked
    ? 'Unlock_Volume_2'
    : hasPassedQuiz
    ? 'Academic_Pass'
    : 'In_Progress';

  return {
    token: s.token,
    scoutName: s.scoutName,
    completedPages: s.completedPages,
    quizScore,
    friendsCompleted,
    referralScore,
    totalScore,
    hasPassedQuiz,
    hasRecruitedFriend,
    book2Unlocked,
    book3Sponsored,
    book3Unlocked: book3Sponsored,
    referredBy: s.referredBy,
    status,
    updatedAt: s.updatedAt,
  };
}

// In-memory fallback map (handles serverless environments where fs is read-only)
const memoryStore: Record<string, PersistentScoutState> = {
  'CAPTAIN-RAY-700': deriveScoutFields({
    token: 'CAPTAIN-RAY-700',
    scoutName: 'Scout Explorer',
    completedPages: [],
    quizScore: 0,
    friendsCompleted: 0,
    book3Sponsored: false,
    updatedAt: new Date().toISOString(),
  }),
};

// A database problem must never be silent: log every occurrence, alert once per
// kind per server instance (the local fallback keeps the page working meanwhile).
const alertedDbProblems = new Set<string>();
function reportDbProblem(context: string, detail: Record<string, unknown> = {}) {
  console.error(`[scout-store] ${context}`, detail);
  if (alertedDbProblems.has(context)) return;
  alertedDbProblems.add(context);
  void alertFailure(context, detail);
}

function errText(err: unknown): string {
  if (!err) return 'unknown error';
  if (typeof err === 'object') {
    const e = err as { code?: string; message?: string };
    return [e.code, e.message].filter(Boolean).join(': ') || String(err);
  }
  return String(err);
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'scouts.json');

// --- Defense-in-depth sanitisers (never trust merged-in values) ---
function clampInt(value: unknown, min: number, max: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function sanitizePages(pages: unknown): number[] {
  if (!Array.isArray(pages)) return [];
  const seen = new Set<number>();
  for (const p of pages) {
    const n = Math.round(Number(p));
    if (Number.isFinite(n) && n >= 1 && n <= 19) seen.add(n);
  }
  return Array.from(seen).sort((a, b) => a - b);
}

function ensureLocalStore(): Record<string, PersistentScoutState> {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(memoryStore, null, 2), 'utf8');
      return { ...memoryStore };
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    // Vercel serverless read-only filesystem fallback
    return memoryStore;
  }
}

function saveLocalStore(data: Record<string, PersistentScoutState>) {
  try {
    Object.assign(memoryStore, data);
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    // Ignore filesystem write error in serverless environment
  }
}

export async function getOrCreateScoutAsync(token: string, name?: string): Promise<PersistentScoutState> {
  const cleanToken = token.trim() || 'CAPTAIN-RAY-700';

  if (!supabase && isProduction) {
    reportDbProblem('Database not configured on the live site: scout progress is not being saved');
  }

  // 1. Try Supabase if available
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('scout_profiles')
        .select('*')
        .eq('token', cleanToken)
        .maybeSingle();

      if (error) {
        reportDbProblem('Scout profile read failed; using temporary memory', { error: errText(error) });
      }

      if (!error && data) {
        // `friends_completed` is the new authoritative referral input. When the
        // column is absent (pre-migration rows) fall back to the legacy
        // referral_score (>=300 meant the friend gate was met).
        const friendsCompleted =
          data.friends_completed != null
            ? Number(data.friends_completed)
            : Number(data.referral_score ?? 0) >= 300
            ? REFERRAL_FRIEND_REQUIREMENT
            : 0;

        return deriveScoutFields({
          token: data.token,
          scoutName: data.scout_name || 'Young Scout',
          completedPages: (data.completed_pages || []).map((p: any) => Number(p)),
          quizScore: Number(data.quiz_score ?? 0),
          friendsCompleted,
          book3Sponsored: Boolean(data.book3_sponsored),
          referredBy: data.referred_by_scout_token || undefined,
          updatedAt: data.updated_at || new Date().toISOString(),
        }) as PersistentScoutState;
      }

      // If not found in Supabase, create record
      if (!error && !data) {
        const newRecord = {
          token: cleanToken,
          scout_name: name || 'Young Scout',
          completed_pages: [],
          quiz_score: 0,
          referral_score: 0,
          status: 'In_Progress',
          updated_at: new Date().toISOString(),
        };
        const { data: inserted, error: insertError } = await supabase
          .from('scout_profiles')
          .insert([newRecord])
          .select()
          .maybeSingle();

        if (insertError) {
          reportDbProblem('Scout profile create failed; using temporary memory', { error: errText(insertError) });
        }

        if (!insertError && inserted) {
          return deriveScoutFields({
            token: inserted.token,
            scoutName: inserted.scout_name,
            completedPages: (inserted.completed_pages || []).map((p: any) => Number(p)),
            quizScore: Number(inserted.quiz_score ?? 0),
            friendsCompleted: Number(inserted.friends_completed ?? 0),
            book3Sponsored: Boolean(inserted.book3_sponsored),
            referredBy: inserted.referred_by_scout_token || undefined,
            updatedAt: inserted.updated_at,
          }) as PersistentScoutState;
        }
      }
    } catch (err) {
      reportDbProblem('Scout profile read threw; using temporary memory', { error: errText(err) });
    }
  }

  // 2. Safe local store fallback
  return getOrCreateScoutLocal(cleanToken, name);
}

/** The outcome of a scout write. */
export interface ScoutWriteResult {
  state: PersistentScoutState;
  /**
   * True only when the new state was confirmed to reach durable storage. Read a
   * `false` as "not confirmed" rather than "definitely not written": a call that
   * times out mid-flight may still have landed. Every write here is idempotent,
   * so retrying after a `false` is always safe.
   */
  persisted: boolean;
  error?: string;
}

/** Re-read, re-merge and retry this many times when a competing write lands first. */
const MAX_WRITE_ATTEMPTS = 3;

/** Postgres "undefined column" — the friends_completed/book3_sponsored migration is missing. */
const UNDEFINED_COLUMN = '42703';

type WriteOutcome =
  | { kind: 'written' }
  /**
   * Written, but against a database that predates the friends_completed /
   * book3_sponsored columns, so those two values were dropped. Only a real save
   * for a caller that did not touch them.
   */
  | { kind: 'written-without-new-columns' }
  /** Someone else wrote between our read and our write; the caller must re-merge. */
  | { kind: 'conflict' }
  | { kind: 'error'; error: string; code?: string };

/**
 * Merge a caller's partial onto a known state. Defense-in-depth: never let a
 * caller change the token or push out-of-range values — force the token,
 * sanitize pages, then recompute every derived field from the authoritative
 * inputs (deriveScoutFields also clamps).
 */
function mergeScout(
  current: PersistentScoutState,
  partial: Partial<PersistentScoutState>
): PersistentScoutState {
  const merged = { ...current, ...partial };
  return deriveScoutFields({
    ...merged,
    token: current.token,
    referredBy: current.referredBy,
    completedPages: sanitizePages(merged.completedPages),
    updatedAt: new Date().toISOString(),
  });
}

function mirrorLocally(state: PersistentScoutState): PersistentScoutState {
  const localStore = ensureLocalStore();
  localStore[state.token] = state;
  saveLocalStore(localStore);
  return state;
}

/**
 * One conditional write. `expectedUpdatedAt` is the optimistic-concurrency guard:
 * the row only changes if nobody has written since we read it, so two racing
 * requests can never silently overwrite each other's fields.
 */
async function attemptScoutWrite(
  token: string,
  row: Record<string, unknown>,
  expectedUpdatedAt: string
): Promise<WriteOutcome> {
  try {
    const { data, error } = await supabase!
      .from('scout_profiles')
      .update(row)
      .eq('token', token)
      .eq('updated_at', expectedUpdatedAt)
      .select('token');

    if (error) {
      return { kind: 'error', error: errText(error), code: (error as { code?: string }).code };
    }
    return data && data.length > 0 ? { kind: 'written' } : { kind: 'conflict' };
  } catch (err) {
    return { kind: 'error', error: errText(err) };
  }
}

async function writeScoutRow(
  next: PersistentScoutState,
  expectedUpdatedAt: string
): Promise<WriteOutcome> {
  // Split so the pre-migration retry below can reuse the legacy half verbatim.
  const legacyRow = {
    scout_name: next.scoutName,
    completed_pages: next.completedPages,
    quiz_score: next.quizScore,
    referral_score: next.referralScore,
    status: next.status,
    updated_at: next.updatedAt,
  };
  const row = {
    ...legacyRow,
    friends_completed: next.friendsCompleted,
    book3_sponsored: next.book3Sponsored,
  };

  const outcome = await attemptScoutWrite(next.token, row, expectedUpdatedAt);

  // A database that never received the friends_completed/book3_sponsored migration
  // rejects those two columns. Retry without them so the rest of a child's
  // progress still saves, and say loudly that the migration is missing.
  if (outcome.kind === 'error' && outcome.code === UNDEFINED_COLUMN) {
    reportDbProblem(
      'scout_profiles is missing the friends_completed/book3_sponsored columns (migration not applied?)',
      { error: outcome.error }
    );
    const retried = await attemptScoutWrite(next.token, legacyRow, expectedUpdatedAt);
    // Saying "saved" here would recreate the very bug this contract exists to
    // stop: the caller must be told those two values did not land.
    return retried.kind === 'written' ? { kind: 'written-without-new-columns' } : retried;
  }

  return outcome;
}

/**
 * Why a write kept matching zero rows. "Conflict" is only one possibility, and
 * blaming a race for a row that simply is not there sends whoever reads the
 * alert hunting the wrong problem.
 */
async function diagnoseMissedWrite(token: string): Promise<string> {
  try {
    const { data, error } = await supabase!
      .from('scout_profiles')
      .select('token')
      .eq('token', token)
      .maybeSingle();
    if (error) return `could not confirm the scout row: ${errText(error)}`;
    return data ? 'concurrent update' : 'scout row is missing from the database';
  } catch (err) {
    return `could not confirm the scout row: ${errText(err)}`;
  }
}

async function updateScoutInSupabase(
  token: string,
  partial: Partial<PersistentScoutState>
): Promise<ScoutWriteResult> {
  // Whether this caller is changing a value that a pre-migration database cannot store.
  const needsNewColumns = 'friendsCompleted' in partial || 'book3Sponsored' in partial;
  let state = await getOrCreateScoutAsync(token);
  let next = state;

  for (let attempt = 1; attempt <= MAX_WRITE_ATTEMPTS; attempt++) {
    // Re-read before each retry so a re-merge lands on top of whoever won the race.
    if (attempt > 1) state = await getOrCreateScoutAsync(token);

    const expectedUpdatedAt = state.updatedAt;
    next = mergeScout(state, partial);
    const outcome = await writeScoutRow(next, expectedUpdatedAt);

    if (outcome.kind === 'written' || outcome.kind === 'written-without-new-columns') {
      const saved = mirrorLocally(next);
      if (partial.completedPages !== undefined && next.completedPages.includes(1) && next.referredBy) {
        void recomputeReferrerProgress(next.referredBy);
      }
      if (outcome.kind === 'written') {
        return { state: saved, persisted: true };
      }
      if (!needsNewColumns) return { state: saved, persisted: true };
      // The sponsorship/referral value this call existed to store was dropped.
      const error = 'scout_profiles is missing the friends_completed/book3_sponsored columns';
      reportDbProblem('Scout progress partially saved: ' + error);
      return { state: saved, persisted: false, error };
    }

    if (outcome.kind === 'error') {
      reportDbProblem('Scout progress save failed', { error: outcome.error });
      return { state: mirrorLocally(next), persisted: false, error: outcome.error };
    }
    // kind === 'conflict' → loop and merge onto the newer state.
  }

  const error = await diagnoseMissedWrite(token);
  reportDbProblem('Scout progress save never landed', { error });
  return { state: mirrorLocally(next), persisted: false, error };
}

/**
 * Recomputes how many referred friends of a scout have coloured Page 1,
 * and updates the referrer's `friendsCompleted` count (clamped to capacity).
 */
export async function recomputeReferrerProgress(referrerToken: string): Promise<void> {
  if (!referrerToken || referrerToken === 'CAPTAIN-RAY-700') return;

  try {
    let completedCount = 0;
    if (supabase) {
      const { data, error } = await supabase
        .from('scout_profiles')
        .select('completed_pages')
        .eq('referred_by_scout_token', referrerToken);

      if (error) {
        if ((error as { code?: string }).code !== '42703') {
          console.error('[scout-store] Error fetching referred scouts:', error.message);
        }
        return;
      }
      if (data) {
        completedCount = data.filter((row: { completed_pages?: number[] }) =>
          Array.isArray(row.completed_pages) && row.completed_pages.map(Number).includes(1)
        ).length;
      }
    } else {
      const store = ensureLocalStore();
      completedCount = Object.values(store).filter(
        (s) => s.referredBy === referrerToken && Array.isArray(s.completedPages) && s.completedPages.includes(1)
      ).length;
    }

    const clamped = Math.min(REFERRAL_INVITE_CAPACITY, Math.max(0, completedCount));
    await updateScoutAsync(referrerToken, { friendsCompleted: clamped });
  } catch (err) {
    console.error('[scout-store] Failed to recompute referrer progress:', err);
  }
}

export async function updateScoutAsync(
  token: string,
  partial: Partial<PersistentScoutState>
): Promise<ScoutWriteResult> {
  if (supabase) return updateScoutInSupabase(token, partial);

  const state = updateScoutLocal(token, partial);
  if (isProduction) {
    reportDbProblem('Scout progress not saved: database not configured on the live site');
    return { state, persisted: false, error: 'database not configured' };
  }
  // Local development: the JSON store is the intended backend, so this is saved.
  return { state, persisted: true };
}

// Synchronous local helpers
export function getOrCreateScoutLocal(token: string, name?: string, referredBy?: string): PersistentScoutState {
  const store = ensureLocalStore();
  const cleanToken = token.trim() || 'CAPTAIN-RAY-700';

  if (!store[cleanToken]) {
    store[cleanToken] = deriveScoutFields({
      token: cleanToken,
      scoutName: name || 'Young Scout',
      completedPages: [],
      quizScore: 0,
      friendsCompleted: 0,
      book3Sponsored: false,
      referredBy,
      updatedAt: new Date().toISOString(),
    });
    saveLocalStore(store);
  } else if (referredBy && !store[cleanToken].referredBy) {
    store[cleanToken].referredBy = referredBy;
    saveLocalStore(store);
  }

  // Normalize on read: a scouts.json written by an older build may lack the new
  // fields (friends_completed / book3_sponsored) or carry a stale status. Recompute
  // from the authoritative inputs, inferring friendsCompleted from legacy referral_score.
  const rec = store[cleanToken] as Partial<PersistentScoutState> & { referralScore?: number };
  return deriveScoutFields({
    token: rec.token ?? cleanToken,
    scoutName: rec.scoutName ?? 'Young Scout',
    completedPages: rec.completedPages ?? [],
    quizScore: rec.quizScore ?? 0,
    friendsCompleted:
      rec.friendsCompleted != null
        ? rec.friendsCompleted
        : (rec.referralScore ?? 0) >= 300
        ? REFERRAL_FRIEND_REQUIREMENT
        : 0,
    book3Sponsored: Boolean(rec.book3Sponsored),
    referredBy: rec.referredBy ?? referredBy,
    updatedAt: rec.updatedAt ?? new Date().toISOString(),
  });
}

export function updateScoutLocal(
  token: string,
  partial: Partial<PersistentScoutState>
): PersistentScoutState {
  const store = ensureLocalStore();
  const scout = getOrCreateScoutLocal(token);

  // Defense-in-depth: force token, sanitize pages, then recompute all derived
  // fields (deriveScoutFields clamps quizScore + friendsCompleted).
  const merged = { ...scout, ...partial };
  const updated: PersistentScoutState = deriveScoutFields({
    ...merged,
    token: scout.token,
    referredBy: scout.referredBy,
    completedPages: sanitizePages(merged.completedPages),
    updatedAt: new Date().toISOString(),
  }) as PersistentScoutState;

  store[scout.token] = updated;
  saveLocalStore(store);

  if (partial.completedPages !== undefined && updated.completedPages.includes(1) && updated.referredBy) {
    void recomputeReferrerProgress(updated.referredBy);
  }

  return updated;
}


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
  status: 'In_Progress' | 'Academic_Pass' | 'Unlock_Volume_2';
  updatedAt: string;
}

/** The authoritative, non-derived inputs a scout record is built from. */
interface ScoutInput {
  token: string;
  scoutName: string;
  completedPages: number[];
  quizScore: number;
  friendsCompleted: number;
  book3Sponsored: boolean;
  updatedAt: string;
}

/**
 * Recompute every derived field from the authoritative inputs (`quizScore` and
 * `friendsCompleted`) plus the `book3Sponsored` flag, so the peer (Book 2) and
 * Grandpa (Book 3) tracks stay consistent everywhere. Also clamps the inputs.
 */
function deriveScoutFields(s: ScoutInput): PersistentScoutState {
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

export async function updateScoutAsync(
  token: string,
  partial: Partial<PersistentScoutState>
): Promise<PersistentScoutState> {
  const current = await getOrCreateScoutAsync(token);

  // Defense-in-depth: never let a caller change the token or push out-of-range
  // values. Merge, force the token, sanitize pages, then recompute every derived
  // field from the authoritative inputs (deriveScoutFields also clamps).
  const merged = { ...current, ...partial };
  const updated: PersistentScoutState = deriveScoutFields({
    ...merged,
    token: current.token,
    completedPages: sanitizePages(merged.completedPages),
    updatedAt: new Date().toISOString(),
  }) as PersistentScoutState;

  // 1. Sync to Supabase
  if (supabase) {
    try {
      const { error: saveError } = await supabase
        .from('scout_profiles')
        .upsert(
          {
            token: updated.token,
            scout_name: updated.scoutName,
            completed_pages: updated.completedPages,
            quiz_score: updated.quizScore,
            referral_score: updated.referralScore,
            status: updated.status,
            updated_at: updated.updatedAt,
          },
          { onConflict: 'token' }
        );

      if (saveError) {
        reportDbProblem('Scout progress save failed', { error: errText(saveError) });
      }

      // Best-effort: persist the new columns separately so that if the Supabase
      // schema has not been migrated yet, the primary upsert above still lands.
      const { error: extraError } = await supabase
        .from('scout_profiles')
        .upsert(
          {
            token: updated.token,
            friends_completed: updated.friendsCompleted,
            book3_sponsored: updated.book3Sponsored,
          },
          { onConflict: 'token' }
        );
      if (extraError) {
        reportDbProblem('Saving friends_completed / book3_sponsored failed (migration not applied?)', { error: errText(extraError) });
      }
    } catch (err) {
      reportDbProblem('Scout progress save threw', { error: errText(err) });
    }
  }

  // 2. Local mirror
  const localStore = ensureLocalStore();
  localStore[updated.token] = updated;
  saveLocalStore(localStore);

  return updated;
}

// Synchronous local helpers
export function getOrCreateScoutLocal(token: string, name?: string): PersistentScoutState {
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
      updatedAt: new Date().toISOString(),
    });
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
    completedPages: sanitizePages(merged.completedPages),
    updatedAt: new Date().toISOString(),
  }) as PersistentScoutState;

  store[scout.token] = updated;
  saveLocalStore(store);
  return updated;
}

export const getOrCreateScout = getOrCreateScoutLocal;
export const updateScout = updateScoutLocal;

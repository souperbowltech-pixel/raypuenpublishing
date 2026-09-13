import fs from 'fs';
import path from 'path';
import { supabase } from '@/lib/supabase';

export interface PersistentScoutState {
  token: string;
  scoutName: string;
  completedPages: number[];
  quizScore: number;
  referralScore: number;
  totalScore: number;
  hasPassedQuiz: boolean;
  hasRecruitedFriend: boolean;
  status: 'In_Progress' | 'Academic_Pass' | 'Unlock_Volume_3';
  updatedAt: string;
}

// In-memory fallback map (handles serverless environments where fs is read-only)
const memoryStore: Record<string, PersistentScoutState> = {
  'CAPTAIN-RAY-700': {
    token: 'CAPTAIN-RAY-700',
    scoutName: 'Scout Explorer',
    completedPages: [],
    quizScore: 0,
    referralScore: 0,
    totalScore: 0,
    hasPassedQuiz: false,
    hasRecruitedFriend: false,
    status: 'In_Progress',
    updatedAt: new Date().toISOString(),
  },
};

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'scouts.json');

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

  // 1. Try Supabase if available
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('scout_profiles')
        .select('*')
        .eq('token', cleanToken)
        .maybeSingle();

      if (!error && data) {
        return {
          token: data.token,
          scoutName: data.scout_name || 'Young Scout',
          completedPages: (data.completed_pages || []).map((p: any) => Number(p)),
          quizScore: Number(data.quiz_score ?? 0),
          referralScore: Number(data.referral_score ?? 0),
          totalScore: Number(data.quiz_score ?? 0) + Number(data.referral_score ?? 0),
          hasPassedQuiz: Number(data.quiz_score ?? 0) >= 400,
          hasRecruitedFriend: Number(data.referral_score ?? 0) >= 300,
          status: data.status || 'In_Progress',
          updatedAt: data.updated_at || new Date().toISOString(),
        };
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

        if (!insertError && inserted) {
          return {
            token: inserted.token,
            scoutName: inserted.scout_name,
            completedPages: (inserted.completed_pages || []).map((p: any) => Number(p)),
            quizScore: Number(inserted.quiz_score ?? 0),
            referralScore: Number(inserted.referral_score ?? 0),
            totalScore: 0,
            hasPassedQuiz: false,
            hasRecruitedFriend: false,
            status: inserted.status,
            updatedAt: inserted.updated_at,
          };
        }
      }
    } catch (err) {
      console.warn('Supabase read error, falling back to safe local store:', err);
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
  const updated: PersistentScoutState = {
    ...current,
    ...partial,
    updatedAt: new Date().toISOString(),
  };

  updated.totalScore = updated.quizScore + updated.referralScore;
  updated.hasPassedQuiz = updated.quizScore >= 400;
  updated.hasRecruitedFriend = updated.referralScore >= 300;

  if (updated.totalScore >= 700) {
    updated.status = 'Unlock_Volume_3';
  } else if (updated.hasPassedQuiz) {
    updated.status = 'Academic_Pass';
  } else {
    updated.status = 'In_Progress';
  }

  // 1. Sync to Supabase
  if (supabase) {
    try {
      await supabase
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
    } catch (err) {
      console.warn('Supabase upsert error:', err);
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
    store[cleanToken] = {
      token: cleanToken,
      scoutName: name || 'Young Scout',
      completedPages: [],
      quizScore: 0,
      referralScore: 0,
      totalScore: 0,
      hasPassedQuiz: false,
      hasRecruitedFriend: false,
      status: 'In_Progress',
      updatedAt: new Date().toISOString(),
    };
    saveLocalStore(store);
  }
  return store[cleanToken];
}

export function updateScoutLocal(
  token: string,
  partial: Partial<PersistentScoutState>
): PersistentScoutState {
  const store = ensureLocalStore();
  const scout = getOrCreateScoutLocal(token);

  const updated: PersistentScoutState = {
    ...scout,
    ...partial,
    updatedAt: new Date().toISOString(),
  };

  updated.totalScore = updated.quizScore + updated.referralScore;
  updated.hasPassedQuiz = updated.quizScore >= 400;
  updated.hasRecruitedFriend = updated.referralScore >= 300;

  if (updated.totalScore >= 700) {
    updated.status = 'Unlock_Volume_3';
  } else if (updated.hasPassedQuiz) {
    updated.status = 'Academic_Pass';
  } else {
    updated.status = 'In_Progress';
  }

  store[scout.token] = updated;
  saveLocalStore(store);
  return updated;
}

export const getOrCreateScout = getOrCreateScoutLocal;
export const updateScout = updateScoutLocal;

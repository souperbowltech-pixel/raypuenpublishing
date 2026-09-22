import fs from 'fs';
import path from 'path';
import { supabase, isProduction } from '@/lib/supabase';
import { alertFailure } from '@/lib/alerts';
import { getOrCreateScoutLocal } from '@/lib/scout-store';
import {
  hashSessionToken,
  newScoutToken,
  newSessionToken,
  newShareCode,
} from '@/lib/family';

/** What a signed-in device knows about its family and child. */
export interface FamilySession {
  familyId: string;
  parentEmail: string;
  scoutToken: string;
  shareCode: string;
  firstName: string;
}

export type RegisterResult =
  | { ok: true; session: FamilySession; sessionToken: string }
  | { ok: false; reason: 'email_taken' | 'unavailable' | 'error' };

// ---------------------------------------------------------------------------
// Local fallback (development only): data/families.json
// ---------------------------------------------------------------------------
interface LocalFamily { id: string; email: string; scoutToken: string; shareCode: string; firstName: string }
interface LocalStore { families: LocalFamily[]; sessions: Record<string, string> }

const LOCAL_FILE = path.join(process.cwd(), 'data', 'families.json');
const memory: LocalStore = { families: [], sessions: {} };

function readLocal(): LocalStore {
  try {
    if (fs.existsSync(LOCAL_FILE)) return JSON.parse(fs.readFileSync(LOCAL_FILE, 'utf8'));
  } catch {
    // fall through to memory
  }
  return memory;
}

function writeLocal(store: LocalStore) {
  Object.assign(memory, store);
  try {
    fs.mkdirSync(path.dirname(LOCAL_FILE), { recursive: true });
    fs.writeFileSync(LOCAL_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch {
    // read-only filesystem: memory copy only
  }
}

function toSession(f: LocalFamily): FamilySession {
  return { familyId: f.id, parentEmail: f.email, scoutToken: f.scoutToken, shareCode: f.shareCode, firstName: f.firstName };
}

// ---------------------------------------------------------------------------

/**
 * Create a family, its child's scout profile and a signed-in session. An email
 * that is already registered is refused rather than signed in: until email
 * confirmation exists, typing someone's address must not open their child's
 * dashboard.
 */
export async function registerFamily(email: string, firstName: string): Promise<RegisterResult> {
  const sessionToken = newSessionToken();
  const tokenHash = hashSessionToken(sessionToken);
  const scoutToken = newScoutToken();

  if (!supabase) {
    if (isProduction) {
      void alertFailure('Family registration refused: database not configured on the live site');
      return { ok: false, reason: 'unavailable' };
    }
    const store = readLocal();
    if (store.families.some((f) => f.email === email)) return { ok: false, reason: 'email_taken' };
    const family: LocalFamily = { id: `local-${Date.now()}`, email, scoutToken, shareCode: newShareCode(), firstName };
    getOrCreateScoutLocal(scoutToken, firstName);
    store.families.push(family);
    store.sessions[tokenHash] = family.id;
    writeLocal(store);
    return { ok: true, session: toSession(family), sessionToken };
  }

  const { data: family, error: familyError } = await supabase
    .from('families')
    .insert({ parent_email: email })
    .select('id')
    .single();
  if (familyError) {
    if (familyError.code === '23505') return { ok: false, reason: 'email_taken' };
    void alertFailure('Family registration failed (families insert)', { error: familyError.message });
    return { ok: false, reason: 'error' };
  }

  // Retry the (tiny) chance of a share-code collision.
  let shareCode = '';
  let scoutError: { code?: string; message?: string } | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    shareCode = newShareCode();
    const { error } = await supabase.from('scout_profiles').insert({
      token: scoutToken,
      scout_name: firstName,
      family_id: family.id,
      share_code: shareCode,
      status: 'In_Progress',
      updated_at: new Date().toISOString(),
    });
    scoutError = error;
    if (!error || error.code !== '23505') break;
  }
  if (scoutError) {
    await supabase.from('families').delete().eq('id', family.id);
    void alertFailure('Family registration failed (scout profile insert)', { error: scoutError.message ?? '' });
    return { ok: false, reason: 'error' };
  }

  const { error: sessionError } = await supabase
    .from('family_sessions')
    .insert({ token_hash: tokenHash, family_id: family.id });
  if (sessionError) {
    void alertFailure('Family registration failed (session insert)', { error: sessionError.message });
    return { ok: false, reason: 'error' };
  }

  return {
    ok: true,
    session: { familyId: family.id, parentEmail: email, scoutToken, shareCode, firstName },
    sessionToken,
  };
}

/** Resolve a session cookie to its family and child, or null. */
export async function getFamilySession(sessionToken: string | undefined): Promise<FamilySession | null> {
  if (!sessionToken || sessionToken.length > 100) return null;
  const tokenHash = hashSessionToken(sessionToken);

  if (!supabase) {
    if (isProduction) return null;
    const store = readLocal();
    const familyId = store.sessions[tokenHash];
    const family = store.families.find((f) => f.id === familyId);
    return family ? toSession(family) : null;
  }

  const { data: row, error } = await supabase
    .from('family_sessions')
    .select('family_id, families(parent_email)')
    .eq('token_hash', tokenHash)
    .maybeSingle();
  if (error || !row) {
    if (error) console.error('[family-store] session lookup failed', error.message);
    return null;
  }

  const { data: scout, error: scoutError } = await supabase
    .from('scout_profiles')
    .select('token, share_code, scout_name')
    .eq('family_id', row.family_id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (scoutError || !scout) {
    if (scoutError) console.error('[family-store] scout lookup failed', scoutError.message);
    return null;
  }

  const families = row.families as { parent_email?: string } | { parent_email?: string }[] | null;
  const parentEmail = (Array.isArray(families) ? families[0]?.parent_email : families?.parent_email) ?? '';
  return {
    familyId: row.family_id,
    parentEmail,
    scoutToken: scout.token,
    shareCode: scout.share_code,
    firstName: scout.scout_name,
  };
}

export async function endFamilySession(sessionToken: string | undefined): Promise<void> {
  if (!sessionToken) return;
  const tokenHash = hashSessionToken(sessionToken);
  if (!supabase) {
    const store = readLocal();
    delete store.sessions[tokenHash];
    writeLocal(store);
    return;
  }
  await supabase.from('family_sessions').delete().eq('token_hash', tokenHash);
}

/** Public share code (Grandpa QR / friend link) → the child it belongs to. */
export async function findScoutByShareCode(
  shareCode: string
): Promise<{ scoutToken: string; firstName: string } | null> {
  if (!supabase) {
    if (isProduction) return null;
    const f = readLocal().families.find((x) => x.shareCode === shareCode);
    return f ? { scoutToken: f.scoutToken, firstName: f.firstName } : null;
  }
  const { data, error } = await supabase
    .from('scout_profiles')
    .select('token, scout_name')
    .eq('share_code', shareCode)
    .maybeSingle();
  if (error || !data) return null;
  return { scoutToken: data.token, firstName: data.scout_name };
}

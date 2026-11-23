import { createClient } from '@supabase/supabase-js';

// URL: server-only var preferred, public var as fallback. No hardcoded fallback.
const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';

// Prefer the service-role key (server-only, bypasses RLS) for all reads/writes.
// Fall back to the public anon key when the service role is not configured.
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseKey = serviceRoleKey || anonKey || '';

export const usingServiceRole = Boolean(serviceRoleKey);

/**
 * Next.js patches global fetch and caches GET responses, and supabase-js runs on
 * that fetch, which silently served stale rows: a child's progress was written
 * but read back from a cached snapshot. Every database call must bypass it.
 */
/**
 * Every database call also gets a deadline. supabase-js has no timeout of its
 * own, so a stalled connection would hang a page render or a webhook until the
 * platform killed the function, with no error to act on (AUDIT BUG-04). An
 * aborted call surfaces as an ordinary error, which every caller already
 * handles, so this changes nothing except how long the worst case lasts.
 */
const DB_TIMEOUT_MS = 8_000;

export const noStoreFetch: typeof fetch = async (input, init) => {
  // Respect a caller's own signal if it set one; otherwise impose ours.
  const controller = init?.signal ? null : new AbortController();
  const timer = controller ? setTimeout(() => controller.abort(), DB_TIMEOUT_MS) : undefined;
  try {
    const response = await fetch(input, {
      ...init, cache: 'no-store', signal: init?.signal ?? controller!.signal,
    });
    // Supabase consumes the body after fetch resolves. Read it before clearing
    // the deadline, then give the SDK a fresh, fully buffered response.
    const body = await response.arrayBuffer();
    const bodyless = [204, 205, 304].includes(response.status);
    return new Response(bodyless ? null : body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } finally {
    clearTimeout(timer);
  }
};

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
      global: { fetch: noStoreFetch },
    })
  : null;

/**
 * Moving a whole book (10 to 15 MB) to or from storage needs a longer deadline
 * than a database call. As with database responses, the deadline covers reading
 * the body too. Here the file is read inside the deadline and handed on whole.
 * storage-js never passes a signal of its own, so this one is always used.
 */
const STORAGE_TIMEOUT_MS = 30_000;

export const storageFetch: typeof fetch = async (input, init) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STORAGE_TIMEOUT_MS);
  try {
    const response = await fetch(input, { ...init, cache: 'no-store', signal: controller.signal });
    const body = await response.arrayBuffer();
    // A Response with these statuses may not carry a body at all, not even an empty one.
    const bodyless = [101, 204, 205, 304].includes(response.status);
    return new Response(bodyless ? null : body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } finally {
    clearTimeout(timer);
  }
};

/** The same project, for storage only: book files with a deadline sized for them. */
export const storageClient = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
      global: { fetch: storageFetch },
    })
  : null;

/** True on the live Vercel deployment, where a missing database must never be silent. */
export const isProduction =
  process.env.VERCEL_ENV === 'production' ||
  (!process.env.VERCEL_ENV && process.env.NODE_ENV === 'production');

/**
 * Secret-free description of the database connection, for /api/health.
 * `keyKind` reports which key would be used without revealing any of it; a
 * JWT-shaped key carries its role in the payload (`anon` / `service_role`).
 */
export function supabaseConfigSummary() {
  let keyRole: string | null = null;
  try {
    const payload = supabaseKey.split('.')[1];
    if (payload) keyRole = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')).role ?? null;
  } catch {
    keyRole = null;
  }
  let urlHost: string | null = null;
  try {
    urlHost = supabaseUrl ? new URL(supabaseUrl).host : null;
  } catch {
    urlHost = 'invalid-url';
  }
  const keyFormat = (k: string | undefined) =>
    !k ? null
      : k.split('.').length === 3 && k.startsWith('eyJ') ? 'jwt'
      : k.startsWith('sb_secret_') ? 'sb_secret'
      : k.startsWith('sb_publishable_') ? 'sb_publishable'
      : k.startsWith('SUPABASE_') || k.length < 30 ? 'placeholder'
      : 'unrecognised';
  return {
    configured: Boolean(supabase),
    serviceKeyFormat: keyFormat(serviceRoleKey),
    anonKeyFormat: keyFormat(anonKey),
    urlHost,
    urlSource: process.env.SUPABASE_URL ? 'SUPABASE_URL' : process.env.NEXT_PUBLIC_SUPABASE_URL ? 'NEXT_PUBLIC_SUPABASE_URL' : null,
    keySource: serviceRoleKey ? 'SUPABASE_SERVICE_ROLE_KEY' : anonKey ? 'NEXT_PUBLIC_SUPABASE_ANON_KEY' : null,
    keyRole,
  };
}

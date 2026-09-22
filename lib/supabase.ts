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

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })
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
  return {
    configured: Boolean(supabase),
    urlHost,
    urlSource: process.env.SUPABASE_URL ? 'SUPABASE_URL' : process.env.NEXT_PUBLIC_SUPABASE_URL ? 'NEXT_PUBLIC_SUPABASE_URL' : null,
    keySource: serviceRoleKey ? 'SUPABASE_SERVICE_ROLE_KEY' : anonKey ? 'NEXT_PUBLIC_SUPABASE_ANON_KEY' : null,
    keyRole,
  };
}

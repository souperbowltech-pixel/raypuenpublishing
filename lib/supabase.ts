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

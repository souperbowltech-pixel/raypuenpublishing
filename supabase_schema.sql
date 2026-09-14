-- ============================================================================
-- PUEN PUBLISHING & REGENCY PRESS - SCOUT PROFILES DATABASE SCHEMA
-- Designed for 100,000+ Students Scale
-- ============================================================================

CREATE TABLE IF NOT EXISTS scout_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  scout_name TEXT NOT NULL DEFAULT 'Young Scout',
  completed_pages INTEGER[] NOT NULL DEFAULT '{}',
  quiz_score INTEGER NOT NULL DEFAULT 0 CHECK (quiz_score >= 0 AND quiz_score <= 400),
  referral_score INTEGER NOT NULL DEFAULT 0 CHECK (referral_score >= 0 AND referral_score <= 300),
  total_score INTEGER GENERATED ALWAYS AS (quiz_score + referral_score) STORED,
  status TEXT NOT NULL DEFAULT 'In_Progress' CHECK (status IN ('In_Progress', 'Academic_Pass', 'Unlock_Volume_3')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index on token for sub-millisecond lookups under high concurrent scale
CREATE INDEX IF NOT EXISTS idx_scout_profiles_token ON scout_profiles(token);
CREATE INDEX IF NOT EXISTS idx_scout_profiles_status ON scout_profiles(status);

-- Enable Row Level Security (RLS)
ALTER TABLE scout_profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS is DEFAULT-DENY for the anon (browser) key: no public SELECT / INSERT /
-- UPDATE / DELETE policies are defined, so the anon key that ships to the
-- browser cannot read or write scout rows directly.
--
-- All reads and writes go through the server API routes, which use the Supabase
-- SERVICE ROLE key (SUPABASE_SERVICE_ROLE_KEY). The service role bypasses RLS
-- entirely, so no policies are needed for server access.
--
-- Do NOT re-add "WITH CHECK (true)" public policies — that is what allowed
-- anyone with the anon key to forge any scout row.
-- ============================================================================

-- Insert initial flagship scout record
INSERT INTO scout_profiles (token, scout_name, completed_pages, quiz_score, referral_score, status)
VALUES ('CAPTAIN-RAY-700', 'Scout Explorer', ARRAY[1, 2], 400, 300, 'Unlock_Volume_3')
ON CONFLICT (token) DO NOTHING;

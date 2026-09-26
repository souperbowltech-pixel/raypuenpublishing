-- ============================================================================
-- Add referred_by_scout_token to scout_profiles for real friend referral tracking
-- Safe to re-run.
-- ============================================================================

alter table public.scout_profiles
  add column if not exists referred_by_scout_token text;

create index if not exists idx_scout_profiles_referred_by
  on public.scout_profiles(referred_by_scout_token);

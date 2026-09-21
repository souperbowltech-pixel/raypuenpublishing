-- Fixes the scout_profiles.status CHECK constraint.
--
-- The original schema only allowed 'Unlock_Volume_3', but Ray's directive #1/#5
-- relabelled the 700-point milestone to 'Unlock_Volume_2' (Book 2). The app now
-- writes 'Unlock_Volume_2', so live Supabase writes were being rejected by the
-- old constraint. Book 3 is tracked separately by the book3_sponsored flag.
--
-- Safe to re-run.

alter table public.scout_profiles
  drop constraint if exists scout_profiles_status_check;

-- Rows written under the old label were the 700-point (Book 2) state.
update public.scout_profiles
  set status = 'Unlock_Volume_2'
  where status = 'Unlock_Volume_3';

alter table public.scout_profiles
  add constraint scout_profiles_status_check
  check (status in ('In_Progress', 'Academic_Pass', 'Unlock_Volume_2'));

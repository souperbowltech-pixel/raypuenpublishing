-- Adds the two columns required by Ray's directives #2 and #6.
--
--  friends_completed : number of the 3 invited friends (0–3) who logged in and
--                      coloured their Page 1. The 300 referral points fire once
--                      this reaches 2 (see lib/gamification REFERRAL_FRIEND_REQUIREMENT).
--  book3_sponsored   : true once a relative's $40 "Grandpa" sponsorship unlocks Book 3.
--
-- Until this migration is applied the app still works: the fields are persisted
-- via the local/in-memory store and derived at read time. Run this to enable
-- cross-device Supabase persistence for both new tracks.

alter table public.scout_profiles
  add column if not exists friends_completed integer not null default 0,
  add column if not exists book3_sponsored boolean not null default false;

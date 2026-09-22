-- Family accounts: each family registers once (parent email + child's first
-- name) and gets its own scout profile, instead of every visitor sharing the
-- demo profile.
--
--  families        : one row per parent email. email_verified_at is set later,
--                    when email confirmation is switched on.
--  family_sessions : one row per signed-in device. Only the SHA-256 hash of the
--                    cookie token is stored, never the token.
--  scout_profiles  : family_id links a child to its family; share_code is the
--                    public code used in the Grandpa QR and friend links.
--
-- Safe to re-run.

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  parent_email text not null unique,
  email_verified_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.families enable row level security;

create table if not exists public.family_sessions (
  token_hash text primary key,
  family_id uuid not null references public.families(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists idx_family_sessions_family on public.family_sessions(family_id);
alter table public.family_sessions enable row level security;

alter table public.scout_profiles
  add column if not exists family_id uuid references public.families(id) on delete cascade,
  add column if not exists share_code text unique;
create index if not exists idx_scout_profiles_family on public.scout_profiles(family_id);

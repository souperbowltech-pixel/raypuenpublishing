-- ============================================================================
-- PUEN PUBLISHING — ONE-TIME PRODUCTION DATABASE SETUP
-- Paste this whole file into Supabase → SQL Editor → Run.
-- Safe to run more than once: every step checks before it changes anything.
-- ============================================================================

-- 1. Scout profiles table (skipped if it already exists)
CREATE TABLE IF NOT EXISTS scout_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  scout_name TEXT NOT NULL DEFAULT 'Young Scout',
  completed_pages INTEGER[] NOT NULL DEFAULT '{}',
  quiz_score INTEGER NOT NULL DEFAULT 0 CHECK (quiz_score >= 0 AND quiz_score <= 400),
  referral_score INTEGER NOT NULL DEFAULT 0 CHECK (referral_score >= 0 AND referral_score <= 300),
  total_score INTEGER GENERATED ALWAYS AS (quiz_score + referral_score) STORED,
  status TEXT NOT NULL DEFAULT 'In_Progress' CHECK (status IN ('In_Progress', 'Academic_Pass', 'Unlock_Volume_2')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scout_profiles_token ON scout_profiles(token);
CREATE INDEX IF NOT EXISTS idx_scout_profiles_status ON scout_profiles(status);
-- Default-deny for the browser key; the server uses the secret/service key.
ALTER TABLE scout_profiles ENABLE ROW LEVEL SECURITY;

-- 2. Sept 16: friend referral + Grandpa columns
alter table public.scout_profiles
  add column if not exists friends_completed integer not null default 0,
  add column if not exists book3_sponsored boolean not null default false;

-- 3. Sept 21: allow the Book 2 status (Unlock_Volume_2)
alter table public.scout_profiles
  drop constraint if exists scout_profiles_status_check;
update public.scout_profiles
  set status = 'Unlock_Volume_2'
  where status = 'Unlock_Volume_3';
alter table public.scout_profiles
  add constraint scout_profiles_status_check
  check (status in ('In_Progress', 'Academic_Pass', 'Unlock_Volume_2'));

-- 4. Sept 21: log of every paid Stripe order
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  stripe_session_id text not null unique,
  order_type text not null default 'retail',
  customer_email text,
  customer_name text,
  amount_total integer,            -- smallest currency unit (cents)
  currency text,
  scout_token text,                -- set for grandpa_sponsorship orders
  metadata jsonb not null default '{}'::jsonb,
  fulfillment_status text not null default 'pending'
    check (fulfillment_status in ('pending', 'fulfilled', 'failed')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_orders_order_type on public.orders(order_type);
create index if not exists idx_orders_fulfillment_status on public.orders(fulfillment_status);
create index if not exists idx_orders_customer_email on public.orders(customer_email);
alter table public.orders enable row level security;

-- 5. Sept 22: family accounts (families, family_sessions, family_id + share_code)
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

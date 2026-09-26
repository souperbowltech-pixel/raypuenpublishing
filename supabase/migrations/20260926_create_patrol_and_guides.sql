-- ============================================================================
-- PUEN PUBLISHING — PATROL LEADERS & PARENT'S GUIDE FUNNEL MIGRATION (t12-t15)
-- Safe to re-run.
-- ============================================================================

-- 1. Patrol Leaders ($10 loss-leader bundle buyers)
create table if not exists public.patrol_leaders (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  stripe_session_id text unique,
  token text unique not null,
  gifts_redeemed_count integer not null default 0 check (gifts_redeemed_count >= 0 and gifts_redeemed_count <= 3),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'claimed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_patrol_leaders_token on public.patrol_leaders(token);
create index if not exists idx_patrol_leaders_email on public.patrol_leaders(email);
alter table public.patrol_leaders enable row level security;

-- 2. Patrol Gift Codes (3 codes per patrol leader)
create table if not exists public.patrol_gifts (
  code text primary key,
  patrol_leader_id uuid not null references public.patrol_leaders(id) on delete cascade,
  slot_number integer not null check (slot_number between 1 and 3),
  redeemed_by_family_id uuid references public.families(id),
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_patrol_gifts_leader on public.patrol_gifts(patrol_leader_id);
alter table public.patrol_gifts enable row level security;

-- 3. Guide Approvals (Ray's One-Click Approval Gate for Free Printed Guide)
create table if not exists public.guide_approvals (
  id uuid primary key default gen_random_uuid(),
  patrol_leader_id uuid not null references public.patrol_leaders(id) on delete cascade,
  approval_token text unique not null,
  recipient_name text not null,
  shipping_address jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_guide_approvals_token on public.guide_approvals(approval_token);
alter table public.guide_approvals enable row level security;

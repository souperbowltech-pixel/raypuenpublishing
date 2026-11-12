-- School requests from puenpublishing.com/neighborhood
--
-- Ray is mailing a letter to school principals about The Neighborhood
-- Chronicles. The page it points to ends in one form, and every request lands
-- here. Ray reads them in /admin, so a request is never lost to an email that
-- did not arrive.
--
-- Only the server writes and reads this table (service role). Row level
-- security is on with no policies, so the public anon key can do neither.
--
-- Safe to re-run. If the table already exists, changed limits are not applied:
-- drop it first only while it holds no real requests.

create table if not exists public.school_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  role text not null check (char_length(role) between 1 and 80),
  school text not null check (char_length(school) between 1 and 150),
  location text not null check (char_length(location) between 1 and 120),
  email text not null check (char_length(email) between 3 and 254),
  phone text check (phone is null or char_length(phone) <= 30),
  copies integer check (copies is null or copies between 1 and 100000),
  message text check (message is null or char_length(message) <= 2000),
  created_at timestamptz not null default now()
);

-- The admin list reads newest first, a page at a time, with the id breaking ties.
create index if not exists idx_school_requests_created_at_id
  on public.school_requests (created_at desc, id desc);

alter table public.school_requests enable row level security;

-- Belt and braces next to RLS: the public keys get no grant at all.
revoke all on public.school_requests from anon, authenticated;

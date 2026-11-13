-- The private library: books opened only with a code
--
-- Ray hands a one-time code to an influencer; a buyer of the digital Parent's
-- Guide receives one after paying. Each code opens one book, and every copy is
-- stamped with the person's name before it is handed over.
--
-- Files live in the private `library` bucket:
--   masters/<slug>.pdf          the reading edition of each book, uploaded by hand
--   copies/<grant>.pdf          the one stamped copy per grant, reused for a day, swept by age
--
-- Only the server reads and writes the table and the bucket (service role). The
-- table has row level security on with no policies and no grants to the public
-- keys; the bucket is private, so storage refuses the public keys too.
--
-- Safe to re-run.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('library', 'library', false, 52428800, array['application/pdf'])
-- If a bucket of this name was made by hand, it is made private and limited here too.
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.library_grants (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('review', 'purchase')),
  book_slug text not null check (char_length(book_slug) between 1 and 60),
  recipient_name text not null check (char_length(recipient_name) between 1 and 60),
  recipient_email text check (recipient_email is null or char_length(recipient_email) between 3 and 254),
  -- HMAC of the code with a secret kept outside the database; the code itself is never stored.
  code_hash text not null unique check (char_length(code_hash) = 64),
  -- One paid copy per Stripe checkout, so a retried webhook cannot make a second.
  stripe_session_id text unique,
  email_sent_at timestamptz,
  expires_at timestamptz not null,
  first_used_at timestamptz,
  download_until timestamptz,
  copy_path text,
  copy_expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- Ray's list reads newest first, a page at a time, with the id breaking ties.
create index if not exists idx_library_grants_created_at_id
  on public.library_grants (created_at desc, id desc);

alter table public.library_grants enable row level security;

revoke all on public.library_grants from anon, authenticated;

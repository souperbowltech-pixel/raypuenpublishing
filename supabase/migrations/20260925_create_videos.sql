-- The five video addresses printed inside the colouring book.
--
-- puenpublishing.com/v1 ... /v5 are printed on paper — as a QR code and a typed
-- line at the bottom of a book page — so the addresses can never change. What
-- plays behind each one is a row in this table, which means swapping a video is
-- a single edit in the Supabase table editor: no code change, no deploy, and no
-- reprint. lib/supabase.ts forces cache: 'no-store' on every call, so an edit is
-- visible on the live site straight away.
--
-- While a video is still being made the row stays status='pending' and the page
-- shows a friendly "on its way" screen. A printed link must never 404.
--
-- provider + video_id are kept separate (never a full URL) so moving the video
-- to a different host later is a two-field edit:
--   youtube    -> video_id is the 11-character id from the YouTube URL
--   cloudflare -> video_id is the 32-character Stream video UID
--   bunny      -> video_id is "<libraryId>/<videoGuid>"
--   vimeo      -> video_id is the numeric video id
--
-- Safe to re-run.

create table if not exists public.videos (
  slug        text primary key,
  title       text not null,
  provider    text not null default 'none'
    check (provider in ('none', 'youtube', 'cloudflare', 'bunny', 'vimeo')),
  video_id    text,
  status      text not null default 'pending'
    check (status in ('pending', 'live')),
  updated_at  timestamptz not null default now()
);

-- Default-deny for the anon (browser) key; the server reads with the service role.
alter table public.videos enable row level security;

-- Seed the five printed addresses so every one of them has a row from day one.
-- Titles are placeholders until Ray confirms what each video covers; changing a
-- title here changes the heading on the live page immediately.
insert into public.videos (slug, title) values
  ('v1', 'Video 1'),
  ('v2', 'Video 2'),
  ('v3', 'Video 3'),
  ('v4', 'Video 4'),
  ('v5', 'Video 5')
on conflict (slug) do nothing;

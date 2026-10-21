-- The welcome film: puenpublishing.com/v6
--
-- v1 to v5 are the story videos, each at a section end. v6 is different: Ray
-- asked for it at the foot of the "This Journey Belongs to" page, so it is the
-- first thing a parent can reach when the book is opened.
--
-- It is printed like the others, which means the address is fixed forever and
-- only this row ever changes. While the row stays status='pending', /v6 shows
-- the friendly "on its way" screen rather than a 404, exactly like the rest.
--
-- To put the film live once it is on YouTube as Unlisted:
--
--   update public.videos
--   set provider = 'youtube', video_id = '<the 11-character id>',
--       status = 'live', updated_at = now()
--   where slug = 'v6';
--
-- No deploy is needed. lib/supabase.ts forces cache: 'no-store', so the change
-- is visible on the live site straight away.
--
-- Safe to re-run.

insert into public.videos (slug, title) values
  ('v6', 'Welcome')
on conflict (slug) do nothing;

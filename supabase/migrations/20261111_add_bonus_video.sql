-- The Bonus Video: Sunny's 700-Point Book 2 Challenge song, on puenpublishing.com/start
--
-- It has no printed address of its own. Ray asked on 11 Nov 2026 for it to play
-- on the Start page, which is the last code in the book, where families go to
-- invite their two friends. While the row stays status='pending' the Start page
-- simply shows the sign-up form, as it does today.
--
-- To put the video live once it is on YouTube as Unlisted:
--
--   update public.videos
--   set provider = 'youtube', video_id = '<the 11-character id>',
--       status = 'live', updated_at = now()
--   where slug = 'bonus';
--
-- No deploy is needed: /start is rendered per request. The title below is
-- Ray's own label from his 11 Nov message and shows above the player.
--
-- Safe to re-run.

insert into public.videos (slug, title) values
  ('bonus', 'The 700-Point Book 2 Challenge')
on conflict (slug) do nothing;

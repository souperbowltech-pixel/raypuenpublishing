-- When Ray was emailed a paid book order to place at IngramSpark.
--
-- Stripe delivers a webhook at least once, and a redelivery upserts the same
-- order row, so the row alone cannot say whether the print email already went.
--
-- notice_claimed_at is a short lease: a delivery takes it before sending, so
-- two deliveries at once cannot both send. It lapses on its own after a few
-- minutes, so a delivery that died mid-send never blocks the email for good.
-- notice_sent_at is written only once the email was accepted, and from then on
-- no delivery sends again, so a duplicate email can never cause a duplicate
-- print run.
--
-- Safe to run more than once.

alter table public.orders add column if not exists notice_claimed_at timestamptz;
alter table public.orders add column if not exists notice_sent_at timestamptz;

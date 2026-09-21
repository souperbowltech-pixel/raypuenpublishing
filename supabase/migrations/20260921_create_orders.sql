-- Durable log of every paid Stripe Checkout session.
--
-- Written by the Stripe webhook (app/api/webhooks/stripe). stripe_session_id is
-- UNIQUE so Stripe's automatic webhook retries upsert the same row instead of
-- creating duplicates. fulfillment_status starts as 'pending' so print/download
-- orders that can't be auto-fulfilled yet (IngramSpark API, Teacher's Manual PDF)
-- are saved safely and none are lost.
--
-- Safe to re-run.

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

-- Default-deny for the anon (browser) key; the server uses the service role.
alter table public.orders enable row level security;

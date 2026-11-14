-- Shared rate limits: one count per key across every server instance.
--
-- The in-memory limiter in lib/rate-limit.ts counts per Vercel instance, so a
-- caller spread across instances gets several times the limit. This table and
-- function make the count shared. Keys arrive as an HMAC under a server-only
-- secret (lib/rate-limit.ts), so the table holds no readable IP address. Rows
-- are tiny and expire; old ones are swept, using the index below.
--
-- Safe to run more than once.

create table if not exists public.rate_limits (
  key       text primary key,
  count     integer     not null,
  reset_at  timestamptz not null
);

create index if not exists rate_limits_reset_at_idx on public.rate_limits (reset_at);

alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;
grant select, insert, update, delete on public.rate_limits to service_role;

-- Counts one hit and says whether it is within the limit, in a single
-- statement, so two requests at the same moment cannot both slip through.
-- Runs with the caller's rights (service_role only), so it needs no special powers.
create or replace function public.hit_rate_limit(p_key text, p_limit integer, p_window_ms integer)
returns table (allowed boolean, retry_after integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  hit record;
begin
  if p_key is null or p_limit is null or p_window_ms is null
     or length(p_key) = 0 or length(p_key) > 128 or p_limit < 1 or p_window_ms < 1000 then
    raise exception 'hit_rate_limit: bad arguments';
  end if;

  insert into public.rate_limits as rl (key, count, reset_at)
  values (p_key, 1, now() + make_interval(secs => p_window_ms / 1000.0))
  on conflict (key) do update set
    count    = case when rl.reset_at <= now() then 1 else rl.count + 1 end,
    reset_at = case when rl.reset_at <= now() then now() + make_interval(secs => p_window_ms / 1000.0) else rl.reset_at end
  returning rl.count, rl.reset_at into hit;

  -- About one call in a hundred sweeps rows that ended over an hour ago.
  if random() < 0.01 then
    delete from public.rate_limits where reset_at < now() - interval '1 hour';
  end if;

  return query select hit.count <= p_limit,
                      greatest(0, ceil(extract(epoch from (hit.reset_at - now()))))::integer;
end;
$$;

revoke all on function public.hit_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, integer, integer) to service_role;

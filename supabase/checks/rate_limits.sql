-- Checks for migration 20261115_create_rate_limits.sql.
-- Run in the Supabase SQL editor after the migration. Every row (14) should say PASS.
-- It checks behaviour and permissions; it cannot test two calls at the same instant.
-- It uses its own test keys and removes them at the end, so it leaves nothing behind.

drop table if exists rate_limit_check;
create temporary table rate_limit_check (step int, name text, ok boolean);

do $$
declare
  r record;
  refused boolean;
begin
  delete from public.rate_limits where key like 'check-%';

  -- 1. The first hit is allowed.
  select * into r from public.hit_rate_limit('check-a', 2, 60000);
  insert into rate_limit_check values (1, 'first hit allowed', r.allowed and r.retry_after = 0);

  -- 2. Hits up to the limit are allowed; the next is refused with a wait inside the window.
  select * into r from public.hit_rate_limit('check-a', 2, 60000);
  insert into rate_limit_check values (2, 'second hit (at the limit) allowed', r.allowed);
  select * into r from public.hit_rate_limit('check-a', 2, 60000);
  insert into rate_limit_check values (3, 'third hit refused, wait 1..60 s', not r.allowed and r.retry_after between 1 and 60);

  -- 3. Once the window has passed, the count starts again.
  update public.rate_limits set reset_at = now() - interval '1 second' where key = 'check-a';
  select * into r from public.hit_rate_limit('check-a', 2, 60000);
  insert into rate_limit_check values (4, 'count resets after the window', r.allowed);
  insert into rate_limit_check
    select 5, 'reset count is 1', count = 1 from public.rate_limits where key = 'check-a';

  -- 4. Bad arguments are refused, NULL included.
  begin
    perform public.hit_rate_limit(null, 2, 60000);
    refused := false;
  exception when others then refused := true;
  end;
  insert into rate_limit_check values (6, 'null key refused', refused);
  begin
    perform public.hit_rate_limit('check-b', null, 60000);
    refused := false;
  exception when others then refused := true;
  end;
  insert into rate_limit_check values (7, 'null limit refused', refused);
  begin
    perform public.hit_rate_limit('check-b', 2, 10);
    refused := false;
  exception when others then refused := true;
  end;
  insert into rate_limit_check values (8, 'window under 1 s refused', refused);

  delete from public.rate_limits where key like 'check-%';
end;
$$;

-- 5. The public keys cannot call it or read the table.
insert into rate_limit_check
  select 9, 'anon cannot execute', not has_function_privilege('anon', 'public.hit_rate_limit(text, integer, integer)', 'execute');
insert into rate_limit_check
  select 10, 'authenticated cannot execute', not has_function_privilege('authenticated', 'public.hit_rate_limit(text, integer, integer)', 'execute');
insert into rate_limit_check
  select 11, 'service_role can execute', has_function_privilege('service_role', 'public.hit_rate_limit(text, integer, integer)', 'execute');
insert into rate_limit_check
  select 12, 'anon cannot read the table', not has_table_privilege('anon', 'public.rate_limits', 'select');
insert into rate_limit_check
  select 13, 'authenticated cannot read the table', not has_table_privilege('authenticated', 'public.rate_limits', 'select');
insert into rate_limit_check
  select 14, 'row level security is on', relrowsecurity from pg_class where oid = 'public.rate_limits'::regclass;

select step, name, case when ok then 'PASS' else 'FAIL' end as result from rate_limit_check order by step;

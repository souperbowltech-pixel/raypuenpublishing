-- Campaign rows and transactional email outbox. Run in staging before production.
-- Campaign functions run as SECURITY INVOKER (the default) on purpose: execute is
-- granted to service_role only, so they use the caller's own permissions and never
-- run with elevated privileges.
begin;

create table public.campaign_votes (
  id uuid primary key default gen_random_uuid(),
  campaign text not null default 'nc-book-1' check (campaign = 'nc-book-1'),
  submission_id uuid not null unique,
  fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  character text not null check (character in ('gideon','sunny','barnabas','lucy','willie')),
  first_name text not null check (length(first_name) between 1 and 50),
  email text not null check (email = lower(trim(email)) and length(email) between 3 and 254),
  answer text check (length(answer) <= 500),
  phone text check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  sms_consent boolean not null default false,
  marketing_consent boolean not null default false,
  consent_version text not null default 'nc-starter-2026-11',
  source text not null check (source in ('direct','fiesta','church','school','melissa-data','dm')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  reserved_quantity integer check (reserved_quantity between 1 and 10),
  reserved_at timestamptz,
  unique(campaign,email),
  check ((phone is not null) = sms_consent),
  check ((reserved_quantity is null) = (reserved_at is null))
);
create index campaign_votes_page on public.campaign_votes(created_at desc,id desc);

create table public.campaign_outbox (
  id uuid primary key default gen_random_uuid(),
  vote_id uuid not null references public.campaign_votes(id) on delete cascade,
  kind text not null check (kind in ('welcome','reservation')),
  created_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts between 0 and 5),
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,
  lease_until timestamptz,
  sent_at timestamptz,
  last_failure text,
  unique(vote_id,kind),
  check ((lease_token is null) = (lease_until is null))
);
create index campaign_outbox_due on public.campaign_outbox(next_attempt_at,id)
  where sent_at is null and attempts < 5;

alter table public.campaign_votes enable row level security;
alter table public.campaign_outbox enable row level security;
revoke all on public.campaign_votes, public.campaign_outbox from anon, authenticated;
grant all on public.campaign_votes, public.campaign_outbox to service_role;

create function public.submit_campaign_vote(p_input jsonb, p_fingerprint text)
returns jsonb language plpgsql set search_path = public as $$
declare v public.campaign_votes; inserted_id uuid;
begin
  insert into public.campaign_votes(submission_id,fingerprint,character,first_name,email,
    answer,phone,sms_consent,marketing_consent,source)
  values ((p_input->>'submissionId')::uuid,p_fingerprint,p_input->>'character',
    p_input->>'firstName',p_input->>'email',p_input->>'answer',p_input->>'phone',
    (p_input->>'smsConsent')::boolean,(p_input->>'marketingConsent')::boolean,p_input->>'source')
  on conflict do nothing returning id into inserted_id;
  if inserted_id is not null then
    insert into public.campaign_outbox(vote_id,kind) values (inserted_id,'welcome');
    select * into v from public.campaign_votes where id = inserted_id;
    return jsonb_build_object('status','saved','id',v.id,'createdAt',v.created_at);
  end if;
  select * into v from public.campaign_votes where submission_id = (p_input->>'submissionId')::uuid;
  if found then
    if v.fingerprint <> p_fingerprint or v.revoked_at is not null then
      return jsonb_build_object('status','conflict');
    end if;
    return jsonb_build_object('status','replay','id',v.id,'createdAt',v.created_at);
  end if;
  -- An email alone cannot prove ownership of an earlier submission.
  return jsonb_build_object('status','duplicate');
end $$;

create function public.reserve_campaign_copy(p_vote_id uuid,p_quantity integer)
returns jsonb language plpgsql set search_path = public as $$
declare v public.campaign_votes;
begin
  if p_quantity is null or p_quantity < 1 or p_quantity > 10 then
    return jsonb_build_object('status','invalid');
  end if;
  select * into v from public.campaign_votes where id = p_vote_id for update;
  if not found or v.revoked_at is not null then return jsonb_build_object('status','invalid'); end if;
  if v.reserved_quantity is not null then
    return jsonb_build_object('status','existing','quantity',v.reserved_quantity);
  end if;
  update public.campaign_votes set reserved_quantity = p_quantity,reserved_at = now() where id = p_vote_id;
  insert into public.campaign_outbox(vote_id,kind) values(p_vote_id,'reservation');
  return jsonb_build_object('status','saved','quantity',p_quantity);
end $$;

create function public.claim_campaign_messages(p_vote_id uuid default null,p_limit integer default 3)
returns setof jsonb language plpgsql set search_path = public as $$
declare job public.campaign_outbox; v public.campaign_votes;
begin
  for job in select o.* from public.campaign_outbox o
    join public.campaign_votes c on c.id = o.vote_id and c.revoked_at is null
    where o.sent_at is null and o.attempts < 5 and o.next_attempt_at <= now()
      and (o.lease_until is null or o.lease_until < now())
      and (p_vote_id is null or o.vote_id = p_vote_id)
    order by o.next_attempt_at,o.id limit greatest(1,least(coalesce(p_limit,3),3))
    for update of o skip locked
  loop
    update public.campaign_outbox set lease_token = gen_random_uuid(),
      lease_until = now() + interval '2 minutes', attempts = attempts + 1
      where id = job.id returning * into job;
    select * into v from public.campaign_votes where id = job.vote_id;
    return next jsonb_build_object('id',job.id,'voteId',v.id,'kind',job.kind,
      'lease',job.lease_token,'attempts',job.attempts,'createdAt',v.created_at,
      'firstName',v.first_name,'email',v.email,'character',v.character,'quantity',v.reserved_quantity);
  end loop;
end $$;

create function public.finish_campaign_message(p_id uuid,p_lease uuid,p_sent boolean,p_failure text default null)
returns boolean language plpgsql set search_path = public as $$
declare touched integer;
begin
  update public.campaign_outbox set
    sent_at = case when p_sent then now() else null end,
    last_failure = case when p_sent then null else left(coalesce(p_failure,'error'),40) end,
    next_attempt_at = now() + make_interval(mins => (power(2,attempts))::integer),
    lease_token = null,lease_until = null
    where id = p_id and lease_token = p_lease and sent_at is null;
  get diagnostics touched = row_count;
  return touched = 1;
end $$;

create function public.campaign_summary()
returns jsonb language sql set search_path = public as $$
  select jsonb_build_object(
    'votes',(select count(*) from public.campaign_votes where revoked_at is null),
    'reservations',(select count(*) from public.campaign_votes where reserved_quantity is not null and revoked_at is null),
    'pendingEmails',(select count(*) from public.campaign_outbox o join public.campaign_votes v on v.id = o.vote_id where o.sent_at is null and v.revoked_at is null),
    'failedEmails',(select count(*) from public.campaign_outbox o join public.campaign_votes v on v.id = o.vote_id where o.sent_at is null and o.attempts >= 5 and v.revoked_at is null),
    'groups',coalesce((select jsonb_agg(g) from (
      select character,source,count(*) as votes from public.campaign_votes
      where revoked_at is null group by character,source order by character,source
    ) g),'[]'::jsonb));
$$;

create function public.campaign_readiness()
returns boolean language sql set search_path = public as $$
  select to_regprocedure('public.hit_rate_limit(text,integer,integer)') is not null
    and exists (select 1 from pg_proc where proname = 'finish_campaign_message'
      and pronamespace = 'public'::regnamespace);
$$;

revoke all on function public.submit_campaign_vote(jsonb,text), public.reserve_campaign_copy(uuid,integer),
  public.claim_campaign_messages(uuid,integer),public.finish_campaign_message(uuid,uuid,boolean,text),
  public.campaign_summary(),public.campaign_readiness() from public,anon,authenticated;
grant execute on function public.submit_campaign_vote(jsonb,text),public.reserve_campaign_copy(uuid,integer),
  public.claim_campaign_messages(uuid,integer),public.finish_campaign_message(uuid,uuid,boolean,text),
  public.campaign_summary(),public.campaign_readiness() to service_role;

commit;

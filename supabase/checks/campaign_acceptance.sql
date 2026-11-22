-- STAGING ONLY: execute after the migration. Every test write is rolled back.
-- This file is executable acceptance coverage, not evidence that it has been run.
begin;
do $$
declare input jsonb; first_result jsonb; replay jsonb; qa_vote_id uuid; jobs jsonb; claimed integer;
begin
  if has_function_privilege('anon','public.submit_campaign_vote(jsonb,text)','execute')
    or has_function_privilege('authenticated','public.campaign_summary()','execute') then
    raise exception 'A01: campaign RPC accessible to public users';
  end if;
  if has_table_privilege('anon','public.campaign_votes','select') then
    raise exception 'A01: anonymous table privilege exists';
  end if;
  input = jsonb_build_object('submissionId',gen_random_uuid(),'character','sunny','firstName','QA',
    'email','qa-' || gen_random_uuid() || '@example.invalid','source','fiesta',
    'smsConsent',false,'marketingConsent',false);
  first_result = public.submit_campaign_vote(input,repeat('a',64));
  if first_result->>'status' <> 'saved' then raise exception 'V01: save failed'; end if;
  qa_vote_id = (first_result->>'id')::uuid;
  replay = public.submit_campaign_vote(input,repeat('a',64));
  if replay->>'status' <> 'replay' or replay->>'id' <> qa_vote_id::text then raise exception 'V05: retry duplicated'; end if;
  replay = public.submit_campaign_vote(input,repeat('b',64));
  if replay->>'status' <> 'conflict' then raise exception 'V05: changed retry accepted'; end if;
  input = jsonb_set(input,'{submissionId}',to_jsonb(gen_random_uuid()::text));
  replay = public.submit_campaign_vote(input,repeat('c',64));
  if replay <> '{"status":"duplicate"}'::jsonb then raise exception 'V06: duplicate leaks receipt'; end if;
  if (select count(*) from public.campaign_outbox where campaign_outbox.vote_id = qa_vote_id and kind = 'welcome') <> 1 then
    raise exception 'V05: duplicate outbox';
  end if;
  if public.reserve_campaign_copy(qa_vote_id,2)->>'status' <> 'saved' then raise exception 'R01: reservation failed'; end if;
  if public.reserve_campaign_copy(qa_vote_id,9)->>'quantity' <> '2' then raise exception 'R02: original quantity changed'; end if;
  select count(*) into claimed from public.claim_campaign_messages(qa_vote_id,99);
  if claimed <> 2 then raise exception 'E02: expected welcome plus owner message'; end if;
  select count(*) into claimed from public.claim_campaign_messages(qa_vote_id,99);
  if claimed <> 0 then raise exception 'E02: active lease claimed twice'; end if;
  select jsonb_build_object('id',id,'lease',lease_token) into jobs from public.campaign_outbox
    where campaign_outbox.vote_id = qa_vote_id and kind = 'welcome';
  if public.finish_campaign_message((jobs->>'id')::uuid,gen_random_uuid(),true,null) then
    raise exception 'E02: wrong lease acknowledged';
  end if;
  if not public.finish_campaign_message((jobs->>'id')::uuid,(jobs->>'lease')::uuid,true,null) then
    raise exception 'E01: valid acknowledgement refused';
  end if;
  -- Force an outbox failure inside the transaction and prove the vote rolls back.
  begin
    insert into public.campaign_votes(submission_id,fingerprint,character,first_name,email,source)
      values(gen_random_uuid(),repeat('d',64),'lucy','Rollback','rollback-' || gen_random_uuid() || '@example.invalid','direct')
      returning id into qa_vote_id;
    insert into public.campaign_outbox(vote_id,kind) values(qa_vote_id,'invalid-kind');
    raise exception 'V09: expected constraint rejection';
  exception when check_violation then
    if exists(select 1 from public.campaign_votes where id = qa_vote_id) then raise exception 'V09: partial transaction'; end if;
  end;
end $$;

-- Fault-inject the actual RPC's second write. Its vote must roll back too.
create function pg_temp.reject_campaign_outbox() returns trigger language plpgsql as $$
begin raise exception 'QA outbox failure' using errcode = '23514'; end $$;
create trigger qa_reject_campaign_outbox before insert on public.campaign_outbox
  for each row execute function pg_temp.reject_campaign_outbox();
do $$
declare request_id uuid := gen_random_uuid(); input jsonb;
begin
  input = jsonb_build_object('submissionId',request_id,'character','lucy','firstName','Rollback',
    'email','qa-' || gen_random_uuid() || '@example.invalid','source','direct',
    'smsConsent',false,'marketingConsent',false);
  begin
    perform public.submit_campaign_vote(input,repeat('e',64));
    raise exception 'V09: actual RPC did not encounter injected outbox failure';
  exception when check_violation then
    if exists(select 1 from public.campaign_votes where submission_id = request_id) then
      raise exception 'V09: actual RPC left an orphan vote';
    end if;
  end;
end $$;
drop trigger qa_reject_campaign_outbox on public.campaign_outbox;
rollback;

-- All participant writes remain current-JWT RPCs. Trusted functions execute as
-- the non-login, non-BYPASSRLS executor, with explicit table policies/grants.
alter table public.collaborations add column current_proposal integer default 1;
alter table public.collaborations add column effective_version integer;
alter table public.collaborations add column latest_submission uuid;

create table public.agreement_versions (
  collaboration_id uuid not null references public.collaborations(id) on delete restrict,
  version integer not null check(version>0),
  kind text not null check(kind in ('initial','amendment')),
  terms jsonb not null,
  status text not null check(status in ('proposed','effective','superseded','withdrawn')),
  proposed_by uuid not null references public.app_users(id),
  brand_confirmed_at timestamptz,
  influencer_confirmed_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  primary key(collaboration_id,version)
);
create table public.collaboration_items (
  id uuid primary key default gen_random_uuid(),
  collaboration_id uuid not null references public.collaborations(id),
  revisions_used integer not null default 0 check(revisions_used between 0 and 5),
  revision_pending boolean not null default false,
  unique(collaboration_id,id)
);
create index collaboration_items_owner on public.collaboration_items(collaboration_id);
create table public.collaboration_messages (
  id uuid primary key,
  collaboration_id uuid not null references public.collaborations(id),
  author_id uuid not null references public.app_users(id),
  body text not null check(length(btrim(body)) between 1 and 6000),
  hidden_at timestamptz,
  hidden_reason text,
  created_at timestamptz not null default now(),
  unique(id,collaboration_id)
);
create index collaboration_messages_page on public.collaboration_messages(collaboration_id,created_at desc,id);
create table public.collaboration_submissions (
  id uuid primary key,
  collaboration_id uuid not null references public.collaborations(id),
  version integer not null check(version>0),
  agreement_version integer not null,
  author_id uuid not null references public.app_users(id),
  items jsonb not null,
  notes text not null default '' check(length(notes)<=6000),
  created_at timestamptz not null default now(),
  unique(collaboration_id,version),
  unique(id,collaboration_id),
  foreign key(collaboration_id,agreement_version) references public.agreement_versions(collaboration_id,version)
);
create index collaboration_submissions_page on public.collaboration_submissions(collaboration_id,created_at desc,id);
alter table public.collaborations add foreign key(latest_submission,id) references public.collaboration_submissions(id,collaboration_id);
create table public.submission_reviews (
  submission_id uuid not null references public.collaboration_submissions(id),
  item_id uuid not null references public.collaboration_items(id),
  actor_id uuid not null references public.app_users(id),
  decision text not null check(decision in ('approved','revision_requested')),
  feedback text not null default '' check(length(feedback)<=3000),
  created_at timestamptz not null default now(),
  primary key(submission_id,item_id)
);
create index submission_reviews_item on public.submission_reviews(item_id);
create table public.cancellation_requests (
  id uuid primary key,
  collaboration_id uuid not null references public.collaborations(id),
  requested_by uuid not null references public.app_users(id),
  reason text not null check(length(btrim(reason)) between 3 and 3000),
  status text not null default 'pending' check(status in ('pending','accepted','declined','withdrawn')),
  responded_by uuid references public.app_users(id),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  support_after timestamptz not null
);
create unique index cancellation_one_pending on public.cancellation_requests(collaboration_id) where status='pending';
create index cancellation_request_owner on public.cancellation_requests(collaboration_id,created_at desc);
create table public.support_reports (
  id uuid primary key,
  reporter_id uuid not null references public.app_users(id),
  collaboration_id uuid references public.collaborations(id),
  opportunity_id uuid references public.opportunities(id),
  member_id uuid references public.app_users(id),
  category text not null check(category in ('inappropriate_content','misleading_profile_brief','access_safety','delivery_disagreement','other')),
  description text not null check(length(btrim(description)) between 10 and 6000),
  status text not null default 'open' check(status in ('open','in_review','resolved','dismissed')),
  assigned_admin uuid references public.app_users(id),
  internal_notes text not null default '' check(length(internal_notes)<=6000),
  outcome text not null default '' check(length(outcome)<=3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(num_nonnulls(collaboration_id,opportunity_id,member_id)=1)
);
create index support_reports_queue on public.support_reports(status,created_at,id);
create index support_reports_reporter on public.support_reports(reporter_id,created_at desc);
create index support_reports_collaboration on public.support_reports(collaboration_id);
create index support_reports_opportunity on public.support_reports(opportunity_id);
create index support_reports_member on public.support_reports(member_id);
create index support_reports_assignee on public.support_reports(assigned_admin,status);
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.app_users(id),
  collaboration_id uuid references public.collaborations(id),
  report_id uuid references public.support_reports(id),
  target_user_id uuid references public.app_users(id),
  kind text not null,
  reason text not null default '' check(length(reason)<=3000),
  visibility text not null default 'participant' check(visibility in ('participant','admin')),
  created_at timestamptz not null default now()
);
create index audit_events_collaboration on public.audit_events(collaboration_id,created_at desc,id);
create index audit_events_report on public.audit_events(report_id,created_at desc);
create index audit_events_actor on public.audit_events(actor_id);
create index audit_events_target on public.audit_events(target_user_id);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.app_users(id),
  opportunity_id uuid references public.opportunities(id),
  collaboration_id uuid references public.collaborations(id),
  report_id uuid references public.support_reports(id),
  kind text not null,
  dedupe_key text not null unique,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_recipient on public.notifications(recipient_id,created_at desc,id);
create index notifications_unread on public.notifications(recipient_id) where read_at is null;
create index notifications_opportunity on public.notifications(opportunity_id);
create index notifications_collaboration on public.notifications(collaboration_id);
create index notifications_report on public.notifications(report_id);
alter table public.marketplace_events add column collaboration_id uuid references public.collaborations(id);
alter table public.marketplace_events add column report_id uuid references public.support_reports(id);
alter table public.marketplace_events add column processed_at timestamptz;
create index marketplace_events_pending on public.marketplace_events(created_at,id) where processed_at is null;

-- Quarantine and clean bytes have no ordinary Storage policies. A separately
-- configured, server-only worker validates identity via user RPC first, scans,
-- promotes and finalizes via service-role-only RPC. No user can assert clean.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('collaboration-quarantine','collaboration-quarantine',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf']),
 ('collaboration-files','collaboration-files',false,10485760,array['image/webp','application/pdf']);
create table public.collaboration_attachments (
  id uuid primary key,
  collaboration_id uuid not null references public.collaborations(id),
  uploaded_by uuid not null references public.app_users(id),
  filename text not null check(length(filename) between 1 and 160),
  reserved_bytes bigint not null check(reserved_bytes between 1 and 10485760),
  state text not null default 'reserved' check(state in ('reserved','quarantined','clean','linked','rejected','purged')),
  size_bytes bigint check(size_bytes between 1 and 10485760),
  sha256 text check(sha256 ~ '^[0-9a-f]{64}$'),
  content_type text check(content_type in ('image/webp','application/pdf')),
  scanner_version text,
  signature_version text,
  signature_at timestamptz,
  scanned_at timestamptz,
  message_id uuid,
  submission_id uuid,
  created_at timestamptz not null default now(),
  foreign key(message_id,collaboration_id) references public.collaboration_messages(id,collaboration_id),
  foreign key(submission_id,collaboration_id) references public.collaboration_submissions(id,collaboration_id),
  check((state='linked' and num_nonnulls(message_id,submission_id)=1) or (state<>'linked' and num_nonnulls(message_id,submission_id)=0)),
  check(state not in('clean','linked') or (size_bytes is not null and sha256 is not null and content_type is not null and scanner_version is not null and signature_version is not null and signature_at is not null and scanned_at is not null))
);
create index attachments_collaboration on public.collaboration_attachments(collaboration_id,state);
create index attachments_uploader on public.collaboration_attachments(uploaded_by,created_at);
create index attachments_message on public.collaboration_attachments(message_id);
create index attachments_submission on public.collaboration_attachments(submission_id);
create index attachments_cleanup on public.collaboration_attachments(created_at) where state not in ('linked','purged');

-- Table mutations are executor-only. Data API reads go through bounded, checked
-- projections so report internal notes and storage attestations cannot leak.
do $$ declare t text; begin
  foreach t in array array['agreement_versions','collaboration_items','collaboration_messages','collaboration_submissions','submission_reviews','cancellation_requests','support_reports','audit_events','notifications','collaboration_attachments'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant select,insert on public.%I to marketplace_executor',t);
    execute format('create policy executor_access on public.%I to marketplace_executor using (true) with check (true)',t);
  end loop;
end $$;

grant update on public.agreement_versions,public.collaboration_items,public.collaboration_messages,public.cancellation_requests,public.support_reports,public.notifications,public.collaboration_attachments,public.marketplace_events to marketplace_executor;
grant insert,update on public.app_users to marketplace_executor;
grant trigger on public.collaborations to marketplace_executor;
create policy executor_membership_insert on public.app_users for insert to marketplace_executor with check(true);
create policy executor_membership_update on public.app_users for update to marketplace_executor using(true) with check(true);

grant marketplace_executor to postgres with inherit false,set true;
grant create on schema marketplace_private to marketplace_executor;
set role marketplace_executor;

create function marketplace_private.normalized_terms(p_collaboration uuid,p_terms jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c public.collaborations; d jsonb; items jsonb:='[]'; item_id uuid; amount bigint; rounds integer; due timestamptz;
begin
 select * into c from public.collaborations where id=p_collaboration;
 perform marketplace_private.validate_terms(p_terms->'deliverables');
 amount:=(p_terms->>'budget_minor')::bigint; rounds:=(p_terms->>'revision_allowance')::integer;due:=(p_terms->>'delivery_deadline')::timestamptz;
 if amount is null or amount not between 1 and 100000000000 or p_terms->>'currency' is distinct from 'LKR' or rounds is null or rounds not between 0 and 5 or due is null or due<=clock_timestamp() or length(btrim(coalesce(p_terms->>'title',''))) not between 5 and 140 then raise exception 'Invalid agreement terms' using errcode='22023';end if;
 for d in select value from jsonb_array_elements(p_terms->'deliverables') loop
   if d->>'id' is null then insert into public.collaboration_items(collaboration_id) values(p_collaboration) returning id into item_id;
   else
     item_id:=(d->>'id')::uuid;
     if not exists(select 1 from public.collaboration_items where id=item_id and collaboration_id=p_collaboration and revisions_used+case when revision_pending then 1 else 0 end<=rounds) then raise exception 'Invalid item identity or revision allowance below rounds already committed' using errcode='22023';end if;
   end if;
   if exists(select 1 from jsonb_array_elements(items) x where x->>'id'=item_id::text) then raise exception 'Duplicate agreement item' using errcode='22023';end if;
   items:=items||jsonb_build_array(jsonb_build_object('id',item_id,'format',btrim(d->>'format'),'quantity',(d->>'quantity')::integer,'acceptance',btrim(d->>'acceptance')));
 end loop;
 return jsonb_build_object('title',btrim(p_terms->>'title'),'deliverables',items,'budget_minor',amount,'currency','LKR','delivery_deadline',due,'revision_allowance',rounds,'brand_id',c.brand_id,'influencer_id',c.influencer_id);
end $$;

create function marketplace_private.seed_collaboration() returns trigger
language plpgsql security invoker set search_path='' as $$
declare v_terms jsonb;
begin
 v_terms:=marketplace_private.normalized_terms(new.id,new.terms);
 update public.collaborations set terms=v_terms where id=new.id;
 insert into public.agreement_versions(collaboration_id,version,kind,terms,status,proposed_by)values(new.id,1,'initial',v_terms,'proposed',new.brand_id);
 return new;
end $$;
create trigger seed_collaboration after insert on public.collaborations for each row execute function marketplace_private.seed_collaboration();
-- Phase 3 created pending snapshots only; never invent historical confirmations.
do $$ declare c public.collaborations; v_terms jsonb; begin
 for c in select * from public.collaborations order by opportunity_id,id loop
   if c.activated_at is not null then raise exception 'Existing activated agreement requires explicit history migration';end if;
   -- Expired historic snapshots can have a past delivery date; retain them as
   -- immutable initial evidence, without opening a new agreement window.
   if (c.terms->>'delivery_deadline')::timestamptz<=clock_timestamp() then
     v_terms:=c.terms;
   else v_terms:=marketplace_private.normalized_terms(c.id,c.terms);end if;
   update public.collaborations set terms=v_terms,current_proposal=case when status='pending_agreement' then 1 else null end where id=c.id;
   insert into public.agreement_versions(collaboration_id,version,kind,terms,status,proposed_by)values(c.id,1,'initial',v_terms,case when c.status='pending_agreement' then 'proposed' else 'withdrawn' end,c.brand_id);
 end loop;
end $$;

create function marketplace_private.emit(p_c public.collaborations,p_kind text,p_key text,p_actor uuid default null) returns void
language sql security invoker set search_path='' as $$
 insert into public.marketplace_events(opportunity_id,collaboration_id,recipient_id,kind,dedupe_key)
 select p_c.opportunity_id,p_c.id,r,p_kind,p_key||':'||r::text from unnest(array[p_c.brand_id,p_c.influencer_id]) r where r is distinct from p_actor on conflict do nothing
$$;

create function marketplace_private.working_days_after(p_time timestamptz,p_days integer) returns timestamptz
language plpgsql immutable security invoker set search_path='' as $$
declare local_time timestamp:=p_time at time zone 'Asia/Colombo'; n integer:=0;
begin
 while n<p_days loop local_time:=local_time+interval '1 day';if extract(isodow from local_time)<6 then n:=n+1;end if;end loop;
 return local_time at time zone 'Asia/Colombo';
end $$;

create function marketplace_private.collaboration_command(p_action text,p_id uuid,p_data jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare m public.app_users;c public.collaborations;v public.agreement_versions;request public.cancellation_requests;
 oid uuid;new_id uuid;target_version integer;v_terms jsonb;d jsonb;item jsonb;v_item_id uuid;result_id uuid;url text;file_id uuid;files uuid[]:='{}';item_files uuid[];normalized_items jsonb:='[]';rounds integer;reason text;v_items jsonb;current_submission public.collaboration_submissions;
begin
 m:=marketplace_private.member();
 if p_action is null or p_action not in ('terms','confirm','withdraw_amendment','decline','cancel_pending','message','submit','approve','revise','request_cancel','respond_cancel','reserve_file','discard_file') or jsonb_typeof(p_data) is distinct from 'object' then raise exception 'Invalid collaboration action' using errcode='22023';end if;
 select opportunity_id into oid from public.collaborations where id=p_id;
 perform 1 from public.opportunities where id=oid for update;
 select * into c from public.collaborations where id=p_id for update;
 if c.id is null or m.id not in(c.brand_id,c.influencer_id) then raise exception 'Participant access required' using errcode='42501';end if;
 perform marketplace_private.reconcile(oid);
 select * into c from public.collaborations where id=p_id;
 reason:=btrim(coalesce(p_data->>'reason',''));
 if length(reason)>3000 then raise exception 'Reason must be 3000 characters or fewer' using errcode='22023';end if;
 if p_action='terms' then
   if c.status not in('pending_agreement','active','submitted','revision_requested') then raise exception 'Agreement cannot be changed now' using errcode='22023';end if;
   if (p_data->>'expected_version')::integer is distinct from coalesce(c.current_proposal,c.terms_version) then raise exception 'Agreement changed. Refresh before editing' using errcode='PT409';end if;
   if c.status='pending_agreement' and m.id<>c.brand_id then raise exception 'Brand proposes pending terms; either participant may decline' using errcode='42501';end if;
   if c.current_proposal is not null then update public.agreement_versions set status='withdrawn' where collaboration_id=c.id and version=c.current_proposal and status='proposed';end if;
   target_version:=(select coalesce(max(version),0)+1 from public.agreement_versions where collaboration_id=c.id);
   v_terms:=marketplace_private.normalized_terms(c.id,p_data->'terms');
   insert into public.agreement_versions(collaboration_id,version,kind,terms,status,proposed_by) values(c.id,target_version,case when c.status='pending_agreement' then 'initial' else 'amendment' end,v_terms,'proposed',m.id);
   update public.collaborations set current_proposal=target_version,
     terms=case when status='pending_agreement' then v_terms else terms end,
     terms_version=case when status='pending_agreement' then target_version else terms_version end,
     agreement_expires_at=case when status='pending_agreement' then least(agreement_expires_at,created_at+interval '7 days',(v_terms->>'delivery_deadline')::timestamptz) else agreement_expires_at end where id=c.id;
   perform marketplace_private.emit(c,'agreement_changed',c.id::text||':terms:'||target_version,m.id);
 elsif p_action='confirm' then
   if c.status not in('pending_agreement','active','submitted','revision_requested') then raise exception 'Agreement cannot be confirmed now' using errcode='22023';end if;
   target_version:=(p_data->>'version')::integer;
   select * into v from public.agreement_versions where collaboration_id=c.id and version=target_version;
   if v.status='effective' and target_version=c.effective_version then return c.id;end if;
   if c.current_proposal is distinct from target_version or v.status is distinct from 'proposed' then raise exception 'Confirm the latest proposal' using errcode='PT409';end if;
   if (v.terms->>'delivery_deadline')::timestamptz<=clock_timestamp() then raise exception 'Agreement delivery date has passed' using errcode='22023';end if;
   update public.agreement_versions set brand_confirmed_at=case when m.id=c.brand_id then coalesce(brand_confirmed_at,clock_timestamp()) else brand_confirmed_at end,influencer_confirmed_at=case when m.id=c.influencer_id then coalesce(influencer_confirmed_at,clock_timestamp()) else influencer_confirmed_at end where collaboration_id=c.id and version=target_version returning * into v;
   perform marketplace_private.emit(c,'agreement_confirmed',c.id::text||':confirm:'||target_version||':'||m.id,m.id);
   if v.brand_confirmed_at is not null and v.influencer_confirmed_at is not null then
     if (select count(*) from public.app_users u where u.id in(c.brand_id,c.influencer_id) and u.status='active')<>2
       or not exists(select 1 from public.brand_profiles where user_id=c.brand_id)
       or not exists(select 1 from public.influencer_profiles where user_id=c.influencer_id)
       or not exists(select 1 from public.social_links where user_id=c.influencer_id) then raise exception 'Both participants need active membership and complete profiles' using errcode='42501';end if;
     update public.agreement_versions set status='superseded' where collaboration_id=c.id and status='effective';
     update public.agreement_versions set status='effective',accepted_at=clock_timestamp() where collaboration_id=c.id and version=target_version;
     update public.collaborations set status='active',terms=v.terms,terms_version=target_version,effective_version=target_version,current_proposal=null,activated_at=coalesce(activated_at,clock_timestamp()),latest_submission=null where id=c.id;
     -- Original submissions/reviews remain immutable evidence; new terms require
     -- a new submission and explicit review, never silent reuse of an approval.
     update public.applications set status='not_selected',updated_at=clock_timestamp() where opportunity_id=oid and status='pending';
     insert into public.marketplace_events(opportunity_id,recipient_id,kind,dedupe_key)
       select oid,influencer_id,'application_not_selected',id::text||':not_selected' from public.applications where opportunity_id=oid and status='not_selected' on conflict do nothing;
     perform marketplace_private.emit(c,'agreement_active',c.id::text||':active:'||target_version);
   end if;
 elsif p_action='withdraw_amendment' then
   if c.status='pending_agreement' or c.current_proposal is null then raise exception 'No active amendment' using errcode='22023';end if;
   update public.agreement_versions set status='withdrawn' where collaboration_id=c.id and version=c.current_proposal and proposed_by=m.id and status='proposed';
   if not found then raise exception 'Only the proposer can withdraw this amendment' using errcode='42501';end if;
   update public.collaborations set current_proposal=null where id=c.id;
 elsif p_action in('decline','cancel_pending') then
   if c.status<>'pending_agreement' or length(reason) not between 3 and 3000 then raise exception 'Pending agreement and reason required' using errcode='22023';end if;
   update public.collaborations set status=case when p_action='decline' then 'declined' else 'cancelled' end,ended_at=clock_timestamp(),current_proposal=null where id=c.id;
   update public.agreement_versions set status='withdrawn' where collaboration_id=c.id and status='proposed';
   update public.applications set status='match_ended',updated_at=clock_timestamp() where id=c.application_id;
   update public.opportunities set selection_until=least(clock_timestamp()+interval '7 days',delivery_deadline),updated_at=clock_timestamp() where id=oid;
   perform marketplace_private.emit(c,'agreement_ended',c.id::text||':ended');
 elsif p_action='message' then
   if c.status not in('pending_agreement','active','submitted','revision_requested') then raise exception 'This thread is read-only' using errcode='22023';end if;
   new_id:=(p_data->>'request_id')::uuid;
   if exists(select 1 from public.collaboration_messages where id=new_id and collaboration_id=c.id and author_id=m.id) then return new_id;end if;
   insert into public.collaboration_messages(id,collaboration_id,author_id,body)values(new_id,c.id,m.id,btrim(p_data->>'body'));
   for file_id in select jsonb_array_elements_text(coalesce(p_data->'attachment_ids','[]'))::uuid loop
     if file_id=any(files) then raise exception 'Duplicate file' using errcode='22023';end if;files:=array_append(files,file_id);
     update public.collaboration_attachments set state='linked',message_id=new_id where id=file_id and collaboration_id=c.id and uploaded_by=m.id and state='clean';
     if not found then raise exception 'Only your scanned clean files may be attached' using errcode='42501';end if;
   end loop;
   if cardinality(files)>5 then raise exception 'At most five attachments' using errcode='22023';end if;
   perform marketplace_private.emit(c,'new_message',new_id::text,m.id);result_id:=new_id;
 elsif p_action='submit' then
   new_id:=(p_data->>'request_id')::uuid;
   if m.id=c.influencer_id and exists(select 1 from public.collaboration_submissions where id=new_id and collaboration_id=c.id and author_id=m.id) then return new_id;end if;
   if m.id<>c.influencer_id or c.status not in('active','revision_requested') then raise exception 'Creator submission is unavailable' using errcode='42501';end if;
   if (p_data->>'agreement_version')::integer is distinct from c.effective_version then raise exception 'Accepted terms changed. Refresh before submitting' using errcode='PT409';end if;
   new_id:=(p_data->>'request_id')::uuid;
   if exists(select 1 from public.collaboration_submissions where id=new_id and collaboration_id=c.id and author_id=m.id) then return new_id;end if;
   v_items:=p_data->'items';
   if jsonb_typeof(v_items) is distinct from 'array' or jsonb_array_length(v_items)<>jsonb_array_length(c.terms->'deliverables') then raise exception 'Submit every agreed deliverable' using errcode='22023';end if;
   for d in select value from jsonb_array_elements(c.terms->'deliverables') loop
     v_item_id:=(d->>'id')::uuid;
     if (select count(*) from jsonb_array_elements(v_items) i where i->>'item_id'=v_item_id::text)<>1 then raise exception 'Each agreed item must appear once' using errcode='22023';end if;
     select value into item from jsonb_array_elements(v_items) where value->>'item_id'=v_item_id::text;
     if jsonb_typeof(item->'urls') is distinct from 'array' or jsonb_typeof(item->'attachment_ids') is distinct from 'array' or jsonb_array_length(item->'urls')>3 or jsonb_array_length(item->'attachment_ids')>5 or jsonb_array_length(item->'urls')+jsonb_array_length(item->'attachment_ids')<1 or length(coalesce(item->>'notes',''))>3000 or(item?'notes' and jsonb_typeof(item->'notes')is distinct from 'string') then raise exception 'Each item needs evidence links or files and bounded notes' using errcode='22023';end if;
     for url in select jsonb_array_elements_text(item->'urls') loop
       if url is null or length(url)>2048 or url~'[[:space:]]' or url !~ '^https://[^/@[:space:]]+([/?#]|$)' then raise exception 'Evidence links must use HTTPS' using errcode='22023';end if;
     end loop;
     item_files:='{}';
     for file_id in select jsonb_array_elements_text(item->'attachment_ids')::uuid loop
       if file_id=any(files) then raise exception 'Duplicate file' using errcode='22023';end if;files:=array_append(files,file_id);
       if not exists(select 1 from public.collaboration_attachments where id=file_id and collaboration_id=c.id and uploaded_by=m.id and state='clean') then raise exception 'Only your scanned clean files may be submitted' using errcode='42501';end if;
       item_files:=array_append(item_files,file_id);
     end loop;
     update public.collaboration_items set revisions_used=revisions_used+case when revision_pending then 1 else 0 end,revision_pending=false where id=v_item_id;
     normalized_items:=normalized_items||jsonb_build_array(jsonb_build_object('item_id',v_item_id,'urls',item->'urls','attachment_ids',to_jsonb(item_files),'notes',coalesce(item->>'notes','')));
   end loop;
   if cardinality(files)>5 then raise exception 'At most five files per submission' using errcode='22023';end if;
   target_version:=(select coalesce(max(version),0)+1 from public.collaboration_submissions where collaboration_id=c.id);
   insert into public.collaboration_submissions(id,collaboration_id,version,agreement_version,author_id,items,notes) values(new_id,c.id,target_version,c.effective_version,m.id,normalized_items,coalesce(p_data->>'notes',''));
   update public.collaboration_attachments set state='linked',submission_id=new_id where id=any(files);
   update public.collaborations set status='submitted',latest_submission=new_id where id=c.id;
   perform marketplace_private.emit(c,'submission_received',new_id::text,m.id);result_id:=new_id;
 elsif p_action in('approve','revise') then
   if m.id<>c.brand_id or c.status<>'submitted' or c.latest_submission is distinct from (p_data->>'submission_id')::uuid then raise exception 'Review the current submission as its brand' using errcode='PT409';end if;
   select * into current_submission from public.collaboration_submissions where id=c.latest_submission;
   if current_submission.agreement_version<>c.effective_version then raise exception 'Submission does not match accepted terms' using errcode='PT409';end if;
   if jsonb_typeof(p_data->'items') is distinct from 'array' or jsonb_array_length(p_data->'items') not between 1 and 10 then raise exception 'Choose deliverables to review' using errcode='22023';end if;
   for item in select value from jsonb_array_elements(p_data->'items') loop
     v_item_id:=(item->>'item_id')::uuid;
     if not exists(select 1 from jsonb_array_elements(c.terms->'deliverables') terms_item where terms_item->>'id'=v_item_id::text) then raise exception 'Unknown deliverable' using errcode='22023';end if;
     if exists(select 1 from public.submission_reviews where submission_id=c.latest_submission and item_id=v_item_id) then raise exception 'This item was already reviewed' using errcode='PT409';end if;
     if p_action='revise' then
       if length(btrim(coalesce(item->>'feedback',''))) not between 3 and 3000 or exists(select 1 from public.collaboration_items where id=v_item_id and revisions_used>=(c.terms->>'revision_allowance')::integer) then raise exception 'Item feedback and remaining revision allowance required' using errcode='22023';end if;
       update public.collaboration_items set revision_pending=true where id=v_item_id;
     end if;
     insert into public.submission_reviews(submission_id,item_id,actor_id,decision,feedback)values(c.latest_submission,v_item_id,m.id,case when p_action='approve' then 'approved' else 'revision_requested' end,coalesce(item->>'feedback',''));
   end loop;
   if p_action='revise' then update public.collaborations set status='revision_requested' where id=c.id;
   elsif (select count(*) from public.submission_reviews where submission_id=c.latest_submission and decision='approved')=jsonb_array_length(c.terms->'deliverables') then
     update public.collaborations set status='completed',ended_at=clock_timestamp(),current_proposal=null where id=c.id;
     update public.agreement_versions set status='withdrawn' where collaboration_id=c.id and status='proposed';
   end if;
   perform marketplace_private.emit(c,case when p_action='approve' then 'submission_approved' else 'revision_requested' end,c.latest_submission::text||':'||p_action||':'||(select count(*) from public.submission_reviews where submission_id=c.latest_submission),m.id);
 elsif p_action='request_cancel' then
   if c.status not in('active','submitted','revision_requested') or length(reason) not between 3 and 3000 then raise exception 'Active work and a cancellation reason required' using errcode='22023';end if;
   new_id:=(p_data->>'request_id')::uuid;
   if exists(select 1 from public.cancellation_requests where id=new_id and requested_by=m.id and collaboration_id=c.id) then return new_id;end if;
   insert into public.cancellation_requests(id,collaboration_id,requested_by,reason,support_after)values(new_id,c.id,m.id,reason,marketplace_private.working_days_after(clock_timestamp(),3));
   perform marketplace_private.emit(c,'cancellation_requested',new_id::text,m.id);result_id:=new_id;
 elsif p_action='respond_cancel' then
   select * into request from public.cancellation_requests where id=(p_data->>'request_id')::uuid and collaboration_id=c.id for update;
   if request.id is null or request.status<>'pending' or c.status not in('active','submitted','revision_requested') then raise exception 'Pending cancellation required' using errcode='22023';end if;
   if p_data->>'decision'='withdraw' and request.requested_by=m.id then update public.cancellation_requests set status='withdrawn',responded_by=m.id,responded_at=clock_timestamp() where id=request.id;
   elsif p_data->>'decision' in('accept','decline') and request.requested_by<>m.id then
     update public.cancellation_requests set status=case when p_data->>'decision'='accept' then 'accepted' else 'declined' end,responded_by=m.id,responded_at=clock_timestamp() where id=request.id;
     if p_data->>'decision'='accept' then
       update public.collaborations set status='cancelled',ended_at=clock_timestamp(),current_proposal=null where id=c.id;
       update public.agreement_versions set status='withdrawn' where collaboration_id=c.id and status='proposed';
     end if;
   else raise exception 'Only the other party may accept/decline, or requester withdraw' using errcode='42501';end if;
   perform marketplace_private.emit(c,'cancellation_outcome',request.id::text||':'||(p_data->>'decision'));
 elsif p_action='reserve_file' then
   if c.status not in('pending_agreement','active','submitted','revision_requested') then raise exception 'Uploads are unavailable for closed work' using errcode='22023';end if;
   new_id:=(p_data->>'request_id')::uuid;
   if exists(select 1 from public.collaboration_attachments where id=new_id and collaboration_id=c.id and uploaded_by=m.id) then return new_id;end if;
   if (select count(*) from public.collaboration_attachments where collaboration_id=c.id and state<>'purged')>=200 or (select count(*) from public.collaboration_attachments where collaboration_id=c.id and uploaded_by=m.id and state not in('linked','purged'))>=10 then raise exception 'Too many stored or pending files; discard unused files first' using errcode='22023';end if;
   if (select coalesce(sum(case when state in('clean','linked') then size_bytes else 2*reserved_bytes end),0) from public.collaboration_attachments where collaboration_id=c.id and state<>'purged')+2*(p_data->>'size')::bigint>104857600 then raise exception 'This collaboration has reached its 100 MB file allowance' using errcode='22023';end if;
   insert into public.collaboration_attachments(id,collaboration_id,uploaded_by,filename,reserved_bytes)values(new_id,c.id,m.id,left(regexp_replace(p_data->>'filename','[[:cntrl:]/\\]','_','g'),160),(p_data->>'size')::bigint);result_id:=new_id;
 elsif p_action='discard_file' then
   update public.collaboration_attachments set state='rejected' where id=(p_data->>'file_id')::uuid and collaboration_id=c.id and uploaded_by=m.id and state in('reserved','quarantined','clean');
   if not found then raise exception 'Unlinked own file required' using errcode='42501';end if;
 end if;
 insert into public.audit_events(actor_id,collaboration_id,kind,reason)values(m.id,c.id,p_action,reason);
 return coalesce(result_id,c.id);
end $$;


create function marketplace_private.support_command(p_action text,p_id uuid,p_data jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare m public.app_users;r public.support_reports;c public.collaborations;o public.opportunities;target public.app_users;new_id uuid;reason text;related uuid;next_status text;
begin
 m:=marketplace_private.member();reason:=btrim(coalesce(p_data->>'reason',''));
 if p_action is null or p_action not in('report','claim','release','resolve','case_cancel','hide_message','moderate_opportunity','member_grant','member_status') or jsonb_typeof(p_data) is distinct from 'object' then raise exception 'Invalid support action' using errcode='22023';end if;
 if p_action='report' then
   if m.role='admin' then raise exception 'Support staff cannot manufacture participant reports' using errcode='42501';end if;
   new_id:=(p_data->>'request_id')::uuid;
   if exists(select 1 from public.support_reports where id=new_id and reporter_id=m.id) then return new_id;end if;
   if p_data->>'collaboration_id' is not null then
     related:=(p_data->>'collaboration_id')::uuid;
     if not exists(select 1 from public.collaborations where id=related and m.id in(brand_id,influencer_id)) then raise exception 'Only participants can report private work' using errcode='42501';end if;
   elsif p_data->>'opportunity_id' is not null then
     related:=(p_data->>'opportunity_id')::uuid;
     if not exists(select 1 from public.opportunities where id=related and (brand_id=m.id or(published_at is not null and hidden_at is null))) then raise exception 'Opportunity unavailable' using errcode='42501';end if;
   elsif p_data->>'member_id' is not null then
     if marketplace_private.profile((p_data->>'member_id')::uuid) is null then raise exception 'Member profile unavailable' using errcode='42501';end if;
   else raise exception 'Select the reported record' using errcode='22023';end if;
   insert into public.support_reports(id,reporter_id,collaboration_id,opportunity_id,member_id,category,description)
   values(new_id,m.id,(p_data->>'collaboration_id')::uuid,(p_data->>'opportunity_id')::uuid,(p_data->>'member_id')::uuid,p_data->>'category',btrim(p_data->>'description'));
   insert into public.audit_events(actor_id,report_id,kind,visibility)values(m.id,new_id,'report_opened','admin');return new_id;
 end if;
 if m.role<>'admin' or length(reason) not between 3 and 1000 then raise exception 'Administrator access and a recorded reason required' using errcode='42501';end if;
 if p_action in('member_grant','member_status') then
   if p_action='member_grant' then
     if p_data->>'clerk_user_id' is null or p_data->>'clerk_user_id' !~ '^user_[A-Za-z0-9]{5,240}$' or p_data->>'role' is null or p_data->>'role' not in('brand','influencer') then raise exception 'Approved account identifier and fixed brand/creator role required; administrator grants use owner bootstrap' using errcode='22023';end if;
     insert into public.app_users(clerk_user_id,role)values(p_data->>'clerk_user_id',p_data->>'role') on conflict(clerk_user_id) do nothing;
     select * into target from public.app_users where clerk_user_id=p_data->>'clerk_user_id';
     if target.role is distinct from p_data->>'role' then raise exception 'An existing member role cannot be switched' using errcode='22023';end if;
   else
     perform 1 from public.app_users where role='admin' order by id for update;
     select * into target from public.app_users where id=p_id for update;
     next_status:=p_data->>'status';
     if target.id is null or next_status is null or next_status not in('active','suspended') then raise exception 'Select a member and status' using errcode='22023';end if;
     if target.id=m.id then raise exception 'Administrators cannot change their own membership status' using errcode='42501';end if;
     -- Serialize admin restrictions so concurrent requests cannot suspend the
     -- last two administrators independently and leave no support access.
     if target.role='admin' and next_status='suspended' and (select count(*) from public.app_users where role='admin' and status='active')<=1 then raise exception 'At least one active administrator must remain' using errcode='22023';end if;
     update public.app_users set status=next_status where id=target.id;
     insert into public.notifications(recipient_id,kind,dedupe_key)values(target.id,'membership_'||next_status,gen_random_uuid()::text);
   end if;
   insert into public.audit_events(actor_id,target_user_id,kind,reason,visibility)values(m.id,target.id,p_action,reason,'admin');return target.id;
 end if;
 -- Read linkage first, then acquire the same opportunity→collaboration order
 -- as participant actions/cron before locking the case. No report-held wait on
 -- an opportunity can form a cycle with event/notification foreign keys.
 select * into r from public.support_reports where id=p_id;
 if r.collaboration_id is not null and p_action in('case_cancel','hide_message') then
   select opportunity_id into related from public.collaborations where id=r.collaboration_id;
   perform 1 from public.opportunities where id=related for update;
   perform 1 from public.collaborations where id=r.collaboration_id for update;
 elsif r.opportunity_id is not null and p_action='moderate_opportunity' then
   perform 1 from public.opportunities where id=r.opportunity_id for update;
 end if;
 select * into r from public.support_reports where id=p_id for update;
 if r.id is null then raise exception 'Support report unavailable' using errcode='42501';end if;
 if p_action='claim' then
   if r.status<>'open' and r.assigned_admin is distinct from m.id then raise exception 'Report is assigned to another administrator' using errcode='42501';end if;
   if r.status in('resolved','dismissed') then raise exception 'Closed reports cannot be claimed again' using errcode='22023';end if;
   update public.support_reports set status='in_review',assigned_admin=m.id,updated_at=clock_timestamp() where id=r.id;
 else
   if r.assigned_admin is distinct from m.id or r.status<>'in_review' then raise exception 'Claim this open report before intervening' using errcode='42501';end if;
   if p_action='release' then update public.support_reports set status='open',assigned_admin=null,updated_at=clock_timestamp() where id=r.id;
   elsif p_action='resolve' then
     if p_data->>'status' not in('resolved','dismissed') or length(btrim(coalesce(p_data->>'outcome',''))) not between 3 and 3000 then raise exception 'Shareable outcome and resolution required' using errcode='22023';end if;
     update public.support_reports set status=p_data->>'status',outcome=btrim(p_data->>'outcome'),internal_notes=coalesce(p_data->>'internal_notes',''),updated_at=clock_timestamp() where id=r.id;
   elsif p_action='case_cancel' then
     if r.collaboration_id is null then raise exception 'A related collaboration report is required' using errcode='42501';end if;
     select opportunity_id into related from public.collaborations where id=r.collaboration_id;
     perform 1 from public.opportunities where id=related for update;
     select * into c from public.collaborations where id=r.collaboration_id for update;
     if c.status not in('active','submitted','revision_requested') then raise exception 'Only active work can be cancelled; completion cannot be undone' using errcode='22023';end if;
     update public.collaborations set status='cancelled',ended_at=clock_timestamp(),current_proposal=null where id=c.id;
     update public.agreement_versions set status='withdrawn' where collaboration_id=c.id and status='proposed';
     update public.cancellation_requests set status='accepted',responded_by=m.id,responded_at=clock_timestamp() where collaboration_id=c.id and status='pending';
     insert into public.audit_events(actor_id,collaboration_id,report_id,kind,reason)values(m.id,c.id,r.id,'administrator_cancellation',reason);
     perform marketplace_private.emit(c,'administrator_cancellation',r.id::text||':cancel');
   elsif p_action='hide_message' then
     if r.collaboration_id is null then raise exception 'A related collaboration report is required' using errcode='42501';end if;
     update public.collaboration_messages set hidden_at=clock_timestamp(),hidden_reason=reason where id=(p_data->>'message_id')::uuid and collaboration_id=r.collaboration_id;
     if not found then raise exception 'Message is outside this report' using errcode='42501';end if;
   elsif p_action='moderate_opportunity' then
     if r.opportunity_id is null then raise exception 'An opportunity report is required' using errcode='42501';end if;
     select * into o from public.opportunities where id=r.opportunity_id for update;
     update public.opportunities set hidden_at=clock_timestamp(),status='closed',close_reason='moderation',updated_at=clock_timestamp() where id=o.id;
   end if;
 end if;
 insert into public.audit_events(actor_id,report_id,kind,reason,visibility)values(m.id,r.id,p_action,reason,'admin');
 insert into public.notifications(recipient_id,report_id,kind,dedupe_key)values(r.reporter_id,r.id,'report_'||p_action,gen_random_uuid()::text);
 return r.id;
end $$;

create function marketplace_private.collaboration_read(p_kind text,p_id uuid,p_filters jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare m public.app_users;c public.collaborations;oid uuid;v_limit integer;v_offset integer;result jsonb;
begin
 m:=marketplace_private.member();v_limit:=greatest(1,least(coalesce((p_filters->>'limit')::integer,20),50));v_offset:=greatest(0,least(coalesce((p_filters->>'offset')::integer,0),100000));
 if p_kind='list' then
   select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id),'[]') into result from(
     select lc.id,lc.status,lc.terms,lc.terms_version,lc.effective_version,lc.current_proposal,lc.agreement_expires_at,lc.activated_at,lc.created_at,
       (select display_name from public.brand_profiles where user_id=lc.brand_id) brand_name,
       (select display_name from public.influencer_profiles where user_id=lc.influencer_id) influencer_name
     from public.collaborations lc where m.id in(lc.brand_id,lc.influencer_id) order by lc.created_at desc,lc.id limit v_limit offset v_offset
   )x;
   return jsonb_build_object('items',result,'total',(select count(*) from public.collaborations where m.id in(brand_id,influencer_id)));
 elsif p_kind in('versions','messages','submissions','history','files','cancellations') then
   select * into c from public.collaborations where id=p_id;
   if c.id is null or m.id not in(c.brand_id,c.influencer_id) then raise exception 'Participant access required' using errcode='42501';end if;
   if p_kind='versions' then
     return jsonb_build_object('items',(select coalesce(jsonb_agg(to_jsonb(x) order by version desc),'[]')from(select * from public.agreement_versions where collaboration_id=p_id order by version desc limit v_limit offset v_offset)x),'total',(select count(*)from public.agreement_versions where collaboration_id=p_id));
   elsif p_kind='messages' then
     return jsonb_build_object('items',(select coalesce(jsonb_agg(to_jsonb(x) order by created_at desc,id),'[]')from(select id,author_id,case when hidden_at is null then body else '[Message hidden by support]' end body,hidden_at,created_at from public.collaboration_messages where collaboration_id=p_id order by created_at desc,id limit v_limit offset v_offset)x),'total',(select count(*)from public.collaboration_messages where collaboration_id=p_id));
   elsif p_kind='submissions' then
     return jsonb_build_object('items',(select coalesce(jsonb_agg(to_jsonb(x)||jsonb_build_object('reviews',(select coalesce(jsonb_agg(to_jsonb(rr)),'[]')from public.submission_reviews rr where submission_id=x.id)) order by version desc),'[]')from(select * from public.collaboration_submissions where collaboration_id=p_id order by version desc limit v_limit offset v_offset)x),'total',(select count(*)from public.collaboration_submissions where collaboration_id=p_id));
   elsif p_kind='history' then
     return jsonb_build_object('items',(select coalesce(jsonb_agg(to_jsonb(x) order by created_at desc,id),'[]')from(select id,actor_id,kind,reason,created_at from public.audit_events where collaboration_id=p_id and visibility='participant' order by created_at desc,id limit v_limit offset v_offset)x),'total',(select count(*)from public.audit_events where collaboration_id=p_id and visibility='participant'));
   elsif p_kind='cancellations' then
     return jsonb_build_object('items',(select coalesce(jsonb_agg(to_jsonb(x)order by created_at desc,id),'[]')from(select * from public.cancellation_requests where collaboration_id=p_id order by created_at desc,id limit v_limit offset v_offset)x),'total',(select count(*)from public.cancellation_requests where collaboration_id=p_id));
   else
     return jsonb_build_object('items',(select coalesce(jsonb_agg(to_jsonb(x) order by created_at desc,id),'[]')from(select a.id,a.filename,a.state,a.size_bytes,a.message_id,a.submission_id,a.uploaded_by,a.created_at from public.collaboration_attachments a where collaboration_id=p_id and(state='linked' or uploaded_by=m.id)and state<>'purged' order by created_at desc,id limit v_limit offset v_offset)x),'total',(select count(*)from public.collaboration_attachments where collaboration_id=p_id and(state='linked' or uploaded_by=m.id)and state<>'purged'));
   end if;
 elsif p_kind='detail' then
   select opportunity_id into oid from public.collaborations where id=p_id;
   perform 1 from public.opportunities where id=oid for update;
   select * into c from public.collaborations where id=p_id for update;
   if c.id is null or m.id not in(c.brand_id,c.influencer_id) then return null;end if;
   perform marketplace_private.reconcile(oid);select * into c from public.collaborations where id=p_id;
   return jsonb_build_object('collaboration',to_jsonb(c),'versions',(select coalesce(jsonb_agg(to_jsonb(v) order by version desc),'[]') from(select * from public.agreement_versions where collaboration_id=p_id order by version desc limit 20)v),
    'items',(select coalesce(jsonb_agg(to_jsonb(i)),'[]') from public.collaboration_items i where collaboration_id=p_id and id in(select (value->>'id')::uuid from jsonb_array_elements(c.terms->'deliverables') union select(value->>'id')::uuid from public.agreement_versions av cross join lateral jsonb_array_elements(av.terms->'deliverables')where av.collaboration_id=p_id and av.version=c.current_proposal)),
    'messages',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'author_id',x.author_id,'body',case when x.hidden_at is null then x.body else '[Message hidden by support]' end,'hidden_at',x.hidden_at,'created_at',x.created_at) order by x.created_at desc,x.id),'[]') from(select * from public.collaboration_messages where collaboration_id=p_id order by created_at desc,id limit v_limit offset v_offset)x),
    'message_count',(select count(*) from public.collaboration_messages where collaboration_id=p_id),
    'submissions',(select coalesce(jsonb_agg(to_jsonb(x) order by version desc),'[]') from(select * from public.collaboration_submissions where collaboration_id=p_id order by version desc limit 20)x),
    'reviews',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from public.submission_reviews r where submission_id in(select id from public.collaboration_submissions where collaboration_id=p_id order by version desc limit 20)),
    'cancellations',(select coalesce(jsonb_agg(to_jsonb(x) order by created_at desc),'[]') from(select * from public.cancellation_requests where collaboration_id=p_id order by created_at desc limit 20)x),
    'files',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'filename',a.filename,'state',a.state,'size_bytes',a.size_bytes,'message_id',a.message_id,'submission_id',a.submission_id,'uploaded_by',a.uploaded_by)),'[]') from(select * from public.collaboration_attachments where collaboration_id=p_id and(state='linked' or uploaded_by=m.id)and state<>'purged' order by created_at desc,id limit 50)a),
    'stored_bytes',(select coalesce(sum(case when state in('clean','linked') then size_bytes else 2*reserved_bytes end),0) from public.collaboration_attachments where collaboration_id=p_id and state<>'purged'),
    'history',(select coalesce(jsonb_agg(to_jsonb(x) order by created_at desc,id),'[]') from(select actor_id,kind,reason,created_at,id from public.audit_events where collaboration_id=p_id and visibility='participant' order by created_at desc,id limit 50)x));
 elsif p_kind='notifications' then
   return (with visible as(
     select n.id,n.kind,case when op.brand_id=m.id or(op.published_at is not null and op.hidden_at is null)then n.opportunity_id else null end opportunity_id,n.collaboration_id,n.report_id,n.read_at,n.created_at
     from public.notifications n left join public.opportunities op on op.id=n.opportunity_id
     where n.recipient_id=m.id
      and(n.collaboration_id is null or exists(select 1 from public.collaborations nc where nc.id=n.collaboration_id and m.id in(nc.brand_id,nc.influencer_id)))
      and(n.report_id is null or exists(select 1 from public.support_reports nr where nr.id=n.report_id and(nr.reporter_id=m.id or nr.assigned_admin=m.id)))
      and(n.opportunity_id is null or n.collaboration_id is not null or op.brand_id=m.id or(op.published_at is not null and op.hidden_at is null)or(n.kind like 'application_%' and exists(select 1 from public.applications na where na.opportunity_id=n.opportunity_id and na.influencer_id=m.id)))
   )select jsonb_build_object('items',(select coalesce(jsonb_agg(to_jsonb(x) order by created_at desc,id),'[]')from(select * from visible order by created_at desc,id limit v_limit offset v_offset)x),'total',(select count(*)from visible),'unread',(select count(*)from visible where read_at is null)));
 elsif p_kind='reports' then
   return jsonb_build_object('items',(select coalesce(jsonb_agg(to_jsonb(x) order by created_at desc,id),'[]') from(select id,category,description,status,outcome,collaboration_id,opportunity_id,member_id,created_at,updated_at from public.support_reports where reporter_id=m.id order by created_at desc,id limit v_limit offset v_offset)x),'total',(select count(*) from public.support_reports where reporter_id=m.id));
 elsif p_kind in('admin_reports','admin_members','admin_audit') then
   if m.role<>'admin' then raise exception 'Administrator membership required' using errcode='42501';end if;
   if p_kind='admin_reports' then
     return jsonb_build_object('items',(select coalesce(jsonb_agg(to_jsonb(x) order by created_at,id),'[]') from(select id,category,status,assigned_admin,created_at from public.support_reports order by created_at,id limit v_limit offset v_offset)x),'total',(select count(*) from public.support_reports));
   elsif p_kind='admin_members' then
     return jsonb_build_object('items',(select coalesce(jsonb_agg(to_jsonb(x) order by created_at desc,id),'[]') from(select id,role,status,created_at,coalesce((select display_name from public.brand_profiles where user_id=u.id),(select display_name from public.influencer_profiles where user_id=u.id),'Profile pending') display_name from public.app_users u order by created_at desc,id limit v_limit offset v_offset)x),'total',(select count(*) from public.app_users));
   else return jsonb_build_object('items',(select coalesce(jsonb_agg(to_jsonb(x) order by created_at desc,id),'[]') from(select * from public.audit_events where visibility='admin' order by created_at desc,id limit v_limit offset v_offset)x),'total',(select count(*) from public.audit_events where visibility='admin'));end if;
 end if;
 raise exception 'Unknown collaboration query' using errcode='22023';
end $$;

create function marketplace_private.case_read(p_id uuid,p_reason text,p_filters jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare m public.app_users;r public.support_reports;result jsonb;v_offset integer:=greatest(0,least(coalesce((p_filters->>'offset')::integer,0),100000));
begin
 m:=marketplace_private.member();
 select * into r from public.support_reports where id=p_id;
 if m.role<>'admin' or r.assigned_admin is distinct from m.id or r.status<>'in_review' or length(btrim(coalesce(p_reason,''))) not between 3 and 1000 then raise exception 'Assigned open case and recorded access reason required' using errcode='42501';end if;
 insert into public.audit_events(actor_id,report_id,kind,reason,visibility)values(m.id,r.id,'case_access',btrim(p_reason),'admin');
 return jsonb_build_object('report',to_jsonb(r),
  'collaboration',(select to_jsonb(c) from public.collaborations c where id=r.collaboration_id),
  'opportunity',(select to_jsonb(o) from public.opportunities o where id=r.opportunity_id),
  'member',case when r.member_id is not null then marketplace_private.profile(r.member_id) else null end,
  'messages',(select coalesce(jsonb_agg(to_jsonb(x) order by created_at desc,id),'[]') from(select * from public.collaboration_messages where collaboration_id=r.collaboration_id order by created_at desc,id limit 20 offset v_offset)x),
  'message_count',(select count(*)from public.collaboration_messages where collaboration_id=r.collaboration_id),
  'submissions',(select coalesce(jsonb_agg(to_jsonb(x) order by version desc),'[]') from(select * from public.collaboration_submissions where collaboration_id=r.collaboration_id order by version desc limit 20 offset v_offset)x),
  'submission_count',(select count(*)from public.collaboration_submissions where collaboration_id=r.collaboration_id),
  'versions',(select coalesce(jsonb_agg(to_jsonb(x)order by version desc),'[]')from(select * from public.agreement_versions where collaboration_id=r.collaboration_id order by version desc limit 20 offset v_offset)x),
  'version_count',(select count(*)from public.agreement_versions where collaboration_id=r.collaboration_id),
  'files',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'filename',filename,'size_bytes',size_bytes,'message_id',message_id,'submission_id',submission_id)),'[]') from(select * from public.collaboration_attachments where collaboration_id=r.collaboration_id and state='linked' order by created_at desc,id limit 50 offset v_offset)x));
end $$;

create function marketplace_private.mark_notification(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare m public.app_users;begin m:=marketplace_private.member();update public.notifications set read_at=coalesce(read_at,clock_timestamp()) where id=p_id and recipient_id=m.id;end $$;

-- Only this service-role entrypoint can attest clean bytes; ordinary signed-in
-- requests cannot call it, write the attestation table, or read either bucket.
create function marketplace_private.attachment_worker(p_action text,p_id uuid,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.collaboration_attachments;c public.collaborations;oid uuid;v_size bigint;v_at timestamptz;
begin
 if p_action is null or p_action not in('quarantine','finalize','reject','purged','cleanup') or jsonb_typeof(p_data) is distinct from 'object' then raise exception 'Invalid worker action' using errcode='22023';end if;
 if p_action='cleanup' then return (select coalesce(jsonb_agg(to_jsonb(x)),'[]') from(select id,collaboration_id,state from public.collaboration_attachments where state not in('linked','purged') and created_at<clock_timestamp()-interval '24 hours' order by created_at,id limit 50)x);end if;
 select collaboration_id into oid from public.collaboration_attachments where id=p_id;
 select opportunity_id into oid from public.collaborations where id=oid;
 perform 1 from public.opportunities where id=oid for update;
 select c0.* into c from public.collaborations c0 join public.collaboration_attachments a0 on a0.collaboration_id=c0.id where a0.id=p_id for update of c0;
 select * into a from public.collaboration_attachments where id=p_id for update;
 if a.id is null then raise exception 'Reservation unavailable' using errcode='22023';end if;
 if p_action='quarantine' then
   if a.state<>'reserved' then raise exception 'Reservation already processed' using errcode='PT409';end if;
   update public.collaboration_attachments set state='quarantined' where id=a.id;
 elsif p_action='finalize' then
   if a.state<>'quarantined' then raise exception 'Quarantined reservation required' using errcode='PT409';end if;
   v_size:=(p_data->>'size')::bigint;v_at:=(p_data->>'signature_at')::timestamptz;
   if v_size is null or v_size not between 1 and a.reserved_bytes or p_data->>'quarantine_removed' is distinct from 'true' or v_at is null or v_at<clock_timestamp()-interval '48 hours' or v_at>clock_timestamp()+interval '5 minutes'
     or p_data->>'sha256' !~ '^[0-9a-f]{64}$' or p_data->>'content_type' not in('image/webp','application/pdf') or length(coalesce(p_data->>'scanner_version','')) not between 1 and 100 or length(coalesce(p_data->>'signature_version','')) not between 1 and 100 then raise exception 'Valid fresh scan attestation required' using errcode='22023';end if;
   if not exists(select 1 from public.app_users where id=a.uploaded_by and status='active') or c.status not in('pending_agreement','active','submitted','revision_requested') then raise exception 'Uploader or collaboration access changed' using errcode='42501';end if;
   if (select coalesce(sum(case when state in('clean','linked') then size_bytes else 2*reserved_bytes end),0) from public.collaboration_attachments where collaboration_id=c.id and state<>'purged' and id<>a.id)+v_size>104857600 then raise exception 'Collaboration file quota exceeded' using errcode='22023';end if;
   update public.collaboration_attachments set state='clean',size_bytes=v_size,sha256=p_data->>'sha256',content_type=p_data->>'content_type',scanner_version=p_data->>'scanner_version',signature_version=p_data->>'signature_version',signature_at=v_at,scanned_at=clock_timestamp() where id=a.id;
 elsif p_action='reject' then
   if a.state='linked' then raise exception 'Linked evidence cannot be discarded' using errcode='42501';end if;
   update public.collaboration_attachments set state='rejected' where id=a.id;
 elsif p_action='purged' then
   if a.state='linked' then raise exception 'Linked evidence cannot be purged' using errcode='42501';end if;
   if p_data->>'quarantine_removed' is distinct from 'true' or p_data->>'clean_removed' is distinct from 'true' then raise exception 'Physical deletion of both copies must be confirmed first' using errcode='22023';end if;
   update public.collaboration_attachments set state='purged' where id=a.id;
 end if;
 return jsonb_build_object('id',a.id,'collaboration_id',a.collaboration_id);
end $$;

create function marketplace_private.attachment_access(p_id uuid,p_report uuid,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare m public.app_users;a public.collaboration_attachments;c public.collaborations;r public.support_reports;
begin
 m:=marketplace_private.member();select * into a from public.collaboration_attachments where id=p_id;
 select * into c from public.collaborations where id=a.collaboration_id;
 if a.id is null or a.state not in('clean','linked') then return null;end if;
 if m.id in(c.brand_id,c.influencer_id) then
   if a.state='clean' and a.uploaded_by<>m.id then raise exception 'Unlinked file is private to its uploader' using errcode='42501';end if;
   if a.message_id is not null and exists(select 1 from public.collaboration_messages where id=a.message_id and hidden_at is not null) then return null;end if;
 else
   select * into r from public.support_reports where id=p_report;
   if a.state<>'linked' then raise exception 'Unshared uploads remain private to their uploader' using errcode='42501';end if;
   if m.role<>'admin' or r.assigned_admin is distinct from m.id or r.status<>'in_review' or r.collaboration_id is distinct from c.id or length(btrim(coalesce(p_reason,''))) not between 3 and 1000 then raise exception 'Participant or assigned case access required' using errcode='42501';end if;
   insert into public.audit_events(actor_id,report_id,kind,reason,visibility)values(m.id,r.id,'attachment_access',btrim(p_reason),'admin');
 end if;
 return jsonb_build_object('id',a.id,'collaboration_id',a.collaboration_id,'filename',a.filename,'size_bytes',a.size_bytes,'sha256',a.sha256,'content_type',a.content_type);
end $$;

create or replace function marketplace_private.reconcile(p_id uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare o public.opportunities;c public.collaborations;a public.applications;
begin
 select * into o from public.opportunities where id=p_id;
 select * into c from public.collaborations where opportunity_id=p_id and status='pending_agreement';
 if c.id is not null and c.agreement_expires_at<=clock_timestamp() then
   update public.collaborations set status='expired',ended_at=clock_timestamp(),current_proposal=null where id=c.id;
   update public.agreement_versions set status='withdrawn' where collaboration_id=c.id and status='proposed';
   update public.applications set status='match_ended',updated_at=clock_timestamp() where id=c.application_id;
   update public.opportunities set selection_until=least(clock_timestamp()+interval '7 days',delivery_deadline),updated_at=clock_timestamp() where id=p_id;
   insert into public.marketplace_events(opportunity_id,collaboration_id,recipient_id,kind,dedupe_key)
   select p_id,c.id,r,'agreement_expired',c.id::text||':expired:'||r::text from unnest(array[c.brand_id,c.influencer_id])r on conflict do nothing;
   insert into public.audit_events(collaboration_id,kind,reason)values(c.id,'agreement_expired','The pending agreement window elapsed.');
   c.id:=null;
 end if;
 if o.status='open' and o.application_deadline<=clock_timestamp() then
   update public.opportunities set status='closed',close_reason='deadline',selection_until=least(application_deadline+interval '7 days',delivery_deadline),updated_at=clock_timestamp() where id=p_id;
 end if;
 select * into o from public.opportunities where id=p_id;
 if o.status='closed' and c.id is null and o.selection_until<=clock_timestamp() then
   for a in update public.applications set status='not_selected',updated_at=clock_timestamp() where opportunity_id=p_id and status='pending' returning * loop
     insert into public.marketplace_events(opportunity_id,recipient_id,kind,dedupe_key)values(p_id,a.influencer_id,'application_not_selected',a.id::text||':not_selected')on conflict do nothing;
   end loop;
 end if;
end $$;

create function marketplace_private.tick(p_limit integer default 100) returns integer
language plpgsql security definer set search_path='' as $$
declare o public.opportunities;c public.collaborations;e public.marketplace_events;r public.cancellation_requests;n integer:=0;
begin
 -- Consistent opportunity-first order, bounded and skip-locked across workers.
 for o in select * from public.opportunities op where (status='open' and application_deadline<=clock_timestamp()) or (status='closed' and selection_until<=clock_timestamp() and exists(select 1 from public.applications a where a.opportunity_id=op.id and a.status='pending') and not exists(select 1 from public.collaborations cc where cc.opportunity_id=op.id and cc.status='pending_agreement')) or id in(select opportunity_id from public.collaborations where status='pending_agreement' and agreement_expires_at<=clock_timestamp()) order by id limit greatest(1,least(p_limit,100)) for update skip locked loop
   perform marketplace_private.reconcile(o.id);
 end loop;
 for c in select * from public.collaborations cc where status in('active','submitted','revision_requested') and (terms->>'delivery_deadline')::timestamptz>clock_timestamp() and (terms->>'delivery_deadline')::timestamptz<=clock_timestamp()+interval '24 hours' and created_at<=(terms->>'delivery_deadline')::timestamptz-interval '24 hours' and not exists(select 1 from public.marketplace_events ee where ee.dedupe_key=cc.id::text||':reminder:'||cc.terms_version||':'||cc.brand_id::text) order by id limit 100 loop
   perform marketplace_private.emit(c,'deadline_reminder',c.id::text||':reminder:'||c.terms_version);
 end loop;
 for r in select * from public.cancellation_requests rr where status='pending' and support_after<=clock_timestamp() and not exists(select 1 from public.marketplace_events ee where ee.dedupe_key=rr.id::text||':support:'||(select brand_id::text from public.collaborations where id=rr.collaboration_id)) order by id limit 100 loop
   select * into c from public.collaborations where id=r.collaboration_id;
   perform marketplace_private.emit(c,'cancellation_support_reminder',r.id::text||':support');
 end loop;
 for e in select * from public.marketplace_events where processed_at is null order by created_at,id limit greatest(1,least(p_limit,100)) for update skip locked loop
   insert into public.notifications(recipient_id,opportunity_id,collaboration_id,report_id,kind,dedupe_key)values(e.recipient_id,e.opportunity_id,e.collaboration_id,e.report_id,e.kind,e.dedupe_key)on conflict(dedupe_key)do nothing;
   update public.marketplace_events set processed_at=clock_timestamp() where id=e.id;n:=n+1;
 end loop;
 return n;
end $$;

revoke all on all functions in schema marketplace_private from public,anon,authenticated;
grant execute on function marketplace_private.member_id(),marketplace_private.command(text,uuid,jsonb),marketplace_private.profile(uuid),marketplace_private.read(text,uuid,jsonb),marketplace_private.visible_profile_image(text),marketplace_private.collaboration_command(text,uuid,jsonb),marketplace_private.support_command(text,uuid,jsonb),marketplace_private.collaboration_read(text,uuid,jsonb),marketplace_private.case_read(uuid,text,jsonb),marketplace_private.mark_notification(uuid),marketplace_private.attachment_access(uuid,uuid,text) to authenticated;
grant execute on function marketplace_private.attachment_worker(text,uuid,jsonb) to service_role;
grant execute on function marketplace_private.tick(integer) to postgres;
reset role;
revoke trigger on public.collaborations from marketplace_executor;
revoke create on schema marketplace_private from marketplace_executor;
revoke marketplace_executor from postgres;
grant usage on schema marketplace_private to service_role;

create function public.collaboration_command(p_action text,p_id uuid,p_data jsonb default '{}')returns uuid language sql security invoker set search_path='' as $$select marketplace_private.collaboration_command(p_action,p_id,p_data)$$;
create function public.collaboration_read(p_kind text,p_id uuid default null,p_filters jsonb default '{}')returns jsonb language sql security invoker set search_path='' as $$select marketplace_private.collaboration_read(p_kind,p_id,p_filters)$$;
create function public.support_command(p_action text,p_id uuid default null,p_data jsonb default '{}')returns uuid language sql security invoker set search_path='' as $$select marketplace_private.support_command(p_action,p_id,p_data)$$;
create function public.support_case(p_id uuid,p_reason text,p_filters jsonb default '{}')returns jsonb language sql security invoker set search_path='' as $$select marketplace_private.case_read(p_id,p_reason,p_filters)$$;
create function public.mark_notification(p_id uuid)returns void language sql security invoker set search_path='' as $$select marketplace_private.mark_notification(p_id)$$;
create function public.attachment_access(p_id uuid,p_report uuid default null,p_reason text default '')returns jsonb language sql security invoker set search_path='' as $$select marketplace_private.attachment_access(p_id,p_report,p_reason)$$;
create function public.attachment_worker(p_action text,p_id uuid default null,p_data jsonb default '{}')returns jsonb language sql security invoker set search_path='' as $$select marketplace_private.attachment_worker(p_action,p_id,p_data)$$;
revoke all on function public.collaboration_command(text,uuid,jsonb),public.collaboration_read(text,uuid,jsonb),public.support_command(text,uuid,jsonb),public.support_case(uuid,text,jsonb),public.mark_notification(uuid),public.attachment_access(uuid,uuid,text),public.attachment_worker(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.collaboration_command(text,uuid,jsonb),public.collaboration_read(text,uuid,jsonb),public.support_command(text,uuid,jsonb),public.support_case(uuid,text,jsonb),public.mark_notification(uuid),public.attachment_access(uuid,uuid,text) to authenticated;
grant execute on function public.attachment_worker(text,uuid,jsonb) to service_role;

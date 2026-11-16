-- Prevent discard/cleanup from racing an unfinished Storage promotion.
-- In-flight/uncertain bytes retain their double quota until 24h cleanup.
alter table public.collaboration_attachments add column cleanup_claim_until timestamptz;
alter table public.collaboration_attachments add column cleanup_last_attempt_at timestamptz;
alter table public.collaboration_attachments add column cleanup_attempts integer not null default 0 check(cleanup_attempts between 0 and 1000000);
create index attachments_cleanup_retry on public.collaboration_attachments(cleanup_claim_until,cleanup_last_attempt_at)where state not in('linked','purged');
grant marketplace_executor to postgres with inherit false,set true;
grant create on schema marketplace_private to marketplace_executor;
set role marketplace_executor;

create or replace function marketplace_private.collaboration_command(p_action text,p_id uuid,p_data jsonb) returns uuid
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
   update public.collaboration_attachments set state='rejected' where id=(p_data->>'file_id')::uuid and collaboration_id=c.id and uploaded_by=m.id and state='clean';
   if not found then raise exception 'Unlinked own file required' using errcode='42501';end if;
 end if;
 insert into public.audit_events(actor_id,collaboration_id,kind,reason)values(m.id,c.id,p_action,reason);
 return coalesce(result_id,c.id);
end $$;

create or replace function marketplace_private.attachment_worker(p_action text,p_id uuid,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.collaboration_attachments;c public.collaborations;oid uuid;v_size bigint;v_at timestamptz;cleanup_result jsonb;
begin
 if p_action is null or p_action not in('quarantine','finalize','reject','purged','cleanup','cleanup_failed') or jsonb_typeof(p_data) is distinct from 'object' then raise exception 'Invalid worker action' using errcode='22023';end if;
 if p_action='cleanup' then
   with candidates as(select id from public.collaboration_attachments where state not in('linked','purged')and created_at<clock_timestamp()-interval '24 hours'and(cleanup_claim_until is null or cleanup_claim_until<=clock_timestamp())order by cleanup_last_attempt_at nulls first,created_at,id limit 50 for update skip locked),
   claimed as(update public.collaboration_attachments claimed_file set cleanup_claim_until=clock_timestamp()+interval '2 hours',cleanup_last_attempt_at=clock_timestamp(),cleanup_attempts=least(cleanup_attempts+1,1000000)from candidates where claimed_file.id=candidates.id returning claimed_file.id,claimed_file.collaboration_id,claimed_file.state)
   select coalesce(jsonb_agg(to_jsonb(claimed)),'[]')into cleanup_result from claimed;
   return cleanup_result;
 end if;
 select collaboration_id into oid from public.collaboration_attachments where id=p_id;
 select opportunity_id into oid from public.collaborations where id=oid;
 perform 1 from public.opportunities where id=oid for update;
 select c0.* into c from public.collaborations c0 join public.collaboration_attachments a0 on a0.collaboration_id=c0.id where a0.id=p_id for update of c0;
 select * into a from public.collaboration_attachments where id=p_id for update;
 if a.id is null then raise exception 'Reservation unavailable' using errcode='22023';end if;
 if p_action='cleanup_failed' then
   update public.collaboration_attachments set cleanup_claim_until=clock_timestamp()+least(interval '24 hours',interval '5 minutes'*power(2,least(cleanup_attempts,8)))where id=a.id and state not in('linked','purged');
 elsif p_action='quarantine' then
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
   if a.state in('linked','purged') then raise exception 'Linked or already purged evidence cannot be discarded' using errcode='42501';end if;
   update public.collaboration_attachments set state='rejected' where id=a.id;
 elsif p_action='purged' then
   if a.state='linked' then raise exception 'Linked evidence cannot be purged' using errcode='42501';end if;
   if a.scanned_at is null and a.created_at>clock_timestamp()-interval '24 hours' then raise exception 'Uncertain uploads retain quota until the bounded uploader lifetime and cleanup grace have elapsed' using errcode='PT409';end if;
   if p_data->>'quarantine_removed' is distinct from 'true' or p_data->>'clean_removed' is distinct from 'true' then raise exception 'Physical deletion of both copies must be confirmed first' using errcode='22023';end if;
   update public.collaboration_attachments set state='purged' where id=a.id;
 end if;
 return jsonb_build_object('id',a.id,'collaboration_id',a.collaboration_id);
end $$;
revoke all on function marketplace_private.collaboration_command(text,uuid,jsonb),marketplace_private.attachment_worker(text,uuid,jsonb)from public,anon,authenticated,service_role;
grant execute on function marketplace_private.collaboration_command(text,uuid,jsonb)to authenticated;
grant execute on function marketplace_private.attachment_worker(text,uuid,jsonb)to service_role;
reset role;
revoke create on schema marketplace_private from marketplace_executor;
revoke marketplace_executor from postgres;

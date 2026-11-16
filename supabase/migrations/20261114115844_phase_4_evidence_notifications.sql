-- Keep private evidence accessible through bounded context and deduplicate events.
grant marketplace_executor to postgres with inherit false,set true;
grant create on schema marketplace_private to marketplace_executor;
set role marketplace_executor;
create or replace function marketplace_private.collaboration_read(p_kind text,p_id uuid,p_filters jsonb) returns jsonb
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
     return jsonb_build_object('items',(select coalesce(jsonb_agg(to_jsonb(x) order by created_at desc,id),'[]')from(select msg.id,msg.author_id,case when msg.hidden_at is null then msg.body else '[Message hidden by support]' end body,msg.hidden_at,msg.created_at,case when msg.hidden_at is null then(select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'filename',f.filename,'size_bytes',f.size_bytes)),'[]')from public.collaboration_attachments f where f.message_id=msg.id and f.state='linked')else '[]'::jsonb end attachments from public.collaboration_messages msg where collaboration_id=p_id order by created_at desc,id limit v_limit offset v_offset)x),'total',(select count(*)from public.collaboration_messages where collaboration_id=p_id));
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
    'messages',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'author_id',x.author_id,'body',case when x.hidden_at is null then x.body else '[Message hidden by support]' end,'hidden_at',x.hidden_at,'created_at',x.created_at,'attachments',case when x.hidden_at is null then(select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'filename',f.filename,'size_bytes',f.size_bytes)),'[]')from public.collaboration_attachments f where f.message_id=x.id and f.state='linked')else '[]'::jsonb end) order by x.created_at desc,x.id),'[]') from(select * from public.collaboration_messages where collaboration_id=p_id order by created_at desc,id limit v_limit offset v_offset)x),
    'message_count',(select count(*) from public.collaboration_messages where collaboration_id=p_id),
    'submissions',(select coalesce(jsonb_agg(to_jsonb(x) order by version desc),'[]') from(select * from public.collaboration_submissions where collaboration_id=p_id order by version desc limit 20)x),
    'reviews',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from public.submission_reviews r where submission_id in(select id from public.collaboration_submissions where collaboration_id=p_id order by version desc limit 20)),
    'cancellations',(select coalesce(jsonb_agg(to_jsonb(x) order by created_at desc),'[]') from(select * from public.cancellation_requests where collaboration_id=p_id order by created_at desc limit 20)x),
    'files',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'filename',a.filename,'state',a.state,'size_bytes',a.size_bytes,'message_id',a.message_id,'submission_id',a.submission_id,'uploaded_by',a.uploaded_by)),'[]') from(select * from public.collaboration_attachments where collaboration_id=p_id and(state='linked' or uploaded_by=m.id)and state<>'purged' order by (uploaded_by=m.id and state='clean')desc,created_at desc,id limit 50)a),
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
   perform marketplace_private.emit(c,'agreement_changed',c.id::text||':amendment_withdrawn:'||c.current_proposal,m.id);
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
     perform marketplace_private.emit(c,'collaboration_completed',c.id::text||':completed');
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
create or replace function marketplace_private.support_command(p_action text,p_id uuid,p_data jsonb) returns uuid
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
     if target.status=next_status then return target.id;end if;
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
     select * into c from public.collaborations where id=r.collaboration_id;
     perform marketplace_private.emit(c,'message_hidden',r.id::text||':hidden:'||(p_data->>'message_id'));
   elsif p_action='moderate_opportunity' then
     if r.opportunity_id is null then raise exception 'An opportunity report is required' using errcode='42501';end if;
     select * into o from public.opportunities where id=r.opportunity_id for update;
     update public.opportunities set hidden_at=clock_timestamp(),status='closed',close_reason='moderation',updated_at=clock_timestamp() where id=o.id;
     insert into public.notifications(recipient_id,opportunity_id,kind,dedupe_key)values(o.brand_id,o.id,'opportunity_moderated',r.id::text||':moderated')on conflict do nothing;
   end if;
 end if;
 insert into public.audit_events(actor_id,report_id,kind,reason,visibility)values(m.id,r.id,p_action,reason,'admin');
 insert into public.notifications(recipient_id,report_id,kind,dedupe_key)values(r.reporter_id,r.id,'report_'||p_action,gen_random_uuid()::text);
 return r.id;
end $$;
create or replace function marketplace_private.case_read(p_id uuid,p_reason text,p_filters jsonb default '{}') returns jsonb
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
  'reviews',(select coalesce(jsonb_agg(to_jsonb(rr)),'[]')from public.submission_reviews rr where submission_id in(select id from public.collaboration_submissions where collaboration_id=r.collaboration_id order by version desc limit 20 offset v_offset)),
  'cancellations',(select coalesce(jsonb_agg(to_jsonb(x)order by created_at desc,id),'[]')from(select * from public.cancellation_requests where collaboration_id=r.collaboration_id order by created_at desc,id limit 20 offset v_offset)x),
  'cancellation_count',(select count(*)from public.cancellation_requests where collaboration_id=r.collaboration_id),
  'history',(select coalesce(jsonb_agg(to_jsonb(x)order by created_at desc,id),'[]')from(select id,actor_id,kind,reason,created_at from public.audit_events where report_id=r.id or(collaboration_id=r.collaboration_id and visibility='participant')order by created_at desc,id limit 20 offset v_offset)x),
  'history_count',(select count(*)from public.audit_events where report_id=r.id or(collaboration_id=r.collaboration_id and visibility='participant')),
  'file_count',(select count(*)from public.collaboration_attachments where collaboration_id=r.collaboration_id and state='linked'),
  'files',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'filename',filename,'size_bytes',size_bytes,'message_id',message_id,'submission_id',submission_id)),'[]') from(select * from public.collaboration_attachments where collaboration_id=r.collaboration_id and state='linked' order by created_at desc,id limit 20 offset v_offset)x));
end $$;
revoke all on function marketplace_private.collaboration_read(text,uuid,jsonb),marketplace_private.collaboration_command(text,uuid,jsonb),marketplace_private.support_command(text,uuid,jsonb),marketplace_private.case_read(uuid,text,jsonb)from public,anon,authenticated,service_role;
grant execute on function marketplace_private.collaboration_read(text,uuid,jsonb),marketplace_private.collaboration_command(text,uuid,jsonb),marketplace_private.support_command(text,uuid,jsonb),marketplace_private.case_read(uuid,text,jsonb)to authenticated;
reset role;
revoke create on schema marketplace_private from marketplace_executor;
revoke marketplace_executor from postgres;
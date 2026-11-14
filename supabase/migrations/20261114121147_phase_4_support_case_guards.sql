-- Repeated claim is idempotent; assigned reasoned support can investigate
-- exactly the reported safe profile even after suspension. Ordinary projections
-- and avatar policies are unchanged; no authentication identifiers are returned.
grant marketplace_executor to postgres with inherit false,set true;
grant create on schema marketplace_private to marketplace_executor;
set role marketplace_executor;
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
   if r.status='in_review' and r.assigned_admin=m.id then return r.id;end if;
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
  'member',(select case when u.role='brand' then
   (select jsonb_build_object('id',p.user_id,'role','brand','display_name',p.display_name,'description',p.description,'location',p.location,'categories',p.categories,'website',p.website,'links','[]'::jsonb)from public.brand_profiles p where p.user_id=r.member_id)
   when u.role='influencer' then
   (select jsonb_build_object('id',p.user_id,'role','influencer','display_name',p.display_name,'description',p.bio,'location',p.location,'categories',p.categories,'website',null,'links',coalesce((select jsonb_agg(jsonb_build_object('platform',s.platform,'url',s.url,'follower_count',s.follower_count,'metrics_as_of',s.metrics_as_of)order by s.platform)from public.social_links s where s.user_id=r.member_id),'[]'::jsonb))from public.influencer_profiles p where p.user_id=r.member_id)
   else null end from public.app_users u where u.id=r.member_id),
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
revoke all on function marketplace_private.support_command(text,uuid,jsonb),marketplace_private.case_read(uuid,text,jsonb)from public,anon,authenticated,service_role;
grant execute on function marketplace_private.support_command(text,uuid,jsonb),marketplace_private.case_read(uuid,text,jsonb)to authenticated;
reset role;
revoke create on schema marketplace_private from marketplace_executor;
revoke marketplace_executor from postgres;
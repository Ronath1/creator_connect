-- Complete bounded case evidence and meet the accepted in-app update target.
grant marketplace_executor to postgres with inherit false,set true;
grant create on schema marketplace_private to marketplace_executor;
set role marketplace_executor;
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
  'files',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'filename',filename,'size_bytes',size_bytes,'message_id',message_id,'submission_id',submission_id)),'[]') from(select * from public.collaboration_attachments where collaboration_id=r.collaboration_id and state='linked' order by created_at desc,id limit 50 offset v_offset)x));
end $$;
revoke all on function marketplace_private.case_read(uuid,text,jsonb)from public,anon,authenticated,service_role;
grant execute on function marketplace_private.case_read(uuid,text,jsonb)to authenticated;
reset role;
revoke create on schema marketplace_private from marketplace_executor;
revoke marketplace_executor from postgres;
-- Portable RLS tests have no pg_cron. Hosted job changes are independently
-- reviewed/tested against real cron.job and cron.job_run_details by the parent.
do $$begin
 if exists(select 1 from pg_extension where extname='pg_cron')then
  perform cron.alter_job(job_id:=(select jobid from cron.job where jobname='creatorconnect-collaboration-tick'),schedule:='30 seconds');
 end if;
end $$;
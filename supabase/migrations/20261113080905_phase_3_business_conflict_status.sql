-- Business conflicts must not use SQL serialization code 40001: affected
-- PostgREST versions automatically retry it, rather than returning to the caller.
grant marketplace_executor to postgres with inherit false, set true;
grant create on schema marketplace_private to marketplace_executor;
set role marketplace_executor;

create or replace function marketplace_private.command(p_action text, p_id uuid, p_data jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare m public.app_users; o public.opportunities; old_o public.opportunities; a public.applications; c_id uuid; target public.app_users; v_url text; v_reason text;
begin
  m := marketplace_private.member();
  if p_action is null or p_action not in ('create','edit','publish','close','reopen','delete_draft','apply','withdraw','reject','select') then raise exception 'Unknown marketplace action' using errcode = '22023'; end if;
  if jsonb_typeof(p_data) is distinct from 'object' then raise exception 'Expected an action object' using errcode='22023'; end if;
  if p_action = 'create' then
    if m.role <> 'brand' then raise exception 'Brand membership required' using errcode = '42501'; end if;
    if p_id is not null then
      select * into o from public.opportunities where id=p_id;
      if o.id is not null then
        if o.brand_id<>m.id then raise exception 'Draft request unavailable' using errcode='42501'; end if;
        return o.id;
      end if;
    end if;
    o.id := coalesce(p_id,gen_random_uuid()); o.brand_id := m.id; o.status := 'draft'; o.version := 1;
  else
    select * into o from public.opportunities where id = p_id for update;
    if o.id is null then raise exception 'Opportunity unavailable' using errcode = '42501'; end if;
    if p_action in ('edit','publish','close','reopen','delete_draft','reject','select') and (m.role <> 'brand' or o.brand_id <> m.id) then raise exception 'Only the owning brand can do this' using errcode = '42501'; end if;
    if p_action in ('apply','withdraw') and (m.role <> 'influencer' or o.published_at is null or o.hidden_at is not null) then raise exception 'Opportunity unavailable' using errcode = '42501'; end if;
    perform marketplace_private.reconcile(o.id);
    select * into o from public.opportunities where id = o.id;
  end if;
  old_o := o;
  if p_action='publish' and o.status='open' and o.version=(p_data->>'expected_version')::integer+1 then return o.id; end if;
  if p_action in ('edit','publish') and (p_data->>'expected_version')::integer is distinct from o.version then
    raise exception 'This brief changed. Refresh before editing again' using errcode='PT409';
  end if;
  if p_action in ('create','edit') then
    perform marketplace_private.validate_terms(p_data->'deliverables');
    o.title := btrim(p_data->>'title'); o.brief := btrim(p_data->>'brief'); o.category := p_data->>'category';
    o.platforms := array(select jsonb_array_elements_text(p_data->'platforms'));
    o.deliverables := p_data->'deliverables'; o.budget_minor := (p_data->>'budget_minor')::bigint;
    o.currency := p_data->>'currency'; o.application_deadline := (p_data->>'application_deadline')::timestamptz;
    o.delivery_deadline := (p_data->>'delivery_deadline')::timestamptz; o.revision_allowance := (p_data->>'revision_allowance')::integer;
    if (p_action='create' or old_o.status='draft' or o.application_deadline is distinct from old_o.application_deadline or o.delivery_deadline is distinct from old_o.delivery_deadline)
      and (o.application_deadline <= clock_timestamp() or o.delivery_deadline <= o.application_deadline) then raise exception 'Application and delivery deadlines must be future and ordered' using errcode = '22023'; end if;
    if p_action = 'edit' and exists(select 1 from public.applications where opportunity_id = o.id) and
      (to_jsonb(o) - array['title','brief']) is distinct from (to_jsonb(old_o) - array['title','brief']) then
      raise exception 'Material terms are fixed after an application; close and create a replacement opportunity' using errcode = '22023';
    end if;
    if old_o.hidden_at is not null then raise exception 'Restricted opportunity cannot be edited' using errcode = '42501'; end if;
    if p_action = 'create' then
      insert into public.opportunities(id,brand_id,title,brief,category,platforms,deliverables,budget_minor,currency,application_deadline,delivery_deadline,revision_allowance)
      values(o.id,m.id,o.title,o.brief,o.category,o.platforms,o.deliverables,o.budget_minor,o.currency,o.application_deadline,o.delivery_deadline,o.revision_allowance);
    else
      update public.opportunities set title=o.title,brief=o.brief,category=o.category,platforms=o.platforms,deliverables=o.deliverables,budget_minor=o.budget_minor,currency=o.currency,application_deadline=o.application_deadline,delivery_deadline=o.delivery_deadline,revision_allowance=o.revision_allowance,version=version+1,updated_at=clock_timestamp() where id=o.id;
      v_reason := btrim(p_data->>'reason');
      if length(coalesce(v_reason,'')) not between 3 and 500 then raise exception 'Explain the correction' using errcode = '22023'; end if;
    end if;
  elsif p_action = 'publish' then
    if o.status <> 'draft' or o.application_deadline <= clock_timestamp() then raise exception 'Only a valid future draft can be published' using errcode = '22023'; end if;
    update public.opportunities set status='open',published_at=clock_timestamp(),version=version+1,updated_at=clock_timestamp() where id=o.id returning * into o;
    insert into public.opportunity_history(opportunity_id,version,actor_id,reason,snapshot) values(o.id,o.version,m.id,'Published brief',to_jsonb(o));
  elsif p_action = 'close' then
    if o.status='closed' and o.close_reason='manual' then return o.id; end if;
    if o.status <> 'open' then raise exception 'Only open opportunities can be closed' using errcode = '22023'; end if;
    update public.opportunities set status='closed',close_reason='manual',selection_until=least(clock_timestamp()+interval '7 days',delivery_deadline),updated_at=clock_timestamp() where id=o.id;
  elsif p_action = 'reopen' then
    if o.status <> 'closed' or o.hidden_at is not null or o.close_reason='moderation' or o.application_deadline <= clock_timestamp() or exists(select 1 from public.collaborations where opportunity_id=o.id and (status='pending_agreement' or activated_at is not null)) then raise exception 'This opportunity cannot be reopened' using errcode='22023'; end if;
    update public.opportunities set status='open',close_reason=null,selection_until=null,updated_at=clock_timestamp() where id=o.id;
  elsif p_action = 'delete_draft' then
    if o.status <> 'draft' or o.published_at is not null then raise exception 'Published opportunities cannot be deleted' using errcode='22023'; end if;
    delete from public.opportunities where id=o.id;
    return o.id;
  elsif p_action = 'apply' then
    if o.status <> 'open' or o.application_deadline <= clock_timestamp() then raise exception 'Applications are closed' using errcode='22023'; end if;
    if not exists(select 1 from public.app_users u join public.brand_profiles p on p.user_id=u.id where u.id=o.brand_id and u.status='active' and u.role='brand') then raise exception 'Brand is unavailable' using errcode='42501'; end if;
    for v_url in select jsonb_array_elements_text(coalesce(p_data->'work_urls','[]'::jsonb)) loop
      if length(v_url)>2048 or v_url !~ '^https://[^/@[:space:]]+([/?#]|$)' then raise exception 'Work links must be valid HTTPS URLs' using errcode='22023'; end if;
    end loop;
    if jsonb_array_length(coalesce(p_data->'work_urls','[]'::jsonb))>3 then raise exception 'At most three work links' using errcode='22023'; end if;
    insert into public.applications(opportunity_id,influencer_id,proposal,work_urls) values(o.id,m.id,btrim(p_data->>'proposal'),array(select jsonb_array_elements_text(coalesce(p_data->'work_urls','[]'::jsonb)))) returning * into a;
    insert into public.marketplace_events(opportunity_id,recipient_id,kind,dedupe_key) values(o.id,o.brand_id,'application_received',a.id::text || ':received');
    return a.id;
  elsif p_action in ('withdraw','reject','select') then
    select * into a from public.applications where id=(p_data->>'application_id')::uuid and opportunity_id=o.id for update;
    if a.id is not null and p_action='withdraw' and a.influencer_id=m.id and a.status='withdrawn' then return a.id; end if;
    if a.id is not null and p_action='reject' and a.status='rejected' then return a.id; end if;
    if a.id is not null and p_action='select' and a.status='selected' then
      select id into c_id from public.collaborations where application_id=a.id and status='pending_agreement';
      if c_id is not null then return c_id; end if;
    end if;
    if a.id is null or a.status <> 'pending' then raise exception 'A pending application is required' using errcode='22023'; end if;
    if p_action='withdraw' then
      if a.influencer_id<>m.id then raise exception 'Only your own application can be withdrawn' using errcode='42501'; end if;
      update public.applications set status='withdrawn',updated_at=clock_timestamp() where id=a.id;
    elsif p_action='reject' then
      update public.applications set status='rejected',updated_at=clock_timestamp() where id=a.id;
    else
      if o.hidden_at is not null or o.close_reason='moderation' or o.status='draft' or o.delivery_deadline<=clock_timestamp() or (o.status='closed' and (o.selection_until is null or o.selection_until<=clock_timestamp())) then raise exception 'Selection window is closed' using errcode='22023'; end if;
      if exists(select 1 from public.collaborations where opportunity_id=o.id and (status='pending_agreement' or activated_at is not null)) then raise exception 'The hiring slot is already reserved or committed' using errcode='23505'; end if;
      select * into target from public.app_users where id=a.influencer_id and role='influencer' and status='active';
      if target.id is null or not exists(select 1 from public.influencer_profiles where user_id=target.id) or not exists(select 1 from public.social_links where user_id=target.id) then raise exception 'Selected creator must have active membership and a complete profile' using errcode='42501'; end if;
      update public.applications set status='selected',updated_at=clock_timestamp() where id=a.id;
      insert into public.collaborations(opportunity_id,application_id,brand_id,influencer_id,terms,agreement_expires_at)
      values(o.id,a.id,m.id,a.influencer_id,jsonb_build_object('title',o.title,'deliverables',o.deliverables,'budget_minor',o.budget_minor,'currency',o.currency,'delivery_deadline',o.delivery_deadline,'revision_allowance',o.revision_allowance,'brand_id',m.id,'influencer_id',a.influencer_id),least(clock_timestamp()+interval '7 days',o.delivery_deadline)) returning id into c_id;
      update public.opportunities set status='closed',close_reason='selection',selection_until=null,updated_at=clock_timestamp() where id=o.id;
    end if;
    insert into public.marketplace_events(opportunity_id,recipient_id,kind,dedupe_key) values(o.id,case when p_action='withdraw' then o.brand_id else a.influencer_id end,'application_' || p_action,a.id::text || ':' || p_action);
    return coalesce(c_id,a.id);
  end if;
  if p_action in ('create','edit') then
    select * into o from public.opportunities where id=o.id;
    insert into public.opportunity_history(opportunity_id,version,actor_id,reason,snapshot) values(o.id,o.version,m.id,coalesce(v_reason,'Initial draft'),to_jsonb(o));
    if p_action='edit' then
      insert into public.marketplace_events(opportunity_id,recipient_id,kind,dedupe_key)
      select o.id,influencer_id,'brief_corrected',o.id::text || ':version:' || o.version || ':' || influencer_id::text from public.applications where opportunity_id=o.id;
    end if;
  end if;
  return o.id;
end;
$$;

revoke all on function marketplace_private.command(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function marketplace_private.command(text,uuid,jsonb) to authenticated;
reset role;
revoke create on schema marketplace_private from marketplace_executor;
revoke marketplace_executor from postgres;

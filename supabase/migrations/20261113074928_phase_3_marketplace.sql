-- Marketplace lifecycle writes have one trusted, non-login database boundary.
-- No application connection assumes this role; JWT identity is checked inside
-- every callable entrypoint. Phase 4 can extend the same atomic boundary.
create role marketplace_executor nologin noinherit nobypassrls;
-- Supabase's non-superuser migration role needs SET for ownership transfer.
-- Revoke this temporary membership at the end; it is never given to auth roles.
grant marketplace_executor to postgres with inherit false, set true;
create schema marketplace_private;
revoke all on schema marketplace_private from public, anon;
grant usage on schema marketplace_private to authenticated, marketplace_executor;
grant usage on schema public, auth to marketplace_executor;
grant execute on function auth.jwt() to marketplace_executor;
grant select on public.app_users, public.brand_profiles, public.influencer_profiles, public.social_links to marketplace_executor;
create policy marketplace_identity_lookup on public.app_users for select to marketplace_executor using (true);
create policy marketplace_brand_lookup on public.brand_profiles for select to marketplace_executor using (true);
create policy marketplace_creator_lookup on public.influencer_profiles for select to marketplace_executor using (true);
create policy marketplace_social_lookup on public.social_links for select to marketplace_executor using (true);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.app_users(id) on delete restrict,
  title text not null check (length(btrim(title)) between 5 and 140),
  brief text not null check (length(btrim(brief)) between 30 and 6000),
  category text not null check (category in ('Beauty','Fashion','Food & drink','Lifestyle','Travel','Technology','Fitness','Other')),
  platforms text[] not null check (cardinality(platforms) between 1 and 5 and platforms <@ array['Instagram','YouTube','TikTok','Facebook','X']::text[]),
  deliverables jsonb not null,
  budget_minor bigint not null check (budget_minor between 1 and 100000000000),
  currency text not null default 'LKR' check (currency = 'LKR'),
  application_deadline timestamptz not null,
  delivery_deadline timestamptz not null check (delivery_deadline > application_deadline),
  revision_allowance integer not null default 1 check (revision_allowance between 0 and 5),
  status text not null default 'draft' check (status in ('draft','open','closed')),
  close_reason text check (close_reason in ('manual','selection','deadline','moderation')),
  selection_until timestamptz,
  published_at timestamptz,
  hidden_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index opportunities_brand_created on public.opportunities(brand_id, created_at desc, id);
create index opportunities_discovery on public.opportunities(status, created_at desc, id) where published_at is not null and hidden_at is null;
create index opportunities_deadlines on public.opportunities(application_deadline) where status = 'open';
create index opportunities_platforms on public.opportunities using gin(platforms);
create index opportunities_category on public.opportunities(category, created_at desc);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete restrict,
  influencer_id uuid not null references public.app_users(id) on delete restrict,
  proposal text not null check (length(btrim(proposal)) between 20 and 3000),
  work_urls text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending','withdrawn','rejected','selected','not_selected','match_ended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(opportunity_id, influencer_id),
  unique(id, opportunity_id)
);
create index applications_influencer on public.applications(influencer_id, created_at desc, id);
create index applications_opportunity_status on public.applications(opportunity_id, status, created_at, id);

create table public.collaborations (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete restrict,
  application_id uuid not null unique,
  brand_id uuid not null references public.app_users(id) on delete restrict,
  influencer_id uuid not null references public.app_users(id) on delete restrict,
  status text not null default 'pending_agreement' check (status in ('pending_agreement','active','submitted','revision_requested','completed','declined','expired','cancelled')),
  terms jsonb not null,
  terms_version integer not null default 1 check (terms_version > 0),
  agreement_expires_at timestamptz not null,
  activated_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (application_id, opportunity_id) references public.applications(id, opportunity_id) on delete restrict,
  check (brand_id <> influencer_id)
);
-- Activated work keeps its committed slot even if later cancelled. A fresh
-- opportunity is required for a new hire after activation.
create unique index collaboration_one_slot on public.collaborations(opportunity_id)
where status in ('pending_agreement','active','submitted','revision_requested','completed') or activated_at is not null;
create index collaborations_brand on public.collaborations(brand_id, created_at desc);
create index collaborations_influencer on public.collaborations(influencer_id, created_at desc);
create index collaborations_expiry on public.collaborations(agreement_expires_at) where status = 'pending_agreement';

create table public.opportunity_history (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  version integer not null,
  actor_id uuid not null references public.app_users(id) on delete restrict,
  reason text not null check (length(btrim(reason)) between 3 and 500),
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique(opportunity_id, version)
);
create table public.marketplace_events (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete restrict,
  recipient_id uuid not null references public.app_users(id) on delete restrict,
  kind text not null,
  dedupe_key text not null unique,
  created_at timestamptz not null default now()
);
create index marketplace_events_recipient on public.marketplace_events(recipient_id, created_at, id);
create index marketplace_events_opportunity on public.marketplace_events(opportunity_id);

alter table public.opportunities enable row level security;
alter table public.applications enable row level security;
alter table public.collaborations enable row level security;
alter table public.opportunity_history enable row level security;
alter table public.marketplace_events enable row level security;
revoke all on public.opportunities, public.applications, public.collaborations, public.opportunity_history, public.marketplace_events from public, anon, authenticated;
grant select, insert, update, delete on public.opportunities to marketplace_executor;
grant select, insert, update on public.applications, public.collaborations to marketplace_executor;
grant select, insert on public.opportunity_history, public.marketplace_events to marketplace_executor;
create policy executor_opportunities on public.opportunities to marketplace_executor using (true) with check (true);
create policy executor_applications on public.applications to marketplace_executor using (true) with check (true);
create policy executor_collaborations on public.collaborations to marketplace_executor using (true) with check (true);
create policy executor_history on public.opportunity_history to marketplace_executor using (true) with check (true);
create policy executor_events on public.marketplace_events to marketplace_executor using (true) with check (true);

create function marketplace_private.member() returns public.app_users
language plpgsql stable security definer set search_path = '' as $$
declare m public.app_users;
begin
  select * into m from public.app_users where clerk_user_id = (select auth.jwt()->>'sub') and status = 'active';
  if m.id is null then raise exception 'Active pilot membership required' using errcode = '42501'; end if;
  if m.role = 'brand' and not exists(select 1 from public.brand_profiles where user_id = m.id) then
    raise exception 'Complete your brand profile first' using errcode = '42501';
  elsif m.role = 'influencer' and (not exists(select 1 from public.influencer_profiles where user_id = m.id) or not exists(select 1 from public.social_links where user_id = m.id)) then
    raise exception 'Complete your creator profile first' using errcode = '42501';
  end if;
  return m;
end;
$$;
-- This narrow helper is safe in RLS: only the caller's internal UUID, no identity
-- or membership row is exposed. The composite helper is executor-only.
create function marketplace_private.member_id() returns uuid
language sql stable security definer set search_path = '' as $$ select (marketplace_private.member()).id $$;

grant select on public.opportunities, public.applications, public.collaborations, public.opportunity_history to authenticated;
create policy member_opportunities on public.opportunities for select to authenticated using (
  brand_id = (select marketplace_private.member_id()) or
  (published_at is not null and hidden_at is null and (select marketplace_private.member_id()) is not null)
);
create policy participant_applications on public.applications for select to authenticated using (
  influencer_id = (select marketplace_private.member_id()) or exists (
    select 1 from public.opportunities o where o.id = opportunity_id and o.brand_id = (select marketplace_private.member_id())
  )
);
create policy participant_collaborations on public.collaborations for select to authenticated using (
  (select marketplace_private.member_id()) in (brand_id, influencer_id)
);
create policy visible_history on public.opportunity_history for select to authenticated using (
  exists(select 1 from public.opportunities o where o.id = opportunity_id and (o.brand_id = (select marketplace_private.member_id()) or (o.published_at is not null and o.hidden_at is null and snapshot->>'published_at' is not null)))
);

create function marketplace_private.validate_terms(p jsonb) returns void
language plpgsql immutable security invoker set search_path = '' as $$
declare d jsonb;
begin
  if jsonb_typeof(p) is distinct from 'array' or jsonb_array_length(p) not between 1 and 10 then
    raise exception 'Provide one to ten deliverables' using errcode = '22023';
  end if;
  for d in select value from jsonb_array_elements(p) loop
    if jsonb_typeof(d) is distinct from 'object' or length(btrim(coalesce(d->>'format',''))) not between 2 and 100
      or coalesce(d->>'quantity','') !~ '^[1-9][0-9]?$' or length(btrim(coalesce(d->>'acceptance',''))) not between 5 and 1000 then
      raise exception 'Each deliverable needs a format, quantity (1–99) and acceptance description' using errcode = '22023';
    end if;
  end loop;
end;
$$;

-- Caller already holds the opportunity row lock. No externally callable expiry
-- routine can mutate arbitrary records without first checking visibility.
create function marketplace_private.reconcile(p_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare o public.opportunities; c public.collaborations; a public.applications;
begin
  select * into o from public.opportunities where id = p_id;
  select * into c from public.collaborations where opportunity_id = p_id and status = 'pending_agreement';
  if c.id is not null and c.agreement_expires_at <= clock_timestamp() then
    update public.collaborations set status = 'expired', ended_at = clock_timestamp() where id = c.id;
    update public.applications set status = 'match_ended', updated_at = clock_timestamp() where id = c.application_id;
    update public.opportunities set selection_until = least(clock_timestamp() + interval '7 days', delivery_deadline), updated_at = clock_timestamp() where id = p_id;
    insert into public.marketplace_events(opportunity_id, recipient_id, kind, dedupe_key)
      select p_id, r, 'agreement_expired', c.id::text || ':expired:' || r::text from unnest(array[c.brand_id,c.influencer_id]) r on conflict do nothing;
    c.id := null;
  end if;
  if o.status = 'open' and o.application_deadline <= clock_timestamp() then
    update public.opportunities set status = 'closed', close_reason = 'deadline', selection_until = least(application_deadline + interval '7 days', delivery_deadline), updated_at = clock_timestamp() where id = p_id;
  end if;
  select * into o from public.opportunities where id = p_id;
  if o.status = 'closed' and c.id is null and o.selection_until <= clock_timestamp() then
    for a in update public.applications set status = 'not_selected', updated_at = clock_timestamp() where opportunity_id = p_id and status = 'pending' returning * loop
      insert into public.marketplace_events(opportunity_id, recipient_id, kind, dedupe_key) values(p_id,a.influencer_id,'application_not_selected',a.id::text || ':not_selected') on conflict do nothing;
    end loop;
  end if;
end;
$$;

create function marketplace_private.command(p_action text, p_id uuid, p_data jsonb) returns uuid
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
    raise exception 'This brief changed. Refresh before editing again' using errcode='40001';
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

create function public.marketplace_command(p_action text, p_id uuid default null, p_data jsonb default '{}') returns uuid
language sql security invoker set search_path = '' as $$ select marketplace_private.command(p_action,p_id,p_data) $$;

create function marketplace_private.profile(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare m public.app_users; target public.app_users; result jsonb;
begin
  m := marketplace_private.member();
  select * into target from public.app_users where id=p_id and status='active' and role in ('brand','influencer');
  if target.id is null then return null; end if;
  if target.role='brand' then
    select jsonb_build_object('id',p.user_id,'role','brand','display_name',p.display_name,'description',p.description,'location',p.location,'categories',p.categories,'website',p.website,'links','[]'::jsonb) into result from public.brand_profiles p where p.user_id=p_id;
  else
    select jsonb_build_object('id',p.user_id,'role','influencer','display_name',p.display_name,'description',p.bio,'location',p.location,'categories',p.categories,'website',null,'links',coalesce((select jsonb_agg(jsonb_build_object('platform',s.platform,'url',s.url,'follower_count',s.follower_count,'metrics_as_of',s.metrics_as_of) order by s.platform) from public.social_links s where s.user_id=p_id),'[]'::jsonb)) into result from public.influencer_profiles p where p.user_id=p_id and exists(select 1 from public.social_links where user_id=p_id);
  end if;
  return result;
end;
$$;

create function marketplace_private.read(p_kind text, p_id uuid, p_filters jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare m public.app_users; v_opp public.opportunities; ids uuid[]; v_id uuid; result jsonb; v_limit integer; v_offset integer; v_search text;
begin
  m := marketplace_private.member();
  v_limit := greatest(1,least(coalesce((p_filters->>'limit')::integer,20),50));
  v_offset := greatest(0,least(coalesce((p_filters->>'offset')::integer,0),100000));
  v_search := left(btrim(coalesce(p_filters->>'search','')),100);
  if p_kind='detail' then
    select * into v_opp from public.opportunities where id=p_id for update;
    if v_opp.id is null or (v_opp.brand_id<>m.id and (v_opp.published_at is null or v_opp.hidden_at is not null)) then return null; end if;
    perform marketplace_private.reconcile(v_opp.id);
    select * into v_opp from public.opportunities where id=p_id;
    return jsonb_build_object('opportunity',to_jsonb(v_opp),'brand',marketplace_private.profile(v_opp.brand_id),
      'applications',coalesce((select jsonb_agg(to_jsonb(a) || jsonb_build_object('profile',marketplace_private.profile(a.influencer_id)) order by a.created_at desc,a.id) from (select * from public.applications where opportunity_id=p_id and (m.id=v_opp.brand_id or influencer_id=m.id) order by created_at desc,id limit v_limit offset v_offset) a),'[]'::jsonb),
      'application_count',(select count(*) from public.applications where opportunity_id=p_id and (m.id=v_opp.brand_id or influencer_id=m.id)),
      'collaboration',(select to_jsonb(c) from public.collaborations c where opportunity_id=p_id and m.id in (brand_id,influencer_id) order by created_at desc limit 1),
      'history',coalesce((select jsonb_agg(to_jsonb(h) order by h.version desc) from (select version,reason,snapshot,created_at from public.opportunity_history where opportunity_id=p_id and (m.id=v_opp.brand_id or snapshot->>'published_at' is not null) order by version desc limit 20) h),'[]'::jsonb));
  elsif p_kind='applications' then
    if m.role<>'influencer' then raise exception 'Creator membership required' using errcode='42501'; end if;
    select array_agg(id order by id) into ids from public.opportunities where id in (select opportunity_id from public.applications where influencer_id=m.id order by created_at desc,id limit v_limit offset v_offset);
    foreach v_id in array coalesce(ids,'{}'::uuid[]) loop
      perform 1 from public.opportunities where id=v_id for update;
      perform marketplace_private.reconcile(v_id);
    end loop;
    select coalesce(jsonb_agg(to_jsonb(a) || jsonb_build_object('opportunity',to_jsonb(o)) order by a.created_at desc,a.id),'[]'::jsonb) into result
    from (select * from public.applications where influencer_id=m.id order by created_at desc,id limit v_limit offset v_offset) a join public.opportunities o on o.id=a.opportunity_id;
    return jsonb_build_object('items',result,'total',(select count(*) from public.applications where influencer_id=m.id));
  elsif p_kind in ('discover','own') then
    if p_kind='own' and m.role<>'brand' then raise exception 'Brand membership required' using errcode='42501'; end if;
    select array_agg(id order by id) into ids from (
      select id from public.opportunities where
        (case when p_kind='own' then brand_id=m.id else published_at is not null and hidden_at is null end)
        and (v_search='' or strpos(lower(title || ' ' || brief),lower(v_search))>0)
        and (coalesce(p_filters->>'category','')='' or category=p_filters->>'category')
        and (coalesce(p_filters->>'platform','')='' or p_filters->>'platform'=any(platforms))
      order by created_at desc,id limit v_limit offset v_offset
    ) found;
    foreach v_id in array coalesce(ids,'{}'::uuid[]) loop
      perform 1 from public.opportunities where id=v_id for update;
      perform marketplace_private.reconcile(v_id);
    end loop;
    select coalesce(jsonb_agg(to_jsonb(o) || jsonb_build_object('brand_name',(select display_name from public.brand_profiles where user_id=o.brand_id)) order by o.created_at desc,o.id),'[]'::jsonb) into result from public.opportunities o where id=any(coalesce(ids,'{}'::uuid[]));
    return jsonb_build_object('items',result,'total',(select count(*) from public.opportunities where
      (case when p_kind='own' then brand_id=m.id else published_at is not null and hidden_at is null end)
      and (v_search='' or strpos(lower(title || ' ' || brief),lower(v_search))>0)
      and (coalesce(p_filters->>'category','')='' or category=p_filters->>'category')
      and (coalesce(p_filters->>'platform','')='' or p_filters->>'platform'=any(platforms))));
  end if;
  raise exception 'Unknown marketplace query' using errcode='22023';
end;
$$;
create function public.marketplace_read(p_kind text, p_id uuid default null, p_filters jsonb default '{}') returns jsonb
language sql security invoker set search_path = '' as $$ select marketplace_private.read(p_kind,p_id,p_filters) $$;
create function public.member_profile(p_id uuid) returns jsonb
language sql security invoker set search_path = '' as $$ select marketplace_private.profile(p_id) $$;

create function marketplace_private.visible_profile_image(p_name text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare m public.app_users; target_id uuid;
begin
  m := marketplace_private.member();
  if p_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/profile[.]webp$' then return false; end if;
  target_id := split_part(p_name,'/',1)::uuid;
  return exists(select 1 from public.app_users u where u.id=target_id and u.status='active' and
    ((u.role='brand' and exists(select 1 from public.brand_profiles p where p.user_id=u.id)) or
     (u.role='influencer' and exists(select 1 from public.influencer_profiles p where p.user_id=u.id) and exists(select 1 from public.social_links s where s.user_id=u.id))));
end;
$$;
-- Only SELECT is extended for accepted member-visible avatars/logos. The four
-- Phase 2 ownership write policies and private bucket settings remain intact.
create policy profile_images_member_read on storage.objects for select to authenticated
using (bucket_id='profile-images' and marketplace_private.visible_profile_image(name));

-- Ownership transfer does not require leaving CREATE privileges on the schema.
grant create on schema marketplace_private to marketplace_executor;
alter function marketplace_private.member() owner to marketplace_executor;
alter function marketplace_private.member_id() owner to marketplace_executor;
alter function marketplace_private.validate_terms(jsonb) owner to marketplace_executor;
alter function marketplace_private.reconcile(uuid) owner to marketplace_executor;
alter function marketplace_private.command(text,uuid,jsonb) owner to marketplace_executor;
alter function marketplace_private.profile(uuid) owner to marketplace_executor;
alter function marketplace_private.read(text,uuid,jsonb) owner to marketplace_executor;
alter function marketplace_private.visible_profile_image(text) owner to marketplace_executor;
revoke create on schema marketplace_private from marketplace_executor;
revoke all on all functions in schema marketplace_private from public, anon, authenticated;
grant execute on function marketplace_private.member_id(), marketplace_private.command(text,uuid,jsonb) to authenticated;
grant execute on function marketplace_private.profile(uuid), marketplace_private.read(text,uuid,jsonb) to authenticated;
grant execute on function marketplace_private.visible_profile_image(text) to authenticated;
revoke all on function public.marketplace_command(text,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.marketplace_command(text,uuid,jsonb) to authenticated;
revoke all on function public.marketplace_read(text,uuid,jsonb), public.member_profile(uuid) from public, anon, authenticated;
grant execute on function public.marketplace_read(text,uuid,jsonb), public.member_profile(uuid) to authenticated;
revoke marketplace_executor from postgres;

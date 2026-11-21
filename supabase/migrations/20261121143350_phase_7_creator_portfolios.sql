-- Public portfolios are separate, explicit creator publications. Existing member
-- profiles, Storage and collaboration records retain their private policies.
create table public.creator_portfolios (
  user_id uuid primary key references public.app_users(id),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  revision integer not null default 1 check (revision > 0),
  draft jsonb not null check (jsonb_typeof(draft) = 'object'),
  published_content jsonb check (jsonb_typeof(published_content) = 'object'),
  first_published_at timestamptz,
  published_at timestamptz,
  updated_at timestamptz not null default clock_timestamp(),
  check ((published_content is null) = (published_at is null)),
  check (published_at is null or first_published_at is not null)
);
alter table public.creator_portfolios enable row level security;
revoke all on public.creator_portfolios from public, anon, authenticated;
grant select, insert, update on public.creator_portfolios to marketplace_executor;
create policy executor_portfolios on public.creator_portfolios to marketplace_executor
  using (true) with check (true);

-- Hosted migrations must execute owner-specific ACL changes AS the owner.
grant marketplace_executor to postgres with inherit false, set true;
grant create on schema marketplace_private to marketplace_executor;
set role marketplace_executor;

create function marketplace_private.portfolio_content(p_content jsonb, p_complete boolean)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare
  v_name text; v_headline text; v_about text; v_title text; v_description text; v_url text;
  v_work jsonb; v_works jsonb := '[]'::jsonb;
begin
  if p_content is null or jsonb_typeof(p_content) <> 'object'
     or octet_length(p_content::text) > 30000
     or jsonb_typeof(p_content->'display_name') is distinct from 'string'
     or jsonb_typeof(p_content->'headline') is distinct from 'string'
     or jsonb_typeof(p_content->'about') is distinct from 'string'
     or jsonb_typeof(p_content->'works') is distinct from 'array' then
    raise exception 'Invalid portfolio fields' using errcode = '22023';
  end if;
  v_name := btrim(p_content->>'display_name');
  v_headline := btrim(p_content->>'headline');
  v_about := btrim(p_content->>'about');
  if length(v_name) > 80 or length(v_headline) > 140 or length(v_about) > 2000
     or (p_complete and (length(v_name) < 2 or length(v_headline) < 5 or length(v_about) < 20))
     or jsonb_array_length(p_content->'works') > 6
     or (p_complete and jsonb_array_length(p_content->'works') < 1) then
    raise exception 'Complete the bounded portfolio fields and work links' using errcode = '22023';
  end if;
  for v_work in select value from jsonb_array_elements(p_content->'works') loop
    if jsonb_typeof(v_work) <> 'object'
       or jsonb_typeof(v_work->'title') is distinct from 'string'
       or jsonb_typeof(v_work->'description') is distinct from 'string'
       or jsonb_typeof(v_work->'url') is distinct from 'string' then
      raise exception 'Invalid work item' using errcode = '22023';
    end if;
    v_title := btrim(v_work->>'title');
    v_description := btrim(v_work->>'description');
    v_url := btrim(v_work->>'url');
    if length(v_title) > 100 or length(v_description) > 300 or length(v_url) > 2048
       or (p_complete and (length(v_title) < 2 or length(v_url) = 0))
       or (v_url <> '' and (v_url !~ '^https://[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?(:[0-9]{1,5})?([/?#][^[:space:]\\]*)?$'
         or v_url ~* '%(0[0-9a-f]|1[0-9a-f]|7f)'
         or coalesce(substring(v_url from '^https://[^/:?#]+:([0-9]{1,5})'), '443')::integer not between 1 and 65535)) then
      raise exception 'Use bounded work text and HTTPS links without credentials' using errcode = '22023';
    end if;
    v_works := v_works || jsonb_build_array(jsonb_build_object(
      'title', v_title, 'description', v_description, 'url', v_url));
  end loop;
  -- Never retain caller-supplied identifiers/private fields in a snapshot.
  return jsonb_build_object('display_name', v_name, 'headline', v_headline, 'about', v_about, 'works', v_works);
end;
$$;

create function marketplace_private.portfolio_editor()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare m public.app_users; p public.creator_portfolios;
begin
  m := marketplace_private.member();
  if m.role <> 'influencer' then
    raise exception 'Creator membership required' using errcode = '42501';
  end if;
  select * into p from public.creator_portfolios where user_id = m.id;
  if p.user_id is null then
    return jsonb_build_object('slug', '', 'revision', 0, 'slug_locked', false,
      'published', false, 'published_content', null,
      'draft', jsonb_build_object('display_name', '', 'headline', '', 'about', '', 'works', '[]'::jsonb));
  end if;
  return jsonb_build_object('slug', p.slug, 'revision', p.revision,
    'slug_locked', p.first_published_at is not null, 'published', p.published_content is not null,
    'published_content', p.published_content, 'draft', p.draft);
end;
$$;

create function marketplace_private.portfolio_command(
  p_action text, p_expected_revision integer, p_data jsonb, p_consent boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare m public.app_users; p public.creator_portfolios; v_slug text; v_content jsonb;
begin
  m := marketplace_private.member();
  if m.role <> 'influencer' then
    raise exception 'Creator membership required' using errcode = '42501';
  end if;
  -- Serialize first creation and publication against membership suspension.
  select * into m from public.app_users where id = m.id and status = 'active' and role = 'influencer' for update;
  if m.id is null then raise exception 'Active creator required' using errcode = '42501'; end if;
  if p_action is null or p_action not in ('save', 'publish', 'unpublish')
     or p_expected_revision is null or p_expected_revision < 0
     or p_data is null or jsonb_typeof(p_data) <> 'object' or octet_length(p_data::text) > 32000 then
    raise exception 'Invalid portfolio command' using errcode = '22023';
  end if;
  select * into p from public.creator_portfolios where user_id = m.id for update;
  if coalesce(p.revision, 0) <> p_expected_revision then
    raise exception 'Portfolio changed; refresh before retrying' using errcode = 'PT409';
  end if;
  if p_action = 'unpublish' then
    if p.user_id is not null and p.published_content is not null then
      update public.creator_portfolios set published_content = null, published_at = null,
        revision = revision + 1, updated_at = clock_timestamp() where user_id = m.id;
    end if;
    return marketplace_private.portfolio_editor();
  end if;
  if jsonb_typeof(p_data->'slug') is distinct from 'string' then
    raise exception 'Choose a portfolio address' using errcode = '22023';
  end if;
  v_slug := p_data->>'slug';
  if v_slug !~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' then
    raise exception 'Invalid portfolio address' using errcode = '22023';
  end if;
  if p.first_published_at is not null and p.slug <> v_slug then
    raise exception 'Published address is permanent' using errcode = '22023';
  end if;
  if p_action = 'publish' and p_consent is distinct from true then
    raise exception 'Explicit public sharing consent required' using errcode = '22023';
  end if;
  v_content := marketplace_private.portfolio_content(p_data->'content', p_action = 'publish');
  begin
    if p.user_id is null then
      insert into public.creator_portfolios(user_id, slug, draft) values (m.id, v_slug, v_content);
    else
      update public.creator_portfolios set slug = v_slug, draft = v_content,
        revision = revision + 1, updated_at = clock_timestamp() where user_id = m.id;
    end if;
  exception when unique_violation then
    raise exception 'Portfolio address is unavailable' using errcode = 'PT409';
  end;
  if p_action = 'publish' then
    update public.creator_portfolios set published_content = v_content,
      first_published_at = coalesce(first_published_at, clock_timestamp()),
      published_at = clock_timestamp() where user_id = m.id;
  end if;
  return marketplace_private.portfolio_editor();
end;
$$;

create function marketplace_private.public_portfolio(p_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'display_name', p.published_content->'display_name',
    'headline', p.published_content->'headline',
    'about', p.published_content->'about',
    'works', p.published_content->'works')
  from public.creator_portfolios p
  join public.app_users u on u.id = p.user_id
  where p.slug = p_slug and length(p_slug) between 3 and 40
    and p.published_content is not null and u.status = 'active' and u.role = 'influencer'
    and exists(select 1 from public.influencer_profiles ip where ip.user_id = u.id)
    and exists(select 1 from public.social_links s where s.user_id = u.id)
$$;

revoke all on function marketplace_private.portfolio_content(jsonb,boolean),
  marketplace_private.portfolio_editor(), marketplace_private.portfolio_command(text,integer,jsonb,boolean),
  marketplace_private.public_portfolio(text) from public, anon, authenticated;
grant execute on function marketplace_private.portfolio_editor(),
  marketplace_private.portfolio_command(text,integer,jsonb,boolean) to authenticated;
grant execute on function marketplace_private.public_portfolio(text) to anon, authenticated;
reset role;
revoke create on schema marketplace_private from marketplace_executor;
revoke marketplace_executor from postgres;

-- USAGE permits name resolution, not execution of other private functions.
grant usage on schema marketplace_private to anon;
create function public.creator_portfolio_editor() returns jsonb
language sql security invoker set search_path = '' as $$ select marketplace_private.portfolio_editor() $$;
create function public.creator_portfolio_command(p_action text, p_expected_revision integer,
  p_data jsonb default '{}'::jsonb, p_consent boolean default false) returns jsonb
language sql security invoker set search_path = '' as $$ select marketplace_private.portfolio_command(p_action,p_expected_revision,p_data,p_consent) $$;
create function public.creator_portfolio(p_slug text) returns jsonb
language sql security invoker set search_path = '' as $$ select marketplace_private.public_portfolio(p_slug) $$;
revoke all on function public.creator_portfolio_editor(), public.creator_portfolio_command(text,integer,jsonb,boolean),
  public.creator_portfolio(text) from public, anon, authenticated;
grant execute on function public.creator_portfolio_editor(), public.creator_portfolio_command(text,integer,jsonb,boolean) to authenticated;
grant execute on function public.creator_portfolio(text) to anon, authenticated;

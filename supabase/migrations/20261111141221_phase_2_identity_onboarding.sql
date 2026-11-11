-- Clerk is the identity provider. Its verified JWT subject is text, not auth.uid().
-- Only the trusted owner/bootstrap SQL channel creates or changes app_users.
create table public.app_users (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null unique check (length(clerk_user_id) between 1 and 255),
  role text not null check (role in ('brand', 'influencer', 'admin')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now()
);

create table public.brand_profiles (
  user_id uuid primary key references public.app_users(id) on delete restrict,
  display_name text not null check (length(btrim(display_name)) between 2 and 100),
  description text not null check (length(btrim(description)) between 20 and 2000),
  location text not null check (length(btrim(location)) between 2 and 100),
  categories text[] not null check (cardinality(categories) between 1 and 5 and categories <@ array['Beauty','Fashion','Food & drink','Lifestyle','Travel','Technology','Fitness','Other']::text[]),
  website text check (website is null or (length(website) <= 2048 and website ~ '^https://[^/@[:space:]]+([/?#]|$)')),
  updated_at timestamptz not null default now()
);

create table public.influencer_profiles (
  user_id uuid primary key references public.app_users(id) on delete restrict,
  display_name text not null check (length(btrim(display_name)) between 2 and 100),
  bio text not null check (length(btrim(bio)) between 20 and 2000),
  location text not null check (length(btrim(location)) between 2 and 100),
  categories text[] not null check (cardinality(categories) between 1 and 5 and categories <@ array['Beauty','Fashion','Food & drink','Lifestyle','Travel','Technology','Fitness','Other']::text[]),
  updated_at timestamptz not null default now()
);

create function public.valid_social_url(platform text, url text) returns boolean
language sql immutable security invoker set search_path = ''
as $$
  select length(url) <= 2048 and url ~ '^https://[^/]+/.+' and
    case platform
      when 'Instagram' then lower(split_part(url, '/', 3)) in ('instagram.com', 'www.instagram.com')
      when 'YouTube' then lower(split_part(url, '/', 3)) in ('youtube.com', 'www.youtube.com', 'm.youtube.com')
      when 'TikTok' then lower(split_part(url, '/', 3)) in ('tiktok.com', 'www.tiktok.com')
      when 'Facebook' then lower(split_part(url, '/', 3)) in ('facebook.com', 'www.facebook.com', 'm.facebook.com')
      when 'X' then lower(split_part(url, '/', 3)) in ('x.com', 'www.x.com', 'twitter.com', 'www.twitter.com')
      else false end;
$$;

create table public.social_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.influencer_profiles(user_id) on delete cascade,
  platform text not null check (platform in ('Instagram','YouTube','TikTok','Facebook','X')),
  url text not null check (public.valid_social_url(platform, url)),
  follower_count bigint check (follower_count between 0 and 10000000000),
  metrics_as_of date,
  check (follower_count is null or metrics_as_of is not null),
  unique(user_id, platform)
);

-- PKs/unique constraints index identity and all ownership/FK lookup paths.
alter table public.app_users enable row level security;
alter table public.brand_profiles enable row level security;
alter table public.influencer_profiles enable row level security;
alter table public.social_links enable row level security;

revoke all on public.app_users, public.brand_profiles, public.influencer_profiles, public.social_links from public, anon, authenticated;
grant select on public.app_users to authenticated;
grant select, insert, update on public.brand_profiles, public.influencer_profiles to authenticated;
grant select, insert, update, delete on public.social_links to authenticated;

create policy own_identity on public.app_users for select to authenticated
using (clerk_user_id = (select auth.jwt()->>'sub'));

create policy own_active_brand on public.brand_profiles for all to authenticated
using (exists (select 1 from public.app_users u where u.id = user_id and u.clerk_user_id = (select auth.jwt()->>'sub') and u.status = 'active' and u.role = 'brand'))
with check (exists (select 1 from public.app_users u where u.id = user_id and u.clerk_user_id = (select auth.jwt()->>'sub') and u.status = 'active' and u.role = 'brand'));

create policy own_active_influencer on public.influencer_profiles for all to authenticated
using (exists (select 1 from public.app_users u where u.id = user_id and u.clerk_user_id = (select auth.jwt()->>'sub') and u.status = 'active' and u.role = 'influencer'))
with check (exists (select 1 from public.app_users u where u.id = user_id and u.clerk_user_id = (select auth.jwt()->>'sub') and u.status = 'active' and u.role = 'influencer'));

create policy own_active_social_links on public.social_links for all to authenticated
using (exists (select 1 from public.app_users u where u.id = user_id and u.clerk_user_id = (select auth.jwt()->>'sub') and u.status = 'active' and u.role = 'influencer'))
with check (exists (select 1 from public.app_users u where u.id = user_id and u.clerk_user_id = (select auth.jwt()->>'sub') and u.status = 'active' and u.role = 'influencer'));

-- No SECURITY DEFINER: RPCs operate as the requesting role under the same RLS.
create function public.complete_brand_onboarding(p_display_name text, p_description text, p_location text, p_categories text[], p_website text default null) returns void
language plpgsql security invoker set search_path = ''
as $$
declare member_id uuid;
begin
  select id into member_id from public.app_users where clerk_user_id = (select auth.jwt()->>'sub') and status = 'active' and role = 'brand';
  if member_id is null then raise exception 'Active brand membership required' using errcode = '42501'; end if;
  insert into public.brand_profiles(user_id, display_name, description, location, categories, website)
  values (member_id, btrim(p_display_name), btrim(p_description), btrim(p_location), p_categories, nullif(btrim(p_website), ''))
  on conflict (user_id) do update set display_name = excluded.display_name, description = excluded.description, location = excluded.location, categories = excluded.categories, website = excluded.website, updated_at = now();
end;
$$;

create function public.complete_influencer_onboarding(p_display_name text, p_bio text, p_location text, p_categories text[], p_links jsonb) returns void
language plpgsql security invoker set search_path = ''
as $$
declare member_id uuid; link jsonb;
begin
  select id into member_id from public.app_users where clerk_user_id = (select auth.jwt()->>'sub') and status = 'active' and role = 'influencer';
  if member_id is null then raise exception 'Active creator membership required' using errcode = '42501'; end if;
  if jsonb_typeof(p_links) is distinct from 'array' or jsonb_array_length(p_links) not between 1 and 5 then
    raise exception 'One to five social links required' using errcode = '22023';
  end if;
  insert into public.influencer_profiles(user_id, display_name, bio, location, categories)
  values (member_id, btrim(p_display_name), btrim(p_bio), btrim(p_location), p_categories)
  on conflict (user_id) do update set display_name = excluded.display_name, bio = excluded.bio, location = excluded.location, categories = excluded.categories, updated_at = now();
  delete from public.social_links where user_id = member_id;
  for link in select value from jsonb_array_elements(p_links) loop
    insert into public.social_links(user_id, platform, url, follower_count, metrics_as_of)
    values (member_id, link->>'platform', link->>'url', (link->>'follower_count')::bigint, (link->>'metrics_as_of')::date);
  end loop;
end;
$$;

revoke all on function public.valid_social_url(text, text) from public, anon, authenticated;
revoke all on function public.complete_brand_onboarding(text, text, text, text[], text) from public, anon, authenticated;
revoke all on function public.complete_influencer_onboarding(text, text, text, text[], jsonb) from public, anon, authenticated;
grant execute on function public.valid_social_url(text, text) to authenticated;
grant execute on function public.complete_brand_onboarding(text, text, text, text[], text) to authenticated;
grant execute on function public.complete_influencer_onboarding(text, text, text, text[], jsonb) to authenticated;

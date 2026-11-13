-- Hosted PostgreSQL is not the PGlite superuser. Platform-owned auth schema
-- USAGE cannot be granted by the migration role; non-inheriting temporary role
-- membership also does not confer the new function owner's grant options.
-- Run owner-specific ACL changes AS the owner, then remove temporary membership.
grant marketplace_executor to postgres with inherit false, set true;
grant create on schema marketplace_private to marketplace_executor;
set role marketplace_executor;

create or replace function marketplace_private.member() returns public.app_users
language plpgsql stable security definer set search_path = '' as $$
declare m public.app_users; verified_sub text;
begin
  -- Exact gateway claim-setting precedence used by hosted auth.jwt(). These
  -- settings are supplied by the JWT-verifying Data API, never form input.
  verified_sub := (coalesce(
    nullif(current_setting('request.jwt.claim',true),''),
    nullif(current_setting('request.jwt.claims',true),'')
  )::jsonb)->>'sub';
  select * into m from public.app_users where clerk_user_id=verified_sub and status='active';
  if m.id is null then raise exception 'Active pilot membership required' using errcode='42501'; end if;
  if m.role='brand' and not exists(select 1 from public.brand_profiles where user_id=m.id) then
    raise exception 'Complete your brand profile first' using errcode='42501';
  elsif m.role='influencer' and (not exists(select 1 from public.influencer_profiles where user_id=m.id) or not exists(select 1 from public.social_links where user_id=m.id)) then
    raise exception 'Complete your creator profile first' using errcode='42501';
  end if;
  return m;
end;
$$;

revoke all on all functions in schema marketplace_private from public, anon, authenticated;
grant execute on function marketplace_private.member_id(), marketplace_private.command(text,uuid,jsonb), marketplace_private.profile(uuid), marketplace_private.read(text,uuid,jsonb), marketplace_private.visible_profile_image(text) to authenticated;
alter default privileges for role marketplace_executor in schema marketplace_private revoke execute on functions from public;
reset role;
revoke create on schema marketplace_private from marketplace_executor;
revoke marketplace_executor from postgres;

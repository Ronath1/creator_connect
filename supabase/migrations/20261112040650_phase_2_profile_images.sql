-- Application accepts JPEG/PNG/WebP and normalizes to WebP before upload.
-- Delivery also decodes/re-encodes: direct Storage clients can spoof MIME.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('profile-images', 'profile-images', false, 5242880, array['image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/webp'];

-- Supabase manages storage.objects and its RLS. Add narrowly scoped policies;
-- do not replace the platform's schema/grants or touch other buckets/policies.
-- A fixed path permits one object per member and avoids orphaned versions.
create policy profile_images_select_own on storage.objects
for select to authenticated
using (
  bucket_id = 'profile-images' and exists (
    select 1 from public.app_users u
    where u.clerk_user_id = (select auth.jwt()->>'sub') and u.status = 'active'
      and u.role in ('brand', 'influencer') and name = u.id::text || '/profile.webp'
  )
);

create policy profile_images_insert_own on storage.objects
for insert to authenticated
with check (
  bucket_id = 'profile-images' and exists (
    select 1 from public.app_users u
    where u.clerk_user_id = (select auth.jwt()->>'sub') and u.status = 'active'
      and u.role in ('brand', 'influencer') and name = u.id::text || '/profile.webp'
  )
);

create policy profile_images_update_own on storage.objects
for update to authenticated
using (
  bucket_id = 'profile-images' and exists (
    select 1 from public.app_users u
    where u.clerk_user_id = (select auth.jwt()->>'sub') and u.status = 'active'
      and u.role in ('brand', 'influencer') and name = u.id::text || '/profile.webp'
  )
)
with check (
  bucket_id = 'profile-images' and exists (
    select 1 from public.app_users u
    where u.clerk_user_id = (select auth.jwt()->>'sub') and u.status = 'active'
      and u.role in ('brand', 'influencer') and name = u.id::text || '/profile.webp'
  )
);

create policy profile_images_delete_own on storage.objects
for delete to authenticated
using (
  bucket_id = 'profile-images' and exists (
    select 1 from public.app_users u
    where u.clerk_user_id = (select auth.jwt()->>'sub') and u.status = 'active'
      and u.role in ('brand', 'influencer') and name = u.id::text || '/profile.webp'
  )
);

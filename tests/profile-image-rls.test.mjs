import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

let db;
const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const admin = "33333333-3333-4333-8333-333333333333";
const objectPath = `${owner}/profile.webp`;

before(async () => {
  db = new PGlite();
  // TEST ONLY: JWT gateway fixture and minimal Storage tables for real SQL RLS.
  // MIME/size/object-byte behavior must also pass hosted Storage API tests.
  await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth;
    create function auth.jwt() returns jsonb language sql stable security invoker as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    grant usage on schema public, auth to anon, authenticated; grant execute on function auth.jwt() to anon, authenticated;
    create schema storage; grant usage on schema storage to anon, authenticated;
    create table storage.buckets(id text primary key, name text not null, public boolean not null, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text not null, metadata jsonb, unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to authenticated; grant select on storage.objects to anon;`);
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/20261111141221_phase_2_identity_onboarding.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/20261112040650_phase_2_profile_images.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.query(
    "insert into public.app_users(id,clerk_user_id,role) values ($1,'storage_owner','brand'),($2,'storage_other','influencer'),($3,'storage_admin','admin')",
    [owner, other, admin],
  );
});
after(async () => {
  await db?.close();
});
async function asUser(sub, operation, role = "authenticated") {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${role}`);
    await tx.query("select set_config('request.jwt.claims',$1,true)", [
      JSON.stringify(sub ? { sub } : {}),
    ]);
    return operation(tx);
  });
}
const upload = (path) => (tx) =>
  tx.query(
    "insert into storage.objects(bucket_id,name,metadata) values ('profile-images',$1,'{\"version\":1}') on conflict(bucket_id,name) do update set metadata=excluded.metadata returning name",
    [path],
  );

test("bucket is private, WebP-only and bounded to 5 MiB", async () => {
  const result = await db.query(
    "select public,file_size_limit,allowed_mime_types from storage.buckets where id='profile-images'",
  );
  assert.equal(result.rows[0].public, false);
  assert.equal(Number(result.rows[0].file_size_limit), 5 * 1024 * 1024);
  assert.deepEqual(result.rows[0].allowed_mime_types, ["image/webp"]);
});
test("own active upload/upsert remains a single object", async () => {
  await asUser("storage_owner", upload(objectPath));
  await asUser("storage_owner", upload(objectPath));
  const result = await asUser("storage_owner", (tx) =>
    tx.query("select name from storage.objects"),
  );
  assert.deepEqual(result.rows, [{ name: objectPath }]);
});
test("other identities and uninvited users cannot read or replace the object", async () => {
  for (const sub of ["storage_other", "storage_admin", "storage_uninvited"]) {
    assert.equal(
      (await asUser(sub, (tx) => tx.query("select * from storage.objects")))
        .rows.length,
      0,
    );
    await assert.rejects(asUser(sub, upload(objectPath)), /row-level security/);
  }
  assert.equal(
    (
      await asUser(
        null,
        (tx) => tx.query("select * from storage.objects"),
        "anon",
      )
    ).rows.length,
    0,
  );
});
test("owner cannot add alternate paths or move/reassign objects", async () => {
  for (const path of [
    `${owner}/extra.webp`,
    `${owner}/profile.svg`,
    `${other}/profile.webp`,
    `${owner}/../profile.webp`,
  ])
    await assert.rejects(
      asUser("storage_owner", upload(path)),
      /row-level security/,
    );
  await assert.rejects(
    asUser("storage_owner", (tx) =>
      tx.query("update storage.objects set name=$1 where name=$2", [
        `${other}/profile.webp`,
        objectPath,
      ]),
    ),
    /row-level security/,
  );
});
test("administrators cannot upload their own image through the member policy", async () => {
  await assert.rejects(
    asUser("storage_admin", upload(`${admin}/profile.webp`)),
    /row-level security/,
  );
});
test("suspension revokes read, write and delete immediately", async () => {
  await db.query("update public.app_users set status='suspended' where id=$1", [
    owner,
  ]);
  assert.equal(
    (
      await asUser("storage_owner", (tx) =>
        tx.query("select * from storage.objects"),
      )
    ).rows.length,
    0,
  );
  await assert.rejects(
    asUser("storage_owner", upload(objectPath)),
    /row-level security/,
  );
  assert.equal(
    (
      await asUser("storage_owner", (tx) =>
        tx.query("delete from storage.objects where name=$1 returning name", [
          objectPath,
        ]),
      )
    ).rows.length,
    0,
  );
});
test("active owner can remove its current image without orphan versions", async () => {
  await db.query("update public.app_users set status='active' where id=$1", [
    owner,
  ]);
  await asUser("storage_owner", (tx) =>
    tx.query("delete from storage.objects where name=$1", [objectPath]),
  );
  assert.equal(
    (await db.query("select * from storage.objects")).rows.length,
    0,
  );
});

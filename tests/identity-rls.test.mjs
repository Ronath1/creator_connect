import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

let db;
const brand = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const creator = "33333333-3333-4333-8333-333333333333";

before(async () => {
  db = new PGlite();
  // TEST ONLY: emulate Supabase roles and the claims already verified by its JWT
  // gateway. Application auth never uses this fixture or fabricated sessions.
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create function auth.jwt() returns jsonb language sql stable security invoker
      as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    grant usage on schema public, auth to anon, authenticated;
    grant execute on function auth.jwt() to anon, authenticated;
  `);
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/20261111141221_phase_2_identity_onboarding.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.query(
    `insert into public.app_users(id, clerk_user_id, role) values ($1,'test_brand','brand'),($2,'test_other','brand'),($3,'test_creator','influencer')`,
    [brand, other, creator],
  );
});

after(async () => {
  await db?.close();
});

async function asUser(sub, operation, role = "authenticated") {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${role}`);
    await tx.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify(sub ? { sub } : {}),
    ]);
    return operation(tx);
  });
}

function saveBrand(tx, name = "Test brand") {
  return tx.query("select public.complete_brand_onboarding($1,$2,$3,$4,$5)", [
    name,
    "A synthetic brand profile used only in local tests.",
    "Colombo",
    ["Other"],
    null,
  ]);
}

function saveCreator(
  tx,
  links = [
    { platform: "Instagram", url: "https://www.instagram.com/synthetic_test" },
  ],
) {
  return tx.query(
    "select public.complete_influencer_onboarding($1,$2,$3,$4,$5)",
    [
      "Test creator",
      "Synthetic creator description for isolated tests.",
      "Kandy",
      ["Lifestyle"],
      JSON.stringify(links),
    ],
  );
}

test("anonymous callers have neither table nor onboarding RPC access", async () => {
  await assert.rejects(
    asUser(null, (tx) => tx.query("select * from public.app_users"), "anon"),
    /permission denied/,
  );
  await assert.rejects(asUser(null, saveBrand, "anon"), /permission denied/);
});

test("uninvited authenticated identity cannot bootstrap membership or onboard", async () => {
  const data = await asUser("test_uninvited", (tx) =>
    tx.query("select * from public.app_users"),
  );
  assert.equal(data.rows.length, 0);
  await assert.rejects(
    asUser("test_uninvited", (tx) =>
      tx.query(
        "insert into public.app_users(clerk_user_id,role) values ('test_uninvited','admin')",
      ),
    ),
    /permission denied/,
  );
  await assert.rejects(
    asUser("test_uninvited", saveBrand),
    /membership required/,
  );
});

test("membership is private and role/status are not client writable", async () => {
  const result = await asUser("test_brand", (tx) =>
    tx.query("select * from public.app_users"),
  );
  assert.deepEqual(
    result.rows.map((row) => row.id),
    [brand],
  );
  await assert.rejects(
    asUser("test_brand", (tx) =>
      tx.query("update public.app_users set role='admin' where id=$1", [brand]),
    ),
    /permission denied/,
  );
  await assert.rejects(
    asUser("test_brand", (tx) =>
      tx.query("update public.app_users set status='active' where id=$1", [
        brand,
      ]),
    ),
    /permission denied/,
  );
});

test("brand onboarding retries update one own profile rather than duplicating", async () => {
  await asUser("test_brand", saveBrand);
  await asUser("test_brand", (tx) => saveBrand(tx, "Updated brand"));
  const result = await db.query(
    "select display_name from public.brand_profiles where user_id=$1",
    [brand],
  );
  assert.deepEqual(result.rows, [{ display_name: "Updated brand" }]);
});

test("direct cross-user profile reads and writes obey RLS", async () => {
  await asUser("test_other", saveBrand);
  const result = await asUser("test_brand", (tx) =>
    tx.query("select * from public.brand_profiles where user_id=$1", [other]),
  );
  assert.equal(result.rows.length, 0);
  const update = await asUser("test_brand", (tx) =>
    tx.query(
      "update public.brand_profiles set display_name='Attacker' where user_id=$1 returning user_id",
      [other],
    ),
  );
  assert.equal(update.rows.length, 0);
  await assert.rejects(
    asUser("test_brand", (tx) =>
      tx.query("update public.brand_profiles set user_id=$1 where user_id=$2", [
        other,
        brand,
      ]),
    ),
    /row-level security/,
  );
});

test("wrong role cannot save a creator profile through RPC or direct API", async () => {
  await assert.rejects(
    asUser("test_brand", saveCreator),
    /membership required/,
  );
  await assert.rejects(
    asUser("test_brand", (tx) =>
      tx.query(
        "insert into public.influencer_profiles(user_id,display_name,bio,location,categories) values ($1,'Invalid creator','A long enough invalid creator biography.','Colombo',array['Other'])",
        [brand],
      ),
    ),
    /row-level security/,
  );
});

test("creator retries keep a single profile and one link per platform", async () => {
  await asUser("test_creator", saveCreator);
  await asUser("test_creator", saveCreator);
  const result = await asUser("test_creator", (tx) =>
    tx.query("select platform,url from public.social_links"),
  );
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].platform, "Instagram");
  const outsider = await asUser("test_brand", (tx) =>
    tx.query("select * from public.social_links"),
  );
  assert.equal(outsider.rows.length, 0);
});

test("invalid creator links roll back the complete multi-table save", async () => {
  await assert.rejects(
    asUser("test_creator", (tx) =>
      saveCreator(tx, [
        {
          platform: "Instagram",
          url: "https://instagram.com.attacker.example/stolen",
        },
      ]),
    ),
    /check constraint/,
  );
  const result = await db.query(
    "select url from public.social_links where user_id=$1",
    [creator],
  );
  assert.equal(result.rows[0].url, "https://www.instagram.com/synthetic_test");
  await assert.rejects(
    asUser("test_creator", (tx) => saveCreator(tx, [])),
    /social links required/,
  );
});

test("suspension blocks existing profile/social reads and writes immediately", async () => {
  await db.query("update public.app_users set status='suspended' where id=$1", [
    creator,
  ]);
  const result = await asUser("test_creator", (tx) =>
    tx.query("select * from public.influencer_profiles"),
  );
  assert.equal(result.rows.length, 0);
  await assert.rejects(
    asUser("test_creator", saveCreator),
    /membership required/,
  );
  await assert.rejects(
    asUser("test_creator", (tx) =>
      tx.query(
        "insert into public.social_links(user_id,platform,url) values ($1,'X','https://x.com/synthetic_test')",
        [creator],
      ),
    ),
    /row-level security/,
  );
});

test("every exposed table has RLS and onboarding never bypasses it", async () => {
  const tables = await db.query(
    "select relname,relrowsecurity from pg_class where relnamespace='public'::regnamespace and relkind='r' order by relname",
  );
  assert.equal(tables.rows.length, 4);
  assert.ok(tables.rows.every((row) => row.relrowsecurity));
  const functions = await db.query(
    "select proname,prosecdef from pg_proc where pronamespace='public'::regnamespace",
  );
  assert.ok(functions.rows.every((row) => !row.prosecdef));
});

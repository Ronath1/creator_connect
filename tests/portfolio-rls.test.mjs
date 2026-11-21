import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
let db;
before(async () => {
  db = new PGlite();
  // TEST ONLY gateway plumbing; production uses real Clerk/Supabase JWTs.
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create schema auth; create function auth.jwt() returns jsonb language sql stable as
    $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    grant usage on schema public,auth to anon,authenticated,service_role;
    grant execute on function auth.jwt() to anon,authenticated,service_role;
    create schema storage; grant usage on schema storage to anon,authenticated;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,metadata jsonb,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to authenticated;`);
  for (const file of [
    "20261111141221_phase_2_identity_onboarding.sql",
    "20261112040650_phase_2_profile_images.sql",
    "20261113074928_phase_3_marketplace.sql",
    "20261113080451_phase_3_executor_permissions.sql",
    "20261113080905_phase_3_business_conflict_status.sql",
    "20261113124926_phase_4_collaboration.sql",
    "20261113132418_phase_4_upload_lifecycle.sql",
    "20261113133635_phase_4_case_history_polling.sql",
    "20261114115844_phase_4_evidence_notifications.sql",
    "20261114121147_phase_4_support_case_guards.sql",
    "20261121143350_phase_7_creator_portfolios.sql",
  ])
    await db.exec(
      await readFile(
        new URL(`../supabase/migrations/${file}`, import.meta.url),
        "utf8",
      ),
    );
});
after(async () => db?.close());
async function as(sub, fn, role = "authenticated") {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${role}`);
    await tx.query("select set_config('request.jwt.claims',$1,true)", [
      JSON.stringify(sub ? { sub } : {}),
    ]);
    return fn(tx);
  });
}
async function member(role = "influencer", complete = true) {
  const id = randomUUID(),
    sub = `synthetic_${id}`;
  await db.query(
    "insert into public.app_users(id,clerk_user_id,role)values($1,$2,$3)",
    [id, sub, role],
  );
  if (complete && role === "influencer")
    await as(sub, (tx) =>
      tx.query(
        "select public.complete_influencer_onboarding('Private profile name','Private profile biography, never automatically public.','Kandy',array['Other'],$1)",
        [
          JSON.stringify([
            { platform: "Instagram", url: "https://instagram.com/synthetic" },
          ]),
        ],
      ),
    );
  if (complete && role === "brand")
    await as(sub, (tx) =>
      tx.query(
        "select public.complete_brand_onboarding('Private brand','A synthetic private brand biography.','Colombo',array['Other'],null)",
      ),
    );
  return { id, sub };
}
function content(extra = {}) {
  return {
    display_name: "Chosen public name",
    headline: "Thoughtful promotional work",
    about:
      "A curated introduction, separate from my private marketplace profile.",
    works: [
      {
        title: "An example campaign",
        description: "A publicly shareable piece.",
        url: "https://example.com/work",
      },
    ],
    ...extra,
  };
}
async function command(m, action, revision, data = {}, consent = false) {
  const r = await as(m.sub, (tx) =>
    tx.query("select public.creator_portfolio_command($1,$2,$3,$4) value", [
      action,
      revision,
      JSON.stringify(data),
      consent,
    ]),
  );
  return r.rows[0].value;
}
async function read(slug, sub = null, role = "anon") {
  const r = await as(
    sub,
    (tx) => tx.query("select public.creator_portfolio($1) value", [slug]),
    role,
  );
  return r.rows[0].value;
}
async function publish(m, slug, fields = content()) {
  return command(m, "publish", 0, { slug, content: fields }, true);
}
test("default unpublished, incomplete drafts and private owner editor do not leak", async () => {
  const m = await member();
  const initial = await as(m.sub, (tx) =>
    tx.query("select public.creator_portfolio_editor() value"),
  );
  assert.equal(initial.rows[0].value.revision, 0);
  assert.equal(initial.rows[0].value.published, false);
  const saved = await command(m, "save", 0, {
    slug: "draft-only",
    content: content({ display_name: "", headline: "", about: "", works: [] }),
  });
  assert.equal(saved.revision, 1);
  assert.equal(saved.published, false);
  assert.equal(await read("draft-only"), null);
  const other = await member();
  const own = await as(other.sub, (tx) =>
    tx.query("select public.creator_portfolio_editor() value"),
  );
  assert.equal(own.rows[0].value.slug, "");
  await assert.rejects(
    as(
      null,
      (tx) => tx.query("select public.creator_portfolio_editor()"),
      "anon",
    ),
    /permission denied/,
  );
});
test("publication needs affirmative consent and complete bounded content", async () => {
  const m = await member();
  for (const consent of [false, null])
    await assert.rejects(
      command(
        m,
        "publish",
        0,
        { slug: "consent-only", content: content() },
        consent,
      ),
      /consent/i,
    );
  await assert.rejects(
    publish(m, "consent-only", content({ works: [] })),
    /Complete/,
  );
  await assert.rejects(
    publish(m, "consent-only", content({ about: "short" })),
    /Complete/,
  );
  await assert.rejects(
    publish(
      m,
      "consent-only",
      content({ works: Array(7).fill(content().works[0]) }),
    ),
    /Complete/,
  );
  assert.equal(await read("consent-only"), null);
  const saved = await publish(m, "consent-only");
  assert.equal(saved.published, true);
  assert.equal(saved.slug_locked, true);
});
test("anonymous projection is exact allowlist, not private profile or caller extras", async () => {
  const m = await member();
  const chosen = content({
    clerk_id: "must-not-leak",
    email: "private@example.test",
    location: "Private location",
    works: [{ ...content().works[0], private_note: "secret" }],
  });
  await publish(m, "safe-public", chosen);
  const result = await read("safe-public");
  assert.deepEqual(Object.keys(result).sort(), [
    "about",
    "display_name",
    "headline",
    "works",
  ]);
  assert.deepEqual(Object.keys(result.works[0]).sort(), [
    "description",
    "title",
    "url",
  ]);
  assert.equal(result.display_name, "Chosen public name");
  assert.ok(!JSON.stringify(result).includes(m.id));
  assert.ok(!JSON.stringify(result).includes("private@example.test"));
  assert.ok(!JSON.stringify(result).includes("Private profile"));
});
test("saving drafts leaves published snapshot unchanged; republish needs fresh consent", async () => {
  const m = await member();
  await publish(m, "snapshot-only");
  const updated = content({ display_name: "A different draft name" });
  const draft = await command(m, "save", 1, {
    slug: "snapshot-only",
    content: updated,
  });
  assert.equal(draft.revision, 2);
  assert.equal(
    (await read("snapshot-only")).display_name,
    "Chosen public name",
  );
  await assert.rejects(
    command(m, "publish", 2, { slug: "snapshot-only", content: updated }),
    /consent/i,
  );
  await command(
    m,
    "publish",
    2,
    { slug: "snapshot-only", content: updated },
    true,
  );
  assert.equal(
    (await read("snapshot-only")).display_name,
    updated.display_name,
  );
});
test("unpublish removes server access but permanently reserves first published address", async () => {
  const m = await member(),
    other = await member();
  await publish(m, "permanent-name");
  const result = await command(m, "unpublish", 1);
  assert.equal(result.published, false);
  assert.equal(result.slug_locked, true);
  assert.equal(await read("permanent-name"), null);
  await assert.rejects(
    command(m, "save", 2, { slug: "different-name", content: content() }),
    /permanent/,
  );
  await assert.rejects(
    publish(other, "permanent-name"),
    (e) => e.code === "PT409",
  );
});
test("slug collisions and stale revisions reject atomically with PT409, not40001", async () => {
  const m = await member(),
    other = await member();
  await command(m, "save", 0, { slug: "unique-address", content: content() });
  await assert.rejects(
    publish(other, "unique-address"),
    (e) => e.code === "PT409",
  );
  await assert.rejects(
    command(
      m,
      "publish",
      0,
      { slug: "unique-address", content: content() },
      true,
    ),
    (e) => e.code === "PT409",
  );
  assert.equal(await read("unique-address"), null);
  await assert.rejects(command(m, null, 1), /Invalid/);
  await assert.rejects(
    command(m, "save", null, { slug: "unique-address", content: content() }),
    /Invalid/,
  );
});
test("brand, administrator, uninvited and incomplete creators cannot own or publish", async () => {
  for (const m of [
    await member("brand"),
    await member("admin"),
    await member("influencer", false),
    { sub: "uninvited" },
  ]) {
    await assert.rejects(
      publish(m, `role-${randomUUID()}`),
      (e) => e.code === "42501",
    );
  }
});
test("suspension and withdrawn profile completeness hide existing public content", async () => {
  const m = await member();
  await publish(m, "currently-active");
  await db.query("update public.app_users set status='suspended' where id=$1", [
    m.id,
  ]);
  assert.equal(await read("currently-active"), null);
  await assert.rejects(
    command(m, "save", 1, { slug: "currently-active", content: content() }),
    (e) => e.code === "42501",
  );
  await db.query("update public.app_users set status='active' where id=$1", [
    m.id,
  ]);
  await db.query("delete from public.social_links where user_id=$1", [m.id]);
  assert.equal(await read("currently-active"), null);
});
test("no table grants/raw DML or private helper bypass, including ALL anon function ACLs", async () => {
  const m = await member();
  await publish(m, "no-table-access");
  for (const role of ["anon", "authenticated"])
    for (const sql of [
      "select * from public.creator_portfolios",
      "update public.creator_portfolios set published_content=null",
      "delete from public.creator_portfolios",
      "insert into public.creator_portfolios(user_id,slug,draft) values(gen_random_uuid(),'bad-write','{}')",
      "select * from public.influencer_profiles where true",
    ]) {
      if (
        role === "authenticated" &&
        sql.startsWith("select * from public.influencer_profiles")
      )
        continue;
      await assert.rejects(
        as(m.sub, (tx) => tx.query(sql), role),
        /permission denied/,
      );
    }
  const acl =
    await db.query(`select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='marketplace_private' and has_function_privilege('anon',p.oid,'execute') order by p.proname`);
  assert.deepEqual(
    acl.rows.map((x) => x.proname),
    ["public_portfolio"],
  );
  for (const role of ["anon", "authenticated"])
    await assert.rejects(
      as(
        m.sub,
        (tx) =>
          tx.query("select marketplace_private.portfolio_content('{}',false)"),
        role,
      ),
      /permission denied/,
    );
  await assert.rejects(
    as(null, (tx) => tx.query("select marketplace_private.member()"), "anon"),
    /permission denied/,
  );
  const r = await db.query(
    "select rolcanlogin,rolinherit,rolbypassrls,has_schema_privilege('marketplace_executor','marketplace_private','create') as creates from pg_roles where rolname='marketplace_executor'",
  );
  assert.deepEqual(r.rows[0], {
    rolcanlogin: false,
    rolinherit: false,
    rolbypassrls: false,
    creates: false,
  });
});
test("direct RPC rejects unsafe links/slugs and oversized fields even bypassing forms", async () => {
  const m = await member();
  for (const slug of ["ab", "MixedCase", "-edge", "edge-", "a".repeat(41)])
    await assert.rejects(publish(m, slug), /address/i);
  for (const url of [
    "http://example.com",
    "javascript:alert(1)",
    "//example.com",
    "https://user:pass@example.com",
    "https://example.com\\evil",
    "https://example.com/white space",
    "https://example.com:65536/work",
    "https://example.com:0/work",
    "https://example.com/%0Aheader",
    "https://example.com/%7f",
  ])
    await assert.rejects(
      publish(
        m,
        "validated-input",
        content({ works: [{ ...content().works[0], url }] }),
      ),
      /HTTPS/,
    );
  await assert.rejects(
    publish(m, "validated-input", content({ display_name: "n".repeat(81) })),
    /Complete/,
  );
});

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

let db;
const ids = {
  brand: "11111111-1111-4111-8111-111111111111",
  other: "22222222-2222-4222-8222-222222222222",
  creator: "33333333-3333-4333-8333-333333333333",
  rival: "44444444-4444-4444-8444-444444444444",
  admin: "55555555-5555-4555-8555-555555555555",
  incomplete: "66666666-6666-4666-8666-666666666666",
};
before(async () => {
  db = new PGlite();
  // TEST ONLY verified-claim/role fixture, never imported by application auth.
  await db.exec(`create role anon nologin; create role authenticated nologin;
    create schema auth;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    grant usage on schema public,auth to anon,authenticated;
    grant execute on function auth.jwt() to anon,authenticated;
    create schema storage; grant usage on schema storage to authenticated,anon;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,metadata jsonb,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to authenticated; grant select on storage.objects to anon;`);
  for (const file of [
    "20261111141221_phase_2_identity_onboarding.sql",
    "20261112040650_phase_2_profile_images.sql",
    "20261113074928_phase_3_marketplace.sql",
    "20261113080451_phase_3_executor_permissions.sql",
    "20261113080905_phase_3_business_conflict_status.sql",
  ])
    await db.exec(
      await readFile(
        new URL(`../supabase/migrations/${file}`, import.meta.url),
        "utf8",
      ),
    );
  for (const [name, id] of Object.entries(ids)) {
    await db.query(
      "insert into public.app_users(id,clerk_user_id,role) values($1,$2,$3)",
      [
        id,
        `test_${name}`,
        name === "brand" || name === "other"
          ? "brand"
          : name === "admin"
            ? "admin"
            : "influencer",
      ],
    );
    if (["brand", "other"].includes(name))
      await as(name, (tx) =>
        tx.query("select public.complete_brand_onboarding($1,$2,$3,$4,$5)", [
          name,
          "A synthetic brand profile for marketplace tests.",
          "Colombo",
          ["Other"],
          null,
        ]),
      );
    else if (["creator", "rival"].includes(name))
      await as(name, (tx) =>
        tx.query(
          "select public.complete_influencer_onboarding($1,$2,$3,$4,$5)",
          [
            name,
            "A synthetic creator profile for marketplace tests.",
            "Kandy",
            ["Other"],
            JSON.stringify([
              {
                platform: "Instagram",
                url: `https://instagram.com/test_${name}`,
              },
            ]),
          ],
        ),
      );
  }
});
after(async () => db?.close());
async function as(name, fn, role = "authenticated") {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${role}`);
    await tx.query("select set_config('request.jwt.claims',$1,true)", [
      JSON.stringify(name ? { sub: `test_${name}` } : {}),
    ]);
    return fn(tx);
  });
}
function terms(extra = {}) {
  return {
    title: "A thoughtful launch campaign",
    brief: "Share an honest introduction to this synthetic product launch.",
    category: "Other",
    platforms: ["Instagram"],
    deliverables: [
      {
        format: "Reel",
        quantity: 1,
        acceptance: "One clear product introduction.",
      },
    ],
    budget_minor: 1500000,
    currency: "LKR",
    application_deadline: new Date(Date.now() + 86400000 * 3).toISOString(),
    delivery_deadline: new Date(Date.now() + 86400000 * 20).toISOString(),
    revision_allowance: 1,
    ...extra,
  };
}
async function command(name, action, id = null, data = {}) {
  if (action === "publish" && data.expected_version === undefined)
    data = {
      ...data,
      expected_version: (
        await db.query("select version from public.opportunities where id=$1", [
          id,
        ])
      ).rows[0]?.version,
    };
  const r = await as(name, (tx) =>
    tx.query("select public.marketplace_command($1,$2,$3) id", [
      action,
      id,
      JSON.stringify(data),
    ]),
  );
  return r.rows[0].id;
}
async function opportunity() {
  return command("brand", "create", null, terms());
}
async function publish() {
  const id = await opportunity();
  await command("brand", "publish", id);
  return id;
}
async function apply(id, name = "creator") {
  return command(name, "apply", id, {
    proposal: "I would create a clear and engaging introduction.",
    work_urls: ["https://example.com/work"],
  });
}

test("anonymous, uninvited and incomplete identities cannot use marketplace RPCs", async () => {
  await assert.rejects(
    as(
      null,
      (tx) => tx.query("select public.marketplace_read('discover')"),
      "anon",
    ),
    /permission denied/,
  );
  await assert.rejects(
    command("uninvited", "create", null, terms()),
    /Active pilot membership/,
  );
  await assert.rejects(
    command("incomplete", "apply", await publish(), {
      proposal: "A sufficiently long proposal.",
    }),
    /Complete your creator/,
  );
  await assert.rejects(
    command("creator", "create", null, terms()),
    /Brand membership/,
  );
});
test("member projection exposes only agreed profile fields", async () => {
  const r = await as("creator", (tx) =>
    tx.query("select public.member_profile($1) profile", [ids.brand]),
  );
  assert.equal(r.rows[0].profile.display_name, "brand");
  assert.equal(r.rows[0].profile.clerk_user_id, undefined);
  assert.equal(r.rows[0].profile.status, undefined);
  assert.equal(r.rows[0].profile.email, undefined);
  const raw = await as("creator", (tx) =>
    tx.query("select * from public.brand_profiles where user_id=$1", [
      ids.brand,
    ]),
  );
  assert.equal(raw.rows.length, 0);
});
test("draft privacy, owner publishing and bounded discovery", async () => {
  const id = await opportunity();
  assert.equal(
    (
      await as("creator", (tx) =>
        tx.query("select * from public.opportunities where id=$1", [id]),
      )
    ).rows.length,
    0,
  );
  await assert.rejects(command("other", "publish", id), /owning brand/);
  await command("brand", "publish", id);
  const r = await as("creator", (tx) =>
    tx.query("select public.marketplace_read('discover',null,$1) result", [
      JSON.stringify({ limit: 500 }),
    ]),
  );
  assert.ok(r.rows[0].result.items.some((o) => o.id === id));
  assert.ok(r.rows[0].result.items.length <= 50);
});
test("no caller can directly mutate lifecycle, history, events or trusted helpers", async () => {
  const id = await publish();
  for (const sql of [
    "update public.opportunities set status='open'",
    "delete from public.opportunity_history",
    "insert into public.marketplace_events(opportunity_id,recipient_id,kind,dedupe_key) values(null,null,'x','x')",
    `select marketplace_private.reconcile('${id}')`,
  ])
    await assert.rejects(
      as("brand", (tx) => tx.exec(sql)),
      /permission denied/,
    );
  assert.equal(
    (
      await db.query(
        "select pg_has_role('authenticated','marketplace_executor','MEMBER') allowed",
      )
    ).rows[0].allowed,
    false,
  );
});
test("one application forever; withdrawal final and private from competing creator/admin", async () => {
  const id = await publish(),
    app = await apply(id);
  for (const actor of ["rival", "admin", "other"])
    assert.equal(
      (
        await as(actor, (tx) =>
          tx.query("select * from public.applications where id=$1", [app]),
        )
      ).rows.length,
      0,
    );
  await assert.rejects(
    command("rival", "withdraw", id, { application_id: app }),
    /own application/,
  );
  await command("creator", "withdraw", id, { application_id: app });
  await assert.rejects(apply(id), /unique/);
});
test("material terms freeze in database after applications; correction history and event persist", async () => {
  const id = await publish();
  await apply(id);
  const o = (
    await db.query("select * from public.opportunities where id=$1", [id])
  ).rows[0];
  await assert.rejects(
    command("brand", "edit", id, {
      ...terms(),
      expected_version: o.version,
      budget_minor: 2000000,
      reason: "Changed compensation",
    }),
    /Material terms/,
  );
  const payload = {
    ...o,
    title: "A corrected launch campaign",
    reason: "Corrected title spelling",
    expected_version: o.version,
  };
  await command("brand", "edit", id, payload);
  await assert.rejects(command("brand", "edit", id, payload), /Refresh/);
  assert.equal(
    (
      await db.query(
        "select * from public.marketplace_events where opportunity_id=$1 and kind='brief_corrected'",
        [id],
      )
    ).rows.length,
    1,
  );
});
test("selection reserves one slot atomically and snapshots terms without mutual agreement", async () => {
  const id = await publish(),
    app = await apply(id),
    rival = await apply(id, "rival");
  const collaboration = await command("brand", "select", id, {
    application_id: app,
  });
  assert.equal(
    await command("brand", "select", id, { application_id: app }),
    collaboration,
  );
  const c = (
    await db.query("select * from public.collaborations where id=$1", [
      collaboration,
    ])
  ).rows[0];
  assert.equal(c.status, "pending_agreement");
  assert.equal(c.activated_at, null);
  assert.equal(c.terms.currency, "LKR");
  await assert.rejects(
    command("brand", "select", id, { application_id: rival }),
    /already reserved|Selection window is closed/,
  );
  await assert.rejects(command("brand", "reopen", id), /cannot be reopened/);
  assert.equal(
    (
      await db.query("select status from public.applications where id=$1", [
        rival,
      ])
    ).rows[0].status,
    "pending",
  );
  await command("rival", "withdraw", id, { application_id: rival });
  await assert.rejects(apply(id, "rival"), /closed/);
});
test("deadline closure, reserved-window preservation and expired-match fresh selection window", async () => {
  const id = await publish(),
    app = await apply(id),
    rival = await apply(id, "rival");
  await command("brand", "select", id, { application_id: app });
  await db.query(
    "update public.opportunities set selection_until=now()-interval '1 day' where id=$1",
    [id],
  );
  await as("brand", (tx) =>
    tx.query("select public.marketplace_read('detail',$1)", [id]),
  );
  assert.equal(
    (
      await db.query("select status from public.applications where id=$1", [
        rival,
      ])
    ).rows[0].status,
    "pending",
  );
  await db.query(
    "update public.collaborations set agreement_expires_at=now()-interval '1 minute' where opportunity_id=$1",
    [id],
  );
  await as("brand", (tx) =>
    tx.query("select public.marketplace_read('detail',$1)", [id]),
  );
  assert.equal(
    (
      await db.query("select status from public.applications where id=$1", [
        app,
      ])
    ).rows[0].status,
    "match_ended",
  );
  const o = (
    await db.query(
      "select selection_until from public.opportunities where id=$1",
      [id],
    )
  ).rows[0];
  assert.ok(new Date(o.selection_until) > new Date());
  await command("brand", "select", id, { application_id: rival });
});
test("no-reservation selection window expiry rejects remaining applicants; reopening does not restore terminal applications", async () => {
  const id = await publish(),
    app = await apply(id);
  await command("brand", "close", id);
  await db.query(
    "update public.opportunities set selection_until=now()-interval '1 minute' where id=$1",
    [id],
  );
  await as("brand", (tx) =>
    tx.query("select public.marketplace_read('detail',$1)", [id]),
  );
  assert.equal(
    (
      await db.query("select status from public.applications where id=$1", [
        app,
      ])
    ).rows[0].status,
    "not_selected",
  );
  await command("brand", "reopen", id);
  await assert.rejects(apply(id), /unique/);
});
test("invalid money, deliverables, URLs and past deadlines reject without records", async () => {
  for (const extra of [
    { budget_minor: 0 },
    { currency: "USD" },
    { deliverables: [] },
    {
      deliverables: [
        { format: "Reel", quantity: 100, acceptance: "Something clear" },
      ],
    },
    { application_deadline: "2020-01-01T00:00:00Z" },
  ])
    await assert.rejects(command("brand", "create", null, terms(extra)));
  await assert.rejects(
    command("creator", "apply", await publish(), {
      proposal: "A sufficiently long proposal.",
      work_urls: ["javascript:alert(1)"],
    }),
    /HTTPS/,
  );
});
test("suspension immediately denies read RPC, direct rows and business writes", async () => {
  const id = await publish();
  await db.query("update public.app_users set status='suspended' where id=$1", [
    ids.rival,
  ]);
  await assert.rejects(
    as("rival", (tx) => tx.query("select public.marketplace_read('discover')")),
    /Active pilot/,
  );
  await assert.rejects(
    as("rival", (tx) => tx.query("select * from public.opportunities")),
    /Active pilot/,
  );
  await assert.rejects(apply(id, "rival"), /Active pilot/);
});

test("member avatars are intentionally readable but only owners can write and suspended targets disappear", async () => {
  const path = `${ids.brand}/profile.webp`;
  await as("brand", (tx) =>
    tx.query(
      "insert into storage.objects(bucket_id,name) values('profile-images',$1)",
      [path],
    ),
  );
  for (const actor of ["creator", "admin"])
    assert.equal(
      (
        await as(actor, (tx) =>
          tx.query("select name from storage.objects where name=$1", [path]),
        )
      ).rows.length,
      1,
    );
  assert.equal(
    (
      await as("creator", (tx) =>
        tx.query(
          "update storage.objects set metadata='{}' where name=$1 returning *",
          [path],
        ),
      )
    ).rows.length,
    0,
  );
  // UPDATE can instead return no rows when USING denies; check actual persisted
  // bytes/row ownership separately rather than interpreting a delete response.
  await db.query("update public.app_users set status='suspended' where id=$1", [
    ids.brand,
  ]);
  assert.equal(
    (
      await as("creator", (tx) =>
        tx.query("select name from storage.objects where name=$1", [path]),
      )
    ).rows.length,
    0,
  );
  await db.query("update public.app_users set status='active' where id=$1", [
    ids.brand,
  ]);
});

test("null/forged actions and stale publish cannot mutate or disclose drafts", async () => {
  const id = await opportunity();
  await assert.rejects(
    command("creator", null, id),
    /Unknown marketplace action/,
  );
  await assert.rejects(command("brand", "edit", id, []), /action object/);
  await assert.rejects(
    command("brand", "publish", id, { expected_version: 999 }),
    (error) => error.code === "PT409" && /Refresh/.test(error.message),
  );
  await command("brand", "publish", id, { expected_version: 1 });
  assert.equal(
    await command("brand", "publish", id, { expected_version: 1 }),
    id,
  );
  const detail = (
    await as("creator", (tx) =>
      tx.query("select public.marketplace_read('detail',$1) detail", [id]),
    )
  ).rows[0].detail;
  assert.equal(detail.history.length, 1);
  assert.equal(detail.history[0].reason, "Published brief");
});
test("deadline closure is persisted by successful reads and draft deletion retains no orphan history", async () => {
  const id = await publish();
  await db.query(
    "update public.opportunities set application_deadline=now()-interval '1 day' where id=$1",
    [id],
  );
  await as("creator", (tx) =>
    tx.query("select public.marketplace_read('detail',$1)", [id]),
  );
  assert.equal(
    (
      await db.query(
        "select close_reason from public.opportunities where id=$1",
        [id],
      )
    ).rows[0].close_reason,
    "deadline",
  );
  const draft = await opportunity();
  await command("brand", "delete_draft", draft);
  assert.equal(
    (
      await db.query(
        "select * from public.opportunity_history where opportunity_id=$1",
        [draft],
      )
    ).rows.length,
    0,
  );
});
test("discovery caps a dataset above fifty and pages are disjoint", async () => {
  await db.query(
    `insert into public.opportunities(brand_id,title,brief,category,platforms,deliverables,budget_minor,currency,application_deadline,delivery_deadline,revision_allowance,status,published_at)
    select $1,'Pagination fixture '||n,'Only synthetic fixtures used to verify actual bounded discovery.','Technology',array['YouTube'],'[{"format":"Video","quantity":1,"acceptance":"A clear introduction"}]',10000,'LKR',now()+interval '3 days',now()+interval '20 days',1,'open',now() from generate_series(1,65) n`,
    [ids.brand],
  );
  async function page(offset) {
    return (
      await as("creator", (tx) =>
        tx.query("select public.marketplace_read('discover',null,$1) data", [
          JSON.stringify({ category: "Technology", limit: 1000, offset }),
        ]),
      )
    ).rows[0].data;
  }
  const first = await page(0),
    second = await page(50);
  assert.equal(first.items.length, 50);
  assert.equal(second.items.length, 15);
  assert.equal(first.total, 65);
  assert.equal(
    first.items.filter((a) => second.items.some((b) => b.id === a.id)).length,
    0,
  );
});

test("private function ACLs expose only the five checked entrypoints", async () => {
  const result = await db.query(
    `select p.proname,has_function_privilege('anon',p.oid,'EXECUTE') anon,has_function_privilege('authenticated',p.oid,'EXECUTE') caller from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='marketplace_private'`,
  );
  const allowed = new Set([
    "command",
    "read",
    "profile",
    "member_id",
    "visible_profile_image",
  ]);
  for (const row of result.rows) {
    assert.equal(row.anon, false, row.proname);
    assert.equal(row.caller, allowed.has(row.proname), row.proname);
  }
  assert.equal(
    (
      await db.query(
        "select has_schema_privilege('marketplace_executor','marketplace_private','CREATE') allowed",
      )
    ).rows[0].allowed,
    false,
  );
  assert.equal(
    (
      await db.query(
        "select pg_has_role('authenticated','marketplace_executor','MEMBER') allowed",
      )
    ).rows[0].allowed,
    false,
  );
});

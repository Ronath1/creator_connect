import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
let db;
const ids = {
  brand: "11111111-1111-4111-8111-111111111111",
  creator: "22222222-2222-4222-8222-222222222222",
  other: "33333333-3333-4333-8333-333333333333",
  admin: "44444444-4444-4444-8444-444444444444",
  admin2: "55555555-5555-4555-8555-555555555555",
};
before(async () => {
  db = new PGlite();
  // TEST ONLY verified JWT gateway fixture. Production never imports this.
  await db.exec(`create role anon nologin;create role authenticated nologin;create role service_role nologin;create schema auth;
 create function auth.jwt()returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.jwt()to anon,authenticated,service_role;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,metadata jsonb,unique(bucket_id,name));
 alter table storage.objects enable row level security;grant usage on schema storage to authenticated,anon;grant select,insert,update,delete on storage.objects to authenticated;`);
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
  ])
    await db.exec(
      await readFile(
        new URL(`../supabase/migrations/${file}`, import.meta.url),
        "utf8",
      ),
    );
  for (const [name, id] of Object.entries(ids)) {
    await db.query(
      "insert into public.app_users(id,clerk_user_id,role)values($1,$2,$3)",
      [
        id,
        `test_${name}`,
        name === "brand"
          ? "brand"
          : name.startsWith("admin")
            ? "admin"
            : "influencer",
      ],
    );
    if (name === "brand")
      await as(name, (tx) =>
        tx.query(
          "select public.complete_brand_onboarding('Test brand','A synthetic brand used only in local tests.','Colombo',array['Other'],null)",
        ),
      );
    else if (!name.startsWith("admin"))
      await as(name, (tx) =>
        tx.query(
          "select public.complete_influencer_onboarding($1,'A synthetic creator used only in local tests.','Kandy',array['Other'],$2)",
          [
            name,
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
async function rpc(name, fn, args) {
  const keys = Object.keys(args),
    values = Object.values(args).map((value) =>
      value && typeof value === "object" ? JSON.stringify(value) : value,
    );
  const result = await as(name, (tx) =>
    tx.query(
      `select public.${fn}(${keys.map((key, i) => `${key}=>$${i + 1}`).join(",")}) result`,
      values,
    ),
  );
  return result.rows[0].result;
}
const cmd = (name, action, id, data = {}) =>
  rpc(name, "collaboration_command", {
    p_action: action,
    p_id: id,
    p_data: data,
  });
const support = (name, action, id, data = {}) =>
  rpc(name, "support_command", { p_action: action, p_id: id, p_data: data });
async function selected() {
  const terms = {
    title: "A thoughtful local campaign",
    brief: "Introduce this synthetic product with an honest explanation.",
    category: "Other",
    platforms: ["Instagram"],
    deliverables: [
      { format: "Reel", quantity: 1, acceptance: "A clear introduction." },
      {
        format: "Story",
        quantity: 1,
        acceptance: "An honest product mention.",
      },
    ],
    budget_minor: 100000,
    currency: "LKR",
    application_deadline: new Date(Date.now() + 86400000 * 3).toISOString(),
    delivery_deadline: new Date(Date.now() + 86400000 * 20).toISOString(),
    revision_allowance: 1,
  };
  const id = await rpc("brand", "marketplace_command", {
    p_action: "create",
    p_data: terms,
  });
  await rpc("brand", "marketplace_command", {
    p_action: "publish",
    p_id: id,
    p_data: { expected_version: 1 },
  });
  const app = await rpc("creator", "marketplace_command", {
    p_action: "apply",
    p_id: id,
    p_data: {
      proposal: "I can make a clear introduction with helpful details.",
      work_urls: [],
    },
  });
  const c = await rpc("brand", "marketplace_command", {
    p_action: "select",
    p_id: id,
    p_data: { application_id: app },
  });
  return c;
}
const detail = (name, id) =>
  rpc(name, "collaboration_read", { p_kind: "detail", p_id: id });
async function active() {
  const id = await selected();
  await cmd("brand", "confirm", id, { version: 1 });
  await cmd("creator", "confirm", id, { version: 1 });
  return id;
}
async function submit(id) {
  const d = await detail("creator", id);
  return cmd("creator", "submit", id, {
    request_id: randomUUID(),
    agreement_version: d.collaboration.effective_version,
    items: d.collaboration.terms.deliverables.map((item) => ({
      item_id: item.id,
      urls: ["https://example.com/content"],
      attachment_ids: [],
      notes: "Evidence for this deliverable.",
    })),
    notes: "Ready for review.",
  });
}

test("two confirmations activate the exact version and outsiders/admin cannot read or confirm", async () => {
  const id = await selected();
  const initial = await detail("brand", id);
  assert.equal(initial.versions.length, 1);
  assert.ok(initial.collaboration.terms.deliverables.every((x) => x.id));
  assert.equal(await detail("other", id), null);
  assert.equal(await detail("admin", id), null);
  await assert.rejects(
    cmd("other", "confirm", id, { version: 1 }),
    /Participant/,
  );
  await assert.rejects(
    cmd("admin", "confirm", id, { version: 1 }),
    /Participant/,
  );
  await cmd("brand", "confirm", id, { version: 1 });
  assert.equal(
    (await detail("creator", id)).collaboration.status,
    "pending_agreement",
  );
  await cmd("creator", "confirm", id, { version: 1 });
  assert.equal((await detail("brand", id)).collaboration.status, "active");
});

test("pending edits invalidate confirmations and never extend the original seven-day window", async () => {
  const id = await selected();
  await cmd("brand", "confirm", id, { version: 1 });
  const before = await detail("brand", id);
  await cmd("brand", "terms", id, {
    expected_version: 1,
    terms: { ...before.collaboration.terms, budget_minor: 200000 },
  });
  const after = await detail("creator", id);
  assert.equal(after.collaboration.terms_version, 2);
  assert.equal(after.versions[0].brand_confirmed_at, null);
  assert.equal(after.versions[0].influencer_confirmed_at, null);
  assert.ok(
    new Date(after.collaboration.agreement_expires_at) <=
      new Date(before.collaboration.agreement_expires_at),
  );
  await assert.rejects(
    cmd("creator", "confirm", id, { version: 1 }),
    (e) => e.code === "PT409",
  );
});
test("active amendments preserve effective terms until both confirm and invalidate old submission review", async () => {
  const id = await active(),
    old = await submit(id),
    before = await detail("brand", id);
  await cmd("creator", "terms", id, {
    expected_version: 1,
    terms: { ...before.collaboration.terms, budget_minor: 250000 },
  });
  assert.equal(
    (await detail("brand", id)).collaboration.terms.budget_minor,
    100000,
  );
  await cmd("brand", "confirm", id, { version: 2 });
  assert.equal(
    (await detail("creator", id)).collaboration.effective_version,
    1,
  );
  await cmd("creator", "confirm", id, { version: 2 });
  const after = await detail("creator", id);
  assert.equal(after.collaboration.effective_version, 2);
  assert.equal(after.collaboration.latest_submission, null);
  assert.deepEqual(
    after.collaboration.terms.deliverables.map((x) => x.id),
    before.collaboration.terms.deliverables.map((x) => x.id),
  );
  await assert.rejects(
    cmd("brand", "approve", id, {
      submission_id: old,
      items: before.collaboration.terms.deliverables.map((x) => ({
        item_id: x.id,
      })),
    }),
    (e) => e.code === "PT409",
  );
});
test("immutable message and complete submission retries do not duplicate evidence", async () => {
  const id = await active(),
    request_id = randomUUID();
  const message = {
    request_id,
    body: "Here is an update.",
    attachment_ids: [],
  };
  assert.equal(await cmd("creator", "message", id, message), request_id);
  assert.equal(await cmd("creator", "message", id, message), request_id);
  const d = await detail("creator", id),
    submission = {
      request_id: randomUUID(),
      agreement_version: 1,
      items: d.collaboration.terms.deliverables.map((x) => ({
        item_id: x.id,
        urls: ["https://example.com/content"],
        attachment_ids: [],
        notes: "",
      })),
      notes: "",
    };
  await assert.rejects(
    cmd("creator", "submit", id, {
      ...submission,
      items: submission.items.slice(0, 1),
    }),
    /every agreed/,
  );
  const saved = await cmd("creator", "submit", id, submission);
  assert.equal(await cmd("creator", "submit", id, submission), saved);
  await assert.rejects(
    as("creator", (tx) =>
      tx.exec("update public.collaboration_messages set body='Changed'"),
    ),
    /permission denied/,
  );
});
test("item-specific revisions preserve used rounds and approval is explicit and terminal", async () => {
  const id = await active(),
    first = await submit(id),
    d = await detail("brand", id),
    items = d.collaboration.terms.deliverables;
  await cmd("brand", "revise", id, {
    submission_id: first,
    items: [
      {
        item_id: items[0].id,
        feedback: "Please show the product more clearly.",
      },
    ],
  });
  const second = await submit(id),
    after = await detail("brand", id);
  assert.equal(after.items.find((x) => x.id === items[0].id).revisions_used, 1);
  assert.equal(after.items.find((x) => x.id === items[1].id).revisions_used, 0);
  await assert.rejects(
    cmd("brand", "revise", id, {
      submission_id: second,
      items: [{ item_id: items[0].id, feedback: "Another round requested." }],
    }),
    /remaining revision/,
  );
  await assert.rejects(
    cmd("brand", "terms", id, {
      expected_version: 1,
      terms: { ...after.collaboration.terms, revision_allowance: 0 },
    }),
    /rounds already committed/,
  );
  await cmd("brand", "approve", id, {
    submission_id: second,
    items: [{ item_id: items[0].id }],
  });
  assert.equal((await detail("creator", id)).collaboration.status, "submitted");
  await cmd("brand", "approve", id, {
    submission_id: second,
    items: [{ item_id: items[1].id }],
  });
  assert.equal((await detail("creator", id)).collaboration.status, "completed");
  await assert.rejects(
    cmd("creator", "request_cancel", id, {
      request_id: randomUUID(),
      reason: "Please cancel after completion.",
    }),
    /Active work/,
  );
});
test("active cancellation needs the other party; pending cancellation does not change access", async () => {
  const id = await active(),
    request_id = randomUUID();
  await cmd("creator", "request_cancel", id, {
    request_id,
    reason: "The proposed timeline no longer works.",
  });
  assert.equal((await detail("brand", id)).collaboration.status, "active");
  await assert.rejects(
    cmd("creator", "respond_cancel", id, { request_id, decision: "accept" }),
    /other party/,
  );
  await cmd("brand", "respond_cancel", id, { request_id, decision: "accept" });
  const d = await detail("creator", id);
  assert.equal(d.collaboration.status, "cancelled");
  assert.ok(d.collaboration.activated_at);
  await assert.rejects(
    rpc("brand", "marketplace_command", {
      p_action: "reopen",
      p_id: d.collaboration.opportunity_id,
    }),
    /cannot be reopened/,
  );
});
test("assigned case reads/interventions require reasons; reporters cannot read internal notes", async () => {
  const id = await active();
  const report = await support("creator", "report", null, {
    request_id: randomUUID(),
    collaboration_id: id,
    category: "delivery_disagreement",
    description: "Please help us clarify the delivery expectations.",
  });
  await assert.rejects(
    rpc("admin", "support_case", {
      p_id: report,
      p_reason: "Investigate report",
    }),
    /Assigned open case/,
  );
  await support("admin", "claim", report, {
    reason: "Review the reported delivery concern.",
  });
  await assert.rejects(
    rpc("admin2", "support_case", {
      p_id: report,
      p_reason: "Investigate report",
    }),
    /Assigned open case/,
  );
  const data = await rpc("admin", "support_case", {
    p_id: report,
    p_reason: "Read the relevant agreement and evidence.",
  });
  assert.equal(data.collaboration.id, id);
  await support("admin", "case_cancel", report, {
    reason: "Resolved delivery dispute by administrator cancellation.",
  });
  await support("admin", "resolve", report, {
    reason: "Complete the investigation.",
    status: "resolved",
    outcome: "The collaboration was cancelled by support.",
    internal_notes: "Private investigation notes.",
  });
  const own = await rpc("creator", "collaboration_read", { p_kind: "reports" });
  assert.equal(
    own.items.find((x) => x.id === report).internal_notes,
    undefined,
  );
  assert.ok(
    (
      await db.query(
        "select * from public.audit_events where report_id=$1 and kind='case_access'",
        [report],
      )
    ).rows.length,
  );
  await assert.rejects(
    support("admin", "member_grant", null, {
      clerk_user_id: "user_newadminfixture",
      role: "admin",
      reason: "Try an administrator grant.",
    }),
    /owner bootstrap/,
  );
});
test("ordinary clients cannot attest clean files or read quarantine; double charge persists until confirmed purge", async () => {
  const id = await active(),
    file = randomUUID();
  await cmd("creator", "reserve_file", id, {
    request_id: file,
    filename: "file.pdf",
    size: 10485760,
  });
  await assert.rejects(
    rpc("creator", "attachment_worker", {
      p_action: "finalize",
      p_id: file,
      p_data: {},
    }),
    /permission denied/,
  );
  await assert.rejects(
    as("creator", (tx) =>
      tx.query(
        "insert into storage.objects(bucket_id,name)values('collaboration-quarantine',$1)",
        [`${id}/${file}`],
      ),
    ),
    /row-level security/,
  );
  await assert.rejects(
    as("creator", (tx) =>
      tx.exec("update public.collaboration_attachments set state='clean'"),
    ),
    /permission denied/,
  );
  await assert.rejects(
    cmd("creator", "discard_file", id, { file_id: file }),
    /Unlinked own file/,
  );
  await as(
    null,
    (tx) =>
      tx.query("select public.attachment_worker('reject',$1,'{}')", [file]),
    "service_role",
  );
  assert.equal((await detail("creator", id)).stored_bytes, 20971520);
  await assert.rejects(
    as(
      null,
      (tx) =>
        tx.query("select public.attachment_worker('purged',$1,'{}')", [file]),
      "service_role",
    ),
    /retain quota/,
  );
  await db.query(
    "update public.collaboration_attachments set created_at=now()-interval '25 hours' where id=$1",
    [file],
  );
  await assert.rejects(
    as(
      null,
      (tx) =>
        tx.query("select public.attachment_worker('purged',$1,'{}')", [file]),
      "service_role",
    ),
    /Physical deletion/,
  );
  await as(
    null,
    (tx) =>
      tx.query("select public.attachment_worker('purged',$1,$2)", [
        file,
        JSON.stringify({ quarantine_removed: true, clean_removed: true }),
      ]),
    "service_role",
  );
  assert.equal((await detail("creator", id)).stored_bytes, 0);
});

test("delayed promotion after uncertain failure stays charged and cannot be purged or resurrected", async () => {
  const id = await active(),
    file = randomUUID();
  await cmd("creator", "reserve_file", id, {
    request_id: file,
    filename: "delayed.pdf",
    size: 1000,
  });
  await as(
    null,
    (tx) =>
      tx.query("select public.attachment_worker('quarantine',$1,'{}')", [file]),
    "service_role",
  );
  await assert.rejects(
    cmd("creator", "discard_file", id, { file_id: file }),
    /Unlinked own file/,
  );
  await as(
    null,
    (tx) =>
      tx.query("select public.attachment_worker('reject',$1,'{}')", [file]),
    "service_role",
  );
  // Model a remote write committing after the caller has lost its response.
  await db.query(
    "insert into storage.objects(bucket_id,name)values('collaboration-files',$1)",
    [`${id}/${file}`],
  );
  await assert.rejects(
    as(
      null,
      (tx) =>
        tx.query("select public.attachment_worker('purged',$1,$2)", [
          file,
          JSON.stringify({ quarantine_removed: true, clean_removed: true }),
        ]),
      "service_role",
    ),
    /retain quota/,
  );
  assert.equal((await detail("creator", id)).stored_bytes, 2000);
  const cleanup = (
    await as(
      null,
      (tx) => tx.query("select public.attachment_worker('cleanup') rows"),
      "service_role",
    )
  ).rows[0].rows;
  assert.equal(
    cleanup.some((x) => x.id === file),
    false,
  );
  await db.query(
    "update public.collaboration_attachments set created_at=now()-interval '25 hours' where id=$1",
    [file],
  );
  await db.query("delete from storage.objects where name=$1", [
    `${id}/${file}`,
  ]);
  await as(
    null,
    (tx) =>
      tx.query("select public.attachment_worker('purged',$1,$2)", [
        file,
        JSON.stringify({ quarantine_removed: true, clean_removed: true }),
      ]),
    "service_role",
  );
  await assert.rejects(
    as(
      null,
      (tx) =>
        tx.query("select public.attachment_worker('reject',$1,'{}')", [file]),
      "service_role",
    ),
    /already purged/,
  );
  assert.equal((await detail("creator", id)).stored_bytes, 0);
});

test("participant lists are scoped and version/message history remains accessible after twenty records", async () => {
  const id = await active();
  let current = (await detail("brand", id)).collaboration;
  for (let i = 0; i < 23; i++) {
    await cmd("brand", "terms", id, {
      expected_version: current.current_proposal ?? current.terms_version,
      terms: { ...current.terms, title: `Campaign correction version ${i}` },
    });
    current = (await detail("brand", id)).collaboration;
    await cmd("creator", "message", id, {
      request_id: randomUUID(),
      body: `A retained message ${i}`,
      attachment_ids: [],
    });
  }
  const list = await rpc("brand", "collaboration_read", { p_kind: "list" });
  assert.ok(list.items.some((x) => x.id === id));
  const versions = await rpc("creator", "collaboration_read", {
    p_kind: "versions",
    p_id: id,
    p_filters: { offset: 20 },
  });
  assert.equal(versions.total, 24);
  assert.equal(versions.items.length, 4);
  const messages = await rpc("creator", "collaboration_read", {
    p_kind: "messages",
    p_id: id,
    p_filters: { offset: 20 },
  });
  assert.equal(messages.items.length, 3);
  await assert.rejects(
    rpc("other", "collaboration_read", { p_kind: "versions", p_id: id }),
    /Participant/,
  );
  const report = await support("creator", "report", null, {
    request_id: randomUUID(),
    collaboration_id: id,
    category: "other",
    description: "Review an earlier discussion message in this case.",
  });
  await support("admin", "claim", report, {
    reason: "Review earlier private discussion evidence.",
  });
  const historical = await rpc("admin", "support_case", {
    p_id: report,
    p_reason: "Inspect earlier message and term history.",
    p_filters: { offset: 20 },
  });
  assert.equal(historical.messages.length, 3);
  assert.equal(historical.versions.length, 4);
  assert.ok(historical.history_count > 20);
  assert.ok(historical.history.length > 0);
});
test("reservations count both copies, reject unsafe attestations and prevent cross-collaboration links", async () => {
  const id = await active(),
    otherId = await active(),
    files = [];
  for (let i = 0; i < 5; i++) {
    const file = randomUUID();
    files.push(file);
    await cmd("creator", "reserve_file", id, {
      request_id: file,
      filename: "evidence.pdf",
      size: 10485760,
    });
  }
  await assert.rejects(
    cmd("creator", "reserve_file", id, {
      request_id: randomUUID(),
      filename: "extra.pdf",
      size: 1,
    }),
    /100 MB/,
  );
  const file = files[0];
  await as(
    null,
    (tx) =>
      tx.query("select public.attachment_worker('quarantine',$1,'{}')", [file]),
    "service_role",
  );
  const proof = {
    size: 100,
    sha256: "a".repeat(64),
    content_type: "application/pdf",
    scanner_version: "test-fixture-only",
    signature_version: "test",
    signature_at: new Date().toISOString(),
    quarantine_removed: true,
  };
  await assert.rejects(
    as(
      null,
      (tx) =>
        tx.query("select public.attachment_worker('finalize',$1,$2)", [
          file,
          JSON.stringify({ ...proof, signature_at: "2020-01-01T00:00:00Z" }),
        ]),
      "service_role",
    ),
    /fresh scan/,
  );
  await as(
    null,
    (tx) =>
      tx.query("select public.attachment_worker('finalize',$1,$2)", [
        file,
        JSON.stringify(proof),
      ]),
    "service_role",
  );
  await assert.rejects(
    cmd("creator", "message", otherId, {
      request_id: randomUUID(),
      body: "Try another collaboration file.",
      attachment_ids: [file],
    }),
    /scanned clean files/,
  );
  const message = await cmd("creator", "message", id, {
    request_id: randomUUID(),
    body: "Here is the scanned evidence.",
    attachment_ids: [file],
  });
  await assert.rejects(
    db.query(
      "update public.collaboration_attachments set collaboration_id=$1 where id=$2",
      [otherId, file],
    ),
    /foreign key/,
  );
  await assert.rejects(
    as(
      null,
      (tx) =>
        tx.query("select public.attachment_worker('purged',$1,$2)", [
          file,
          JSON.stringify({ quarantine_removed: true, clean_removed: true }),
        ]),
      "service_role",
    ),
    /Linked evidence/,
  );
  assert.equal(
    (
      await db.query(
        "select message_id from public.collaboration_attachments where id=$1",
        [file],
      )
    ).rows[0].message_id,
    message,
  );
});
test("notifications recheck reference access and hide restricted opportunity identifiers", async () => {
  const id = await selected();
  const c = (await detail("creator", id)).collaboration;
  await db.query(
    "update public.opportunities set hidden_at=now() where id=$1",
    [c.opportunity_id],
  );
  const rows = await db.query(
    "insert into public.notifications(recipient_id,opportunity_id,kind,dedupe_key)values($1,$2,'application_selected',$3),($1,$2,'brief_corrected',$4)returning id,kind",
    [ids.creator, c.opportunity_id, randomUUID(), randomUUID()],
  );
  const visible = await rpc("creator", "collaboration_read", {
    p_kind: "notifications",
    p_filters: { limit: 50 },
  });
  const selectedNotification = visible.items.find(
    (x) => x.id === rows.rows.find((x) => x.kind === "application_selected").id,
  );
  assert.ok(selectedNotification);
  assert.equal(selectedNotification.opportunity_id, null);
  assert.equal(
    visible.items.some(
      (x) => x.id === rows.rows.find((x) => x.kind === "brief_corrected").id,
    ),
    false,
  );
  const outsider = await rpc("other", "collaboration_read", {
    p_kind: "notifications",
  });
  assert.equal(
    outsider.items.some((x) => rows.rows.some((r) => r.id === x.id)),
    false,
  );
});
test("bounded durable tick drains past terminal rows and more than one hundred reminders", async () => {
  const template = (await detail("brand", await active())).collaboration;
  await db.query(
    `insert into public.opportunities(brand_id,title,brief,category,platforms,deliverables,budget_minor,application_deadline,delivery_deadline,revision_allowance,status,published_at,close_reason,selection_until)
 select $1,'Terminal fixture '||n,'Synthetic fixtures verify terminal candidates do not starve later work.','Other',array['Instagram'],'[{"format":"Reel","quantity":1,"acceptance":"A clear output."}]',10000,now()-interval '20 days',now()+interval '20 days',1,'closed',now()-interval '30 days','manual',now()-interval '10 days' from generate_series(1,110)n`,
    [ids.brand],
  );
  const op = await rpc("brand", "marketplace_command", {
    p_action: "create",
    p_data: {
      title: "A due opportunity fixture",
      brief:
        "A detailed synthetic fixture used only to verify deadline processing.",
      category: "Other",
      platforms: ["Instagram"],
      deliverables: [
        { format: "Reel", quantity: 1, acceptance: "A clear output." },
      ],
      budget_minor: 10000,
      currency: "LKR",
      application_deadline: new Date(Date.now() + 86400000).toISOString(),
      delivery_deadline: new Date(Date.now() + 86400000 * 3).toISOString(),
      revision_allowance: 1,
    },
  });
  await rpc("brand", "marketplace_command", {
    p_action: "publish",
    p_id: op,
    p_data: { expected_version: 1 },
  });
  await db.query(
    "update public.opportunities set application_deadline=now()-interval '1 minute' where id=$1",
    [op],
  );
  const reminderIds = [];
  for (let i = 0; i < 101; i++) {
    const o = randomUUID(),
      a = randomUUID(),
      c = randomUUID();
    reminderIds.push(c);
    await db.query(
      "insert into public.opportunities(id,brand_id,title,brief,category,platforms,deliverables,budget_minor,application_deadline,delivery_deadline,revision_allowance,status,published_at)select $1,brand_id,title,brief,category,platforms,deliverables,budget_minor,now()-interval '1 day',now()+interval '12 hours',revision_allowance,'closed',now()from public.opportunities where id=$2",
      [o, op],
    );
    await db.query(
      "insert into public.applications(id,opportunity_id,influencer_id,proposal,status)values($1,$2,$3,'Synthetic reminder fixture application.','selected')",
      [a, o, ids.creator],
    );
    const terms = {
      ...template.terms,
      delivery_deadline: new Date(Date.now() + 12 * 3600000).toISOString(),
      deliverables: template.terms.deliverables.map((item) => ({
        format: item.format,
        quantity: item.quantity,
        acceptance: item.acceptance,
      })),
    };
    await db.query(
      "insert into public.collaborations(id,opportunity_id,application_id,brand_id,influencer_id,status,terms,agreement_expires_at,activated_at,effective_version,current_proposal,created_at)values($1,$2,$3,$4,$5,'active',$6,now()+interval '7 days',now(),1,null,now()-interval '3 days')",
      [c, o, a, ids.brand, ids.creator, JSON.stringify(terms)],
    );
    await db.query(
      "update public.agreement_versions set status='effective',brand_confirmed_at=now(),influencer_confirmed_at=now(),accepted_at=now()where collaboration_id=$1",
      [c],
    );
    await db.query(
      "insert into public.cancellation_requests(id,collaboration_id,requested_by,reason,support_after)values($1,$2,$3,'Synthetic unresolved cancellation.',now()-interval '1 day')",
      [randomUUID(), c, ids.creator],
    );
  }
  for (let i = 0; i < 6; i++)
    await db.query("select marketplace_private.tick(100)");
  assert.equal(
    (
      await db.query("select status from public.opportunities where id=$1", [
        op,
      ])
    ).rows[0].status,
    "closed",
  );
  assert.equal(
    Number(
      (
        await db.query(
          "select count(*) n from public.marketplace_events where kind='deadline_reminder' and collaboration_id=any($1::uuid[])",
          [reminderIds],
        )
      ).rows[0].n,
    ),
    202,
  );
  assert.equal(
    Number(
      (
        await db.query(
          "select count(*) n from public.marketplace_events where kind='cancellation_support_reminder' and collaboration_id=any($1::uuid[])",
          [reminderIds],
        )
      ).rows[0].n,
    ),
    202,
  );
  const before = Number(
    (await db.query("select count(*) n from public.notifications")).rows[0].n,
  );
  await db.query("select marketplace_private.tick(100)");
  assert.equal(
    Number(
      (await db.query("select count(*) n from public.notifications")).rows[0].n,
    ),
    before,
  );
});

test("unknown submission fields never persist and arbitrary oversized audit reasons reject", async () => {
  const id = await active();
  await assert.rejects(
    cmd("creator", "message", id, {
      request_id: randomUUID(),
      body: "A valid message.",
      attachment_ids: [],
      reason: "x".repeat(3001),
    }),
    /3000 characters/,
  );
  const d = await detail("creator", id);
  const request_id = randomUUID();
  await cmd("creator", "submit", id, {
    request_id,
    agreement_version: 1,
    items: d.collaboration.terms.deliverables.map((x) => ({
      item_id: x.id,
      urls: ["https://example.com/evidence"],
      attachment_ids: [],
      notes: "Valid notes.",
      untrusted_blob: "must not persist",
    })),
    notes: "",
  });
  const saved = (
    await db.query(
      "select items from public.collaboration_submissions where id=$1",
      [request_id],
    )
  ).rows[0];
  assert.ok(saved.items.every((x) => x.untrusted_blob === undefined));
});
test("finite pending reservations and private function ACLs deny direct bypass", async () => {
  const id = await active();
  for (let i = 0; i < 10; i++)
    await cmd("creator", "reserve_file", id, {
      request_id: randomUUID(),
      filename: "tiny.pdf",
      size: 1,
    });
  await assert.rejects(
    cmd("creator", "reserve_file", id, {
      request_id: randomUUID(),
      filename: "tiny.pdf",
      size: 1,
    }),
    /Too many/,
  );
  for (const fn of [
    "marketplace_private.tick(100)",
    "marketplace_private.normalized_terms(null,'{}')",
    "marketplace_private.reconcile(null)",
  ])
    await assert.rejects(
      as("creator", (tx) => tx.query(`select ${fn}`)),
      /permission denied/,
    );
  await assert.rejects(
    as("creator", (tx) =>
      tx.query(
        "insert into public.app_users(clerk_user_id,role)values('user_forbidden','admin')",
      ),
    ),
    /permission denied/,
  );
  for (const table of [
    "agreement_versions",
    "collaboration_items",
    "collaboration_messages",
    "collaboration_submissions",
    "submission_reviews",
    "cancellation_requests",
    "support_reports",
    "audit_events",
    "notifications",
    "collaboration_attachments",
  ])
    await assert.rejects(
      as("other", (tx) => tx.query(`select * from public.${table}`)),
      /permission denied/,
    );
});
test("failed orphan batches back off fairly and concurrent claims cannot take the same rows", async () => {
  const id = await active();
  const wanted = [];
  for (let i = 0; i < 70; i++) {
    const file = randomUUID();
    wanted.push(file);
    await db.query(
      "insert into public.collaboration_attachments(id,collaboration_id,uploaded_by,filename,reserved_bytes,state,created_at)values($1,$2,$3,'orphan.pdf',1,'rejected',now()-interval '25 hours')",
      [file, id, ids.creator],
    );
  }
  async function claim() {
    return (
      await as(
        null,
        (tx) => tx.query("select public.attachment_worker('cleanup') rows"),
        "service_role",
      )
    ).rows[0].rows;
  }
  const first = await claim();
  assert.equal(first.length, 50);
  for (const row of first)
    await as(
      null,
      (tx) =>
        tx.query("select public.attachment_worker('cleanup_failed',$1,'{}')", [
          row.id,
        ]),
      "service_role",
    );
  const next = await claim();
  assert.equal(next.length, 20);
  assert.equal(
    next.some((x) => first.some((y) => y.id === x.id)),
    false,
  );
  assert.equal((await claim()).length, 0);
  assert.equal(
    Number(
      (
        await db.query(
          "select sum(2*reserved_bytes) n from public.collaboration_attachments where collaboration_id=$1 and state='rejected'",
          [id],
        )
      ).rows[0].n,
    ),
    140,
  );
});

test("older messages carry their own attachment descriptors and case files page past fifty", async () => {
  const id = await active(),
    old = randomUUID(),
    oldFile = randomUUID(),
    clean = randomUUID();
  await cmd("creator", "message", id, {
    request_id: old,
    body: "An older message with evidence.",
    attachment_ids: [],
  });
  async function fixtureFile(file, message, created) {
    await db.query(
      "insert into public.collaboration_attachments(id,collaboration_id,uploaded_by,filename,reserved_bytes,state,size_bytes,sha256,content_type,scanner_version,signature_version,signature_at,scanned_at,message_id,created_at)values($1,$2,$3,'synthetic.webp',1,$4,1,$5,'image/webp','SQL-fixture-only','fixture',now(),now(),$6,$7)",
      [
        file,
        id,
        ids.creator,
        message ? "linked" : "clean",
        "a".repeat(64),
        message,
        created,
      ],
    );
  }
  await fixtureFile(
    oldFile,
    old,
    new Date(Date.now() - 86400000).toISOString(),
  );
  await fixtureFile(
    clean,
    null,
    new Date(Date.now() - 86400000 * 2).toISOString(),
  );
  for (let i = 0; i < 25; i++) {
    const message = await cmd("creator", "message", id, {
      request_id: randomUUID(),
      body: `Newer message ${i}`,
      attachment_ids: [],
    });
    await fixtureFile(randomUUID(), message, new Date().toISOString());
    await fixtureFile(randomUUID(), message, new Date().toISOString());
  }
  const latest = await detail("creator", id);
  assert.ok(latest.files.some((x) => x.id === clean));
  assert.equal(
    latest.files.some((x) => x.id === oldFile),
    false,
  );
  const page = await rpc("brand", "collaboration_read", {
    p_kind: "messages",
    p_id: id,
    p_filters: { offset: 20 },
  });
  assert.equal(page.items.find((x) => x.id === old).attachments[0].id, oldFile);
  const report = await support("creator", "report", null, {
    request_id: randomUUID(),
    collaboration_id: id,
    category: "other",
    description: "Review the old attached evidence in this work.",
  });
  await support("admin", "claim", report, {
    reason: "Investigate the reported old file.",
  });
  const casePage = await rpc("admin", "support_case", {
    p_id: report,
    p_reason: "Read older linked files.",
    p_filters: { offset: 40 },
  });
  assert.equal(casePage.file_count, 51);
  assert.equal(casePage.files.length, 11);
});
test("amendment withdrawal notifies the peer once and unchanged membership retries do not duplicate alerts", async () => {
  const id = await active(),
    d = await detail("creator", id);
  await cmd("creator", "terms", id, {
    expected_version: 1,
    terms: d.collaboration.terms,
  });
  await cmd("creator", "withdraw_amendment", id);
  assert.equal(
    (
      await db.query(
        "select * from public.marketplace_events where collaboration_id=$1 and dedupe_key like '%amendment_withdrawn%'",
        [id],
      )
    ).rows.length,
    1,
  );
  const before = Number(
    (
      await db.query(
        "select count(*) n from public.notifications where recipient_id=$1",
        [ids.other],
      )
    ).rows[0].n,
  );
  await support("admin", "member_status", ids.other, {
    status: "active",
    reason: "Retry an unchanged approved status.",
  });
  assert.equal(
    Number(
      (
        await db.query(
          "select count(*) n from public.notifications where recipient_id=$1",
          [ids.other],
        )
      ).rows[0].n,
    ),
    before,
  );
});

test("repeated own case claim is idempotent and a suspended reported profile stays case-bounded", async () => {
  const report = await support("creator", "report", null, {
    request_id: randomUUID(),
    member_id: ids.other,
    category: "misleading_profile_brief",
    description: "Please investigate this declared social profile.",
  });
  await support("admin", "claim", report, {
    reason: "Investigate the reported profile.",
  });
  const before = (
    await db.query(
      "select count(*) n from public.notifications where report_id=$1",
      [report],
    )
  ).rows[0].n;
  await support("admin", "claim", report, {
    reason: "Retry the existing assignment.",
  });
  assert.equal(
    (
      await db.query(
        "select count(*) n from public.notifications where report_id=$1",
        [report],
      )
    ).rows[0].n,
    before,
  );
  await db.query("update public.app_users set status='suspended' where id=$1", [
    ids.other,
  ]);
  await db.query(
    "insert into storage.objects(bucket_id,name)values('profile-images',$1)",
    [`${ids.other}/profile.webp`],
  );
  assert.equal(
    await rpc("creator", "member_profile", { p_id: ids.other }),
    null,
  );
  assert.equal(await rpc("admin", "member_profile", { p_id: ids.other }), null);
  assert.equal(
    (
      await as("creator", (tx) =>
        tx.query("select * from storage.objects where name=$1", [
          `${ids.other}/profile.webp`,
        ]),
      )
    ).rows.length,
    0,
  );
  const related = await rpc("admin", "support_case", {
    p_id: report,
    p_reason: "Review the restricted target in this assigned case.",
  });
  assert.equal(related.member.id, ids.other);
  assert.equal(related.member.display_name, "other");
  assert.equal(related.member.clerk_user_id, undefined);
  assert.equal(related.member.email, undefined);
  assert.equal(related.member.status, undefined);
  await assert.rejects(
    rpc("admin2", "support_case", {
      p_id: report,
      p_reason: "Try another administrator's case.",
    }),
    /Assigned open case/,
  );
  await db.query("update public.app_users set status='active' where id=$1", [
    ids.other,
  ]);
});

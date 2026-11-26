#!/usr/bin/env node
// Disposable TEST ONLY SQL/RLS diagnostic. Never imported by application code.
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";

const MIGRATIONS = [
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
];
const HELP = `Usage: npm run perf:sql -- [--samples 5]
  --samples N  Committed measured calls per operation, integer 1–20 (default 5)
  --help       Show usage before importing or starting PGlite

Creates only an in-memory disposable SQL database: no network, credentials,
.env, persistent database or existing DEV fixtures. Seeds 50 complete profiles,
100 opportunities, 500 applications, 50 active collaborations and 2000 messages.
Then samples four reads and three committed writes under TEST ONLY role/claims.
Output contains aggregate durations/counts/deltas/checks, not record IDs/content.
Single connection WASM SQL diagnostic; NOT real sessions, hosted/Next HTTP,
server-only p95, concurrent load or a production capacity result.
Exit 0=assertions passed; 1=diagnostic failed; 2=invalid arguments.
`;
const EXPECTED = {
  profiles: 50,
  opportunities: 100,
  applications: 500,
  collaborations: 50,
  messages: 2000,
};
function options(args) {
  if (args.length === 0) return 5;
  if (args.length !== 2 || args[0] !== "--samples" || !/^[0-9]+$/.test(args[1]))
    throw new Error("Use --samples with an integer from 1 to 20, or --help.");
  const n = Number(args[1]);
  if (!Number.isSafeInteger(n) || n < 1 || n > 20)
    throw new Error("Samples must be between 1 and 20.");
  return n;
}
class CheckFailure extends Error {
  constructor(label) {
    super("Diagnostic assertion failed.");
    this.label = label;
  }
}
function uuid(group, index) {
  return `80000000-${String(group).padStart(4, "0")}-4000-8000-${String(index).padStart(12, "0")}`;
}
function summary(times) {
  if (!times.length) return null;
  const sorted = [...times].sort((a, b) => a - b);
  const at = (q) =>
    Math.round(sorted[Math.max(0, Math.ceil(q * sorted.length) - 1)] * 100) /
    100;
  return { min: at(0), p50: at(0.5), p95: at(0.95), max: at(1) };
}

async function diagnostic(samples) {
  let db,
    phase = "schema";
  const checks = [],
    denials = [],
    operations = {};
  const time = () => performance.now(),
    round = (n) => Math.round(n * 100) / 100;
  const assert = (condition, label) => {
    if (!condition) throw new CheckFailure(label);
  };
  const checked = (condition, label) => {
    assert(condition, label);
    checks.push(label);
  };
  async function as(actor, fn, role = "authenticated") {
    assert(role === "authenticated" || role === "anon", "fixed_fixture_role");
    return db.transaction(async (tx) => {
      await tx.exec(`set local role ${role}`);
      await tx.query("select set_config('request.jwt.claims',$1,true)", [
        JSON.stringify(actor ? { sub: actor.sub } : {}),
      ]);
      return fn(tx);
    });
  }
  async function rpc(actor, sql, params, role = "authenticated") {
    return (await as(actor, (tx) => tx.query(sql, params), role)).rows[0]
      .result;
  }
  const market = (actor, action, id = null, data = {}) =>
    rpc(actor, "select public.marketplace_command($1,$2,$3) result", [
      action,
      id,
      JSON.stringify(data),
    ]);
  const collaboration = (actor, action, id, data = {}) =>
    rpc(actor, "select public.collaboration_command($1,$2,$3) result", [
      action,
      id,
      JSON.stringify(data),
    ]);
  const marketRead = (actor, kind, id = null, filters = {}) =>
    rpc(actor, "select public.marketplace_read($1,$2,$3) result", [
      kind,
      id,
      JSON.stringify(filters),
    ]);
  const collaborationRead = (actor, kind, id, filters = {}) =>
    rpc(actor, "select public.collaboration_read($1,$2,$3) result", [
      kind,
      id,
      JSON.stringify(filters),
    ]);
  async function denied(label, fn) {
    let error;
    try {
      await fn();
    } catch (caught) {
      error = caught;
    }
    assert(error?.code === "42501", label);
    denials.push(label);
  }
  async function measured(label, fn) {
    const group = (operations[label] ??= {
      durations: [],
      committed_calls: 0,
      errors: 0,
    });
    const begin = time();
    try {
      const result = await fn(); // includes transaction role/claim setup, RPC and commit
      group.durations.push(time() - begin);
      group.committed_calls++;
      return result;
    } catch (error) {
      group.errors++;
      throw error;
    }
  }
  async function counts() {
    return (
      await db.query(`select
      ((select count(*) from public.brand_profiles)+(select count(*) from public.influencer_profiles))::int profiles,
      (select count(*)::int from public.opportunities) opportunities,
      (select count(*)::int from public.applications) applications,
      (select count(*)::int from public.collaborations) collaborations,
      (select count(*)::int from public.collaboration_messages) messages`)
    ).rows[0];
  }
  try {
    const schemaStart = time();
    const { PGlite } = await import("@electric-sql/pglite");
    db = new PGlite(); // no dataDir: memory only, discarded on close
    // Synthetic verified-claim plumbing, NOT a Clerk JWT gateway or login mock
    // in the app. Minimal empty Storage catalogs only satisfy existing DDL.
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
    const digest = createHash("sha256");
    for (const file of MIGRATIONS) {
      const sql = await readFile(
        new URL(`../supabase/migrations/${file}`, import.meta.url),
        "utf8",
      );
      digest.update(file).update("\n").update(sql).update("\n");
      await db.exec(sql);
    }
    const schemaMs = time() - schemaStart;
    phase = "seed";
    const seedStart = time();
    const brands = Array.from({ length: 10 }, (_, i) => ({
      id: uuid(1, i + 1),
      sub: `scale_brand_${i + 1}`,
    }));
    const creators = Array.from({ length: 40 }, (_, i) => ({
      id: uuid(1, i + 11),
      sub: `scale_creator_${i + 1}`,
    }));
    // Sole privileged domain bootstrap: fixed synthetic membership rows.
    for (const [index, actor] of [...brands, ...creators].entries()) {
      const brand = index < 10;
      await db.query(
        "insert into public.app_users(id,clerk_user_id,role) values($1,$2,$3)",
        [actor.id, actor.sub, brand ? "brand" : "influencer"],
      );
      if (brand)
        await as(actor, (tx) =>
          tx.query(
            "select public.complete_brand_onboarding($1,$2,'Colombo',array['Other'],null)",
            [
              `Synthetic brand ${index + 1}`,
              "Synthetic scale diagnostic brand profile, not a real account.",
            ],
          ),
        );
      else
        await as(actor, (tx) =>
          tx.query(
            "select public.complete_influencer_onboarding($1,$2,'Kandy',array['Other'],$3)",
            [
              `Synthetic creator ${index - 9}`,
              "Synthetic scale diagnostic creator profile, not a real account.",
              JSON.stringify([
                {
                  platform: "Instagram",
                  url: `https://instagram.com/synthetic_scale_${index - 9}`,
                },
              ]),
            ],
          ),
        );
    }
    const anchor = Date.now(),
      opportunities = [],
      collaborations = [];
    for (let i = 0; i < 100; i++) {
      const brand = brands[i % 10],
        id = uuid(2, i + 1);
      const terms = {
        title: `Synthetic scale opportunity ${i + 1}`,
        brief:
          "A synthetic promotion brief used only in this disposable SQL diagnostic.",
        category: "Other",
        platforms: ["Instagram"],
        deliverables: [
          {
            format: "Reel",
            quantity: 1,
            acceptance: "A clear synthetic product introduction.",
          },
        ],
        budget_minor: 100000,
        currency: "LKR",
        application_deadline: new Date(anchor + 3 * 86400000).toISOString(),
        delivery_deadline: new Date(anchor + 20 * 86400000).toISOString(),
        revision_allowance: 1,
      };
      await market(brand, "create", id, terms);
      await market(brand, "publish", id, { expected_version: 1 });
      const applications = [];
      for (let j = 0; j < 5; j++) {
        const creator = creators[(i + j) % 40];
        applications.push({
          creator,
          id: await market(creator, "apply", id, {
            proposal:
              "I can create a clear synthetic promotion for this diagnostic.",
            work_urls: [],
          }),
        });
      }
      opportunities.push({ id, brand, applications });
    }
    for (let i = 0; i < 50; i++) {
      const opportunity = opportunities[i],
        chosen = opportunity.applications[0];
      const id = await market(opportunity.brand, "select", opportunity.id, {
        application_id: chosen.id,
      });
      await collaboration(opportunity.brand, "confirm", id, { version: 1 });
      await collaboration(chosen.creator, "confirm", id, { version: 1 });
      collaborations.push({
        id,
        brand: opportunity.brand,
        creator: chosen.creator,
      });
      for (let j = 0; j < 40; j++)
        await collaboration(chosen.creator, "message", id, {
          request_id: uuid(3, i * 40 + j + 1),
          body: "Synthetic message for the disposable scale dataset.",
          attachment_ids: [],
        });
    }
    const seedMs = time() - seedStart,
      initial = await counts();
    for (const key of Object.keys(EXPECTED))
      checked(initial[key] === EXPECTED[key], `canonical_${key}`);

    phase = "guards";
    const guardStart = time();
    const first = await marketRead(creators[0], "discover", null, {
      limit: 1000,
      offset: 0,
    });
    const second = await marketRead(creators[0], "discover", null, {
      limit: 1000,
      offset: 50,
    });
    checked(
      first.total === 100 &&
        first.items.length === 50 &&
        second.items.length === 50,
      "discovery_actual_fifty_cap",
    );
    checked(
      !first.items.some((a) => second.items.some((b) => a.id === b.id)),
      "discovery_disjoint_pages",
    );
    const ownerDetail = await marketRead(
      opportunities[75].brand,
      "detail",
      opportunities[75].id,
      { limit: 2 },
    );
    checked(
      ownerDetail.applications.length === 2 &&
        ownerDetail.application_count === 5,
      "owner_applicant_page_bound",
    );
    const ownApps = await marketRead(creators[0], "applications");
    checked(
      ownApps.items.length <= 20 &&
        ownApps.items.every((a) => a.influencer_id === creators[0].id),
      "application_owner_isolation",
    );
    const privateDetail = await marketRead(
      creators[0],
      "detail",
      opportunities[75].id,
    );
    checked(
      privateDetail.applications.length === 0,
      "competing_applications_hidden",
    );
    const c = collaborations[0];
    const messages = await collaborationRead(c.creator, "messages", c.id, {
      limit: 20,
    });
    checked(
      messages.items.length === 20 && messages.total === 40,
      "message_page_bound",
    );
    const otherMessages = await collaborationRead(c.creator, "messages", c.id, {
      limit: 20,
      offset: 20,
    });
    checked(
      !messages.items.some((a) =>
        otherMessages.items.some((b) => b.id === a.id),
      ),
      "message_disjoint_pages",
    );
    checked(
      (await collaborationRead(creators[1], "detail", c.id)) === null,
      "outsider_private_read_hidden",
    );
    await denied("anonymous_marketplace_denied", () =>
      rpc(
        null,
        "select public.marketplace_read('discover') result",
        [],
        "anon",
      ),
    );
    await denied("uninvited_marketplace_denied", () =>
      marketRead({ sub: "scale_uninvited" }, "discover"),
    );
    await denied("outsider_message_denied", () =>
      collaboration(creators[1], "message", c.id, {
        request_id: uuid(4, 999),
        body: "Must not be stored.",
        attachment_ids: [],
      }),
    );
    await denied("foreign_owner_status_denied", () =>
      market(brands[1], "close", opportunities[75].id, {
        reason: "Must not change another brand's record.",
      }),
    );
    await denied("raw_lifecycle_write_denied", () =>
      as(c.creator, (tx) =>
        tx.query("update public.collaborations set status='completed'"),
      ),
    );
    // Privileged fixture-only status toggle tests actual membership guards;
    // this is not a measured business operation or administrator UI proof.
    await db.query(
      "update public.app_users set status='suspended' where id=$1",
      [creators[39].id],
    );
    try {
      await denied("suspended_read_denied", () =>
        marketRead(creators[39], "discover"),
      );
      await denied("suspended_write_denied", () =>
        market(creators[39], "apply", opportunities[90].id, {
          proposal: "Must not store a suspended application.",
          work_urls: [],
        }),
      );
    } finally {
      await db.query(
        "update public.app_users set status='active' where id=$1",
        [creators[39].id],
      );
    }
    const guardMs = time() - guardStart;

    phase = "measure";
    const measureStart = time();
    for (let i = 0; i < samples; i++) {
      const discovery = await measured("discovery_read", () =>
        marketRead(creators[0], "discover", null, {
          limit: 20,
          offset: (i % 5) * 20,
        }),
      );
      assert(discovery.items.length === 20, "measured_discovery_bound");
      const detail = await measured("opportunity_detail_read", () =>
        marketRead(creators[0], "detail", opportunities[75].id),
      );
      assert(detail?.applications.length === 0, "measured_detail_privacy");
      const apps = await measured("own_applications_read", () =>
        marketRead(creators[0], "applications", null, { limit: 20 }),
      );
      assert(
        apps.items.length <= 20 &&
          apps.items.every((a) => a.influencer_id === creators[0].id),
        "measured_application_privacy",
      );
      const workspace = await measured("collaboration_detail_read", () =>
        collaborationRead(c.creator, "detail", c.id),
      );
      assert(
        workspace?.collaboration.id === c.id && workspace.messages.length <= 20,
        "measured_workspace_bound",
      );
      const opportunity = opportunities[50 + i],
        applicant = creators[(50 + i + 5) % 40];
      const applicationId = await measured("application_write", () =>
        market(applicant, "apply", opportunity.id, {
          proposal:
            "Additional synthetic measured application, later withdrawn.",
          work_urls: [],
        }),
      );
      await measured("application_withdraw_status_write", () =>
        market(applicant, "withdraw", opportunity.id, {
          application_id: applicationId,
        }),
      );
      await measured("message_write", () =>
        collaboration(c.creator, "message", c.id, {
          request_id: uuid(4, i + 1),
          body: "Additional committed measured synthetic message.",
          attachment_ids: [],
        }),
      );
    }
    const measureMs = time() - measureStart;
    phase = "verify";
    const verificationStart = time(),
      final = await counts();
    const expectedFinal = {
      ...EXPECTED,
      applications: 500 + samples,
      messages: 2000 + samples,
    };
    for (const key of Object.keys(expectedFinal))
      checked(final[key] === expectedFinal[key], `final_${key}`);
    const integrity = (
      await db.query(`select
      (select count(*)::int from public.app_users where status='active') active_members,
      (select count(*)::int from public.applications where status='withdrawn') withdrawn,
      (select count(*)::int from public.collaborations c join public.agreement_versions v on v.collaboration_id=c.id and v.version=c.effective_version
        where c.status='active' and c.activated_at is not null and v.status='effective' and v.brand_confirmed_at is not null and v.influencer_confirmed_at is not null) active_agreements,
      (select count(*)::int from public.collaboration_messages m join public.collaborations c on c.id=m.collaboration_id
        where m.author_id not in(c.brand_id,c.influencer_id)) invalid_message_authors,
      (select count(*)::int from public.collaborations c join public.applications a on a.id=c.application_id
        where a.opportunity_id<>c.opportunity_id or a.influencer_id<>c.influencer_id or a.status<>'selected') invalid_selected_links,
      (select count(*)::int from public.creator_portfolios where published_content is not null) public_portfolios,
      (select count(*)::int from public.collaboration_attachments) attachments`)
    ).rows[0];
    checked(integrity.active_members === 50, "fixture_members_restored");
    checked(integrity.withdrawn === samples, "measured_withdrawals_committed");
    checked(
      integrity.active_agreements === 50,
      "effective_mutual_agreements_preserved",
    );
    checked(
      integrity.invalid_message_authors === 0 &&
        integrity.invalid_selected_links === 0,
      "relational_author_and_selection_integrity",
    );
    checked(
      integrity.public_portfolios === 0 && integrity.attachments === 0,
      "no_publications_or_files",
    );
    const deltas = Object.fromEntries(
      Object.keys(EXPECTED).map((key) => [key, final[key] - initial[key]]),
    );
    return {
      tool: "creatorconnect-disposable-sql-diagnostic",
      seed_version: "scale-v1",
      samples_per_operation: samples,
      migration_count: MIGRATIONS.length,
      migration_source_sha256: digest.digest("hex"),
      setup_elapsed_ms: {
        schema: round(schemaMs),
        seed: round(seedMs),
        guards: round(guardMs),
        verification: round(time() - verificationStart),
      },
      initial_counts: initial,
      final_counts: final,
      committed_deltas: deltas,
      measured_phase_elapsed_ms: round(measureMs),
      operations: Object.fromEntries(
        Object.entries(operations).map(([label, data]) => [
          label,
          {
            committed_calls: data.committed_calls,
            errors: data.errors,
            elapsed_ms: summary(data.durations),
          },
        ]),
      ),
      passed_checks: checks,
      expected_denials: denials,
      timing_boundary:
        "JavaScript wall elapsed around a committed in-memory PGlite transaction: role/claim setup, public RPC, result materialization and commit. Setup/guards/verification excluded from operation samples.",
      limitations:
        "Single-connection WASM SQL and test-only claim plumbing; not Clerk verification, 10 real sessions, HTTP/Next/server-only p95, hosted concurrency, 15-minute representative load, browser metrics, real Storage/scanner or pg_cron. No network, persistent DB, credentials or DEV fixture access.",
    };
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify({
        tool: "creatorconnect-disposable-sql-diagnostic",
        phase,
        failed_check: error instanceof CheckFailure ? error.label : null,
        error_code: /^[0-9A-Z]{5}$/.test(error?.code ?? "")
          ? error.code
          : "DIAGNOSTIC_FAILURE",
        message:
          "Diagnostic failed; raw SQL errors, IDs and payloads are not logged.",
      })}\n`,
    );
    process.exitCode = 1;
    return null;
  } finally {
    await db?.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--help") {
    process.stdout.write(HELP);
    return;
  }
  let samples;
  try {
    samples = options(args);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
    return;
  }
  const result = await diagnostic(samples);
  if (result) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
main().catch(() => {
  process.stderr.write(
    "Diagnostic could not complete or close safely; no raw errors logged.\n",
  );
  process.exitCode = 1;
});

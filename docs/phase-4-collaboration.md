# Phase 4 collaboration workspace

Status: **In progress**, owner-authorized 13 November 2026 after parent review and [Phase 3 PR #5](https://github.com/Ronath1/creator_connect/pull/5). Branch `feat/phase-4-collaboration` is stacked on that unmerged phase. Parent reviews schema before hosted application and reviews the complete milestone before PR; the owner alone merges. Hosting, invitations and spending remain deferred. Phase 5 readiness follows review/PR, not a claim of a deployed pilot.

## Authorization and lifecycle

Continue the non-login/non-BYPASSRLS executor database boundary, explicit grants/RLS, owner-executed function ACLs and verified gateway subject. Normal business requests use the Clerk JWT plus publishable key. Lock opportunity then collaboration for lifecycle mutations. Direct table lifecycle writes and internal helpers remain unavailable to ordinary callers; business conflicts use `PT409`, not retry-triggering `40001`.

Agreements retain immutable term versions and confirmations. Pending edits clear confirmations and keep the original seven-day ceiling. Active amendments leave old terms effective until both confirm the proposal; stable deliverable UUIDs retain used/pending revision rounds. Acceptance of changed terms requires a new submission/review. Submission versions cover every agreed item; explicit item review enforces revision allowances and completion. Cancellation requests do not change work/access until accepted by the other participant or resolved by an assigned administrator case. Completed records cannot be unapproved/reopened.

Reports expose only reporter status/shareable outcomes. Administrative private-record access requires an assigned open case and recorded reason; interventions are audited and never presented as participant consent. Membership controls grant fixed brand/creator roles or restrict/reactivate existing members; administrator grants remain in the owner's trusted bootstrap channel. Immutable messages use new messages for corrections; reported content can be hidden with a recorded reason.

## Private files and scanner boundary

Two private buckets hold quarantine and clean files, with **no ordinary Storage read/write policies**. A user-JWT RPC first authorizes/reserves a UUID and quota. The separate server-only attachment worker uses `SUPABASE_ATTACHMENT_WORKER_KEY`, a separately revocable secret/service-role credential confined to that module. Ordinary domain clients never receive/use it. Only the worker RPC may finalize clean attestations; callers cannot assert scan status, hash or privileged identity through a form/header/flag.

The worker stores quarantine, verifies current real ClamAV engine/signature freshness, scans actual bytes through bounded INSTREAM, validates type/size, normalizes image bytes, promotes an immutable clean object and confirms quarantine absence before finalization. Unavailable/stale/error/infected/unknown scan results fail closed. Delivery first authorizes the current participant or assigned case with the user JWT, then performs a fixed-key worker download and verifies current metadata and immutable byte hash. Files use attachment/no-store/nosniff responses; no public/signed capability is issued or stored in notifications/logs.

Limits: JPEG/PNG/WebP/PDF, 10 MiB/file, five files/message or submission, 100 MiB/collaboration. The reservation uses the larger original/prepared size; unfinalized/rejected rows conservatively charge twice that amount for both copies until deletion is confirmed. Final clean bytes must fit that reservation. At most 200 non-purged files/collaboration and ten unlinked reservations/uploader bound tiny-file abuse. A durable cleanup worker retries orphan removal after 24 hours; quota is released only after both bucket objects are confirmed absent. These finite count bounds are implementation defaults supporting the accepted byte limits.

## Durable processing

Supabase `pg_cron` is available on the development target and is the selected SQL scheduler. Reviewed migrations schedule a bounded tick, now every 30 seconds, for expiry, deduplicated outbox-to-notification delivery and deadline/cancellation reminders. Candidate filters drain completed work rather than repeatedly selecting the same first batch. PostgreSQL state, event keys and job history survive application restarts; no HTTP cron secret is needed for SQL tick. Byte cleanup runs in a separate worker process with the attachment credential; production process hosting is deferred with deployment. See [operations](phase-4-setup.md).

## Evidence and current dependencies

The owner resumed on 14 November after the explicit pause. Parent reviewed/applied all five Phase 4 migrations, aligned their exact ledger versions and generated real types. Applied files are immutable. Parent owns hosted changes, test accounts and browser QA; no worker commit/push/PR or merge has occurred.

Parent prepared a portable loopback ClamAV 1.5.4 daemon without OS service/security changes. Its official distribution digest, fresh definitions, UTC and encrypted/scan-limit alerts were checked. The owner supplied the worker credential in ignored configuration; its real Storage connection was verified without printing the value. Actual app client clean original/normalized bytes, metadata removal, standard harmless EICAR, unavailable/stale scanner and corrupt-hash denial passed. Six full Storage/scanning cases and four HTTP groups passed the real Clerk → application → quarantine → scanner → promotion → attestation → authorized delivery path. These are live development checks, not mock scanner results or production approval.

Core hosted JWT checks passed mutual agreement, reset/stale confirmation, amendments, immutable message/submission retries, item revision limits/completion, cancellation, audited case access and direct API denial. Independent concurrent quota requests allowed exactly one winner at the remaining allowance. Recipient isolation, read/unread marking and pagination passed. Follow-up native checks verified unchanged member-status dedupe, actual message attachment descriptors, preserved accepted terms on amendment withdrawal and complete case evidence projection. Four successful 30-second cron runs drained the outbox; fresh security advisors returned no findings. Earlier performance-advisor notices are recorded for Phase 5 measurement, not treated as measured production failures.

The completed UI source has collaboration overview/discussion/deliveries/files/paged history, forms with preserved failed drafts, recipient notifications/unread badge, reporter outcomes and administrator queue/case/membership/audit screens. Report entry points exist on the related opportunity/profile/workspace. Every action validates current access again. Unread polling updates only its count, never refreshes workspace forms; only the notification page refreshes its list.

Local checks on 14 November passed **76 tests**, with one opt-in real-daemon case skipped because that run used no daemon. Separate real-daemon runs passed. Lint has zero warnings; formatting, generated route types/strict TypeScript and production build passed (4 static pages plus protected dynamic routes). A stale ignored development validator still referenced the removed placeholder route; the parent preserved it in a verified backup outside the TypeScript include, then type generation passed. No application authorization change was needed. Parent production browser review is now underway; final Phase 4 readiness/PR awaits that evidence and any corrections.

Earlier fresh signup/password reset handoff and screenshot/physical-phone/virtual-keyboard/zoom gaps remain recorded in the plan/checkpoint. No deployed/observed pilot completion is implied.

## References

- [Supabase changelog](https://supabase.com/changelog.md), checked 13 November; CLI 3 remains local by default and hosted mutations are parent-controlled.
- [Supabase Cron installation](https://supabase.com/docs/guides/cron/install) and [job scheduling/history](https://supabase.com/docs/guides/cron/quickstart).
- [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control).
- [ClamAV daemon guidance](https://docs.clamav.net/manual/Usage/Scanning.html): TCP has no authentication and must remain private.
- Installed Next mutation/Route Handler guidance under `node_modules/next/dist/docs/`, read before implementation as required by `AGENTS.md`.

# Collaboration and attachment operations

Phase 4 uses the existing Clerk/Supabase development integration. All domain actions use the current user token; applying migrations does not approve production release. Parent reviews and applies the versioned schema, confirms actual function ACLs/RLS and generates database types. Do not edit an applied migration to repair behavior.

## Attachment configuration

Keep these values in ignored `.env.local` or a chosen host's secret configuration:

- `SUPABASE_ATTACHMENT_WORKER_KEY`: separately revocable Supabase secret/service-role credential. It is privileged; only `src/server/attachments/worker-client.ts` reads it. No ordinary domain request uses that client, no raw worker client is exported and it never reaches the browser.
- `CLAMAV_HOST`: private daemon address. Resolution must yield only loopback/private addresses; the code connects to a validated address. Missing configuration or scanner failure rejects uploads while text/HTTPS evidence continues working.
- `CLAMAV_PORT`: daemon TCP port, default 3310.

Use a supported patched engine: 1.4.6+ on the 1.4 branch or 1.5.4+ on 1.5. Prereleases and unreviewed branches fail closed. Run the daemon with UTC timestamps and official definitions updated through FreshClam; the client rejects signatures older than 48 hours or implausibly in the future. Enable encrypted archive/document alerts and alerts on exceeded scan limits. Set stream/file/scan limits to at least the 10 MiB application limit. ClamAV TCP has no authentication: never expose it publicly. Production supervision, network isolation, definition refresh and alerting need verification with the selected deployment.

Binary HTTP uploads avoid multipart parsing. The actual body is streamed with a byte limit before buffering, even without a trustworthy Content-Length, and the whole request has a 120-second deadline. Processing has a shared 90-second deadline across scanning, Storage and RPCs. Incoming bytes scan before image decoding; prepared image bytes scan again. PDFs retain identical bytes/hash and the original scan proof. Images are bounded to 16 megapixels, resized to at most 1024 px and encoded WebP without source metadata; PDFs are downloaded as attachments, never embedded.

The quarantine and clean buckets have no ordinary read/write policies. A user-token RPC authorizes the collaboration and reserves space; only the worker can promote and finalize the registered size/hash/type/scan proof. Finalization requires confirmed quarantine absence. Download rechecks current membership/record access, current metadata and the immutable hash, then checks authorization again. Responses use private/no-store, nosniff, sandbox CSP and attachment disposition. No public or signed capability is issued. An administrator must have an assigned open case and submit a reason for each download.

## Cleanup worker and quota

Run the provided worker in a supervised process once deployment is chosen:

```sh
npm run worker:attachments
```

One-shot operation for an operator/scheduler:

```sh
npm run worker:attachments -- --once
```

The script loads ignored local env if present; configure production secrets through the selected runtime. It logs aggregate removed/failed counts only. One-shot execution exits nonzero on failure; the long-running process retries. This is a provided worker, not evidence that production supervision is configured.

The larger original/prepared file size is reserved twice during processing, conservatively covering both copies within the 100 MiB collaboration allowance. Linked/clean records charge actual finalized size. At most ten unlinked reservations per uploader and 200 non-purged files per collaboration bound tiny-file abuse.

Users can discard only finalized clean, unshared files. Failed/aborted uploads retain quota and are marked rejected; no uncertain in-flight copy is immediately purged. Unscanned records cannot release quota until the 24-hour grace has elapsed. Cleanup claims are durable and exclusive for two hours; least-attempted ordering and retry backoff prevent failed old batches from starving later orphans. Both buckets must confirm object absence before a row becomes purged and releases its charge. A concurrent link wins over cleanup without deleting shared evidence. Record failures and investigate persistent scanner/Storage errors before inviting users.

## Notifications and scheduled work

The reviewed `pg_cron` job runs the bounded SQL tick every 30 seconds. It reconciles opportunity/agreement expiry, deduplicates transactional events into recipient notifications and produces deadline/cancellation support reminders. Candidate filters drain completed work instead of reselecting terminal rows forever. Job history retention is limited to owned job runs; product evidence/audit retention is separate.

The unread badge fetches a count every 30 seconds while visible without refreshing workspace forms. The notification page alone refreshes its list. There are no email, push or guaranteed offline alerts. Read authorization is checked again against the referenced record; hidden opportunity identifiers are withheld while legitimate historical application decisions remain available.

During a pause, the parent can disable the two owned development jobs and stop local runtimes. On resume, deliberately re-enable them and observe `cron.job_run_details`; elapsed time alone is not proof a job ran. Production scheduling/cleanup supervision and operational alerting remain Phase 5 readiness/release checks.

## Validation and limitations

Use `npm test`, `npm run lint`, `npm run format:check`, `npm run typecheck` and `npm run build`. The normal suite skips the explicitly opt-in real-daemon test; actual clean/EICAR tests must run against a configured engine, not a protocol fixture. Parent live tests cover the full Clerk → HTTP → Storage → ClamAV → finalization → authorized delivery path with synthetic files/accounts only.

Earlier fresh signup/password reset, screenshot visual inspection and physical Android/iPhone/virtual-keyboard/zoom evidence remain explicit gaps. Deployment, production isolation/restore, owner support/privacy acceptance, actual cohort and observation are deferred; no deployed pilot completion is claimed.

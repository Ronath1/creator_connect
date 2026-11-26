# Phase 8 local performance baseline

Status: **In progress — baseline tooling milestone parent-reviewed in [PR #10](https://github.com/Ronath1/creator_connect/pull/10), 23 November 2026**. The owner allowed development to proceed while browser checks remain deferred; that is a sequencing exception, not a permanent waiver or a browser/mobile pass. Phase 4/7 interactive verification and Phase 5 release/device gates remain open. Phase 6 waits on actual payment-provider eligibility/specification/account access. No Redis, infrastructure purchase, schema/index/RLS/cache change or Phase 9 work is introduced.

## Reproduce a bounded local HTTP sample

Use Node >=22.13 and an existing production build. The parent owns starting/stopping the local server, fixture state and the actual measurement run. Never build/type-generate while a Next server is running. This CLI does not start services, load `.env.local`, authenticate, seed records or change data. It issues anonymous **GET only** to `/` and optionally one explicit `/creators/[slug]`; no protected/lifecycle routes or arbitrary URLs are accepted.

```sh
npm run perf:baseline -- --help
npm run perf:baseline -- --origin http://localhost:3000 --samples 10 --warmup 2 --rps 1
npm run perf:baseline -- --origin http://localhost:3000 --samples 10 --warmup 2 --rps 1 --portfolio-slug cc-portfolio-qa-20261121
```

The example slug is the existing synthetic, **unpublished** portfolio, not a live/publication fixture instruction. Do not publish anything for this baseline. If the fixture changes, record its actual state separately; the CLI never inspects HTML to decide publication.

Bounds: literal `http://localhost` origin with optional valid port and loopback-only resolution; no credentials/path/query/fragment. Samples per target 1–30, warmup 0–5, aggregate start rate 0.1–2 requests/second, concurrency one, whole request deadline 1–15 seconds (default 10). Responses are drained with a 2 MiB bound; a chunk exceeding that bound aborts the request. Redirects remain manual and are not followed. The CLI's aggregate JSON omits response bodies, cookies, tokens, record IDs, actual portfolio slug and redirect locations. The invoking shell/npm may echo command arguments, so use only the scoped synthetic slug when sharing command transcripts. No secret, SDK or dependency is added.

The fixed request header is `Accept: */*`, recorded as `request_accept` in JSON. This samples anonymous **machine HTTP**, excluding the browser document-navigation/session-handshake path. Installed Clerk backend guidance classifies GET requests with `Accept: text/html` and no fetch destination as document navigation; see also [Clerk middleware](https://clerk.com/docs/reference/nextjs/clerk-middleware), checked 23 November. This header choice does not alter the application proxy/authentication or establish browser behavior.

Output is one aggregate JSON record, labelled `root` and optionally `creator-portfolio`: status counts, non-2xx counts, network/timeout/body-limit failures, bytes received, elapsed min/p50/p95/max for all attempts and separately for fully drained 2xx responses. Warmup and measured groups are separate; `total_wall_elapsed_ms` includes pacing and warmup. Percentiles use nearest rank; small samples are descriptive, not a statistically reliable tail estimate. Failure durations remain visible rather than silently disappearing from the summary.

Exit 2 means rejected configuration, 1 means a request failure or any non-2xx response (including a legitimate unavailable 404/redirect), 0 means all responses drained as 2xx. These are transport/status outcomes, **not product assertions**. A Next streamed not-found page can return HTTP 200: neither exit 0 nor a faster portfolio response proves the page was published or authorized. Check actual fixture state with the parent’s separate evidence; no body-based claim is made by the tool.

## What this does and does not measure

This is local anonymous HTTP elapsed through body drain, including network/Next rendering and any database work. It is **not** server-only authenticated p95, browser LCP/CLS/INP, concurrent user capacity or a production-region benchmark. Record commit/build mode, Node/OS, target port, date/time, data state, warm/cold process and CLI configuration with results. Reusing development-server output or comparing a public page to an unavailable page is not a valid before/after optimization result.

Accepted targets still require a separate approved representative target and instrumented run: 10 active sessions, **2 aggregate requests/second for 15 minutes**, 50 profiles, 100 opportunities, 500 applications, 50 collaborations and 2,000 messages. Server read p95 <=1 second, normal write p95 <=1.5 seconds, unexpected errors <1%, LCP <=2.5 seconds, CLS <=0.1 and sufficiently sampled INP <=200 ms remain **unexecuted/not established by this CLI**. See the [Phase 5 measurement protocol](phase-5-verification.md#performance-and-capacity-protocol) and [accepted targets](../phase-0-pilot-scope.md#8-proposed-quality-and-performance-targets).

## Evidence and decision record

Parent’s initial tiny DEV inventory estimate: 5 users, 9 opportunities, 11 applications, 8 collaborations, 3 messages, 75 events, 1 portfolio; 7 connections observed out of 60. These are a dated development snapshot/estimate, not seeded representative load or sustained connection pressure. The parent owns exact SQL inventory and any safe query-plan work. `EXPLAIN ANALYZE` executes its statement; do not run it on lifecycle RPCs or mutations merely to measure them.

Advisors report four existing [auth-RLS initialization warnings](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan), 14 [unindexed foreign-key informational findings](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) and 19 [unused-index informational findings](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index). These official remediation references were checked 23 November. Informational/initialization findings identify review candidates; they do not prove a bottleneck or justify weakening policies, adding every suggested index or removing an index unused on a tiny dataset. Actual plans, durations, row counts, buffers and workload frequency are needed first. No new schema or scaling change is justified by the currently recorded evidence.

Parent’s 23 November read-only database observation: `pg_stat_statements` is enabled, with 1,162 tracked statements since 11 November 2026 13:21:48 UTC. Keyword-family aggregates mix application, setup, QA and administrative SQL and are **not** application/RPC latency evidence. One bounded `EXPLAIN ANALYZE SELECT public.creator_portfolio(...)` for the exact synthetic unpublished portfolio showed a Result wrapper: planning 0.054 ms, execution 25.460 ms, 668 shared hits and zero reads. It ran as the postgres observer, not anon/user-role traffic; no nested plan was exposed. This single point establishes neither p95 nor an index/caching bottleneck. No statistics reset, settings or roles were changed.

### Parent-run local observations

Run started **23 November 2026, 07:31:35.998 UTC** (13:01 Sri Lanka time), on Windows with Node 22.20.0 and Next 16.4.6. Application source is Phase 7 checkpoint `1d9d698`; the existing production build was created 21 November and run with `npm start` on localhost:3000. The process had already served diagnostic requests, so this is not a cold-process benchmark. The only portfolio remains unpublished at revision 10 and all five scoped synthetic members remain suspended. No portfolio was published for measurements.

Configuration: `Accept: */*`, 10 measured requests plus two warmups per target, aggregate cap 1 request/second, concurrency one, 10-second deadline and 2 MiB body bound. Total wall elapsed was 23,924.96 ms. All 24 responses were fully drained HTTP 200, with zero network/timeout/body-limit errors or non-2xx responses; exit 0. The unavailable portfolio's streamed HTTP 200 is a transport observation, not publication or product success.

| Target and group                | Requests | Min ms | p50 ms | p95 ms   | Max ms   | Bytes received |
| ------------------------------- | -------- | ------ | ------ | -------- | -------- | -------------- |
| Root, warmup                    | 2        | 11.26  | 11.26  | 43.23    | 43.23    | 64,402         |
| Root, measured                  | 10       | 5.90   | 9.87   | 12.25    | 12.25    | 322,010        |
| Unpublished portfolio, warmup   | 2        | 135.56 | 135.56 | 1,543.14 | 1,543.14 | 28,726         |
| Unpublished portfolio, measured | 10       | 102.24 | 111.62 | 263.90   | 263.90   | 143,630        |

These nearest-rank p95 values equal the maximum at this sample size. The 1.54-second warmup remains visible; no repeated run was used to replace it with a better result. This run contains neither authenticated sessions nor writes, actual published content or browser execution. It cannot establish the accepted read/write targets, web vitals, error budget, production cost or representative capacity.

Independent parent review used a temporary loopback server outside the repository: seven groups passed for GET-only route selection/sequential pacing, redirect refusal, declared oversized bodies, streamed oversized bodies, a whole-body timeout, rejected unsafe/unknown configuration without requests or reflected values, and a closed listener reported as a network failure. Response/redirect sentinel contents were absent from output. Worker separately checked 12 invalid argument cases. Node syntax, targeted zero-warning ESLint, formatting, local document links and whitespace checks passed. App tests/build were not repeated because this milestone changes only the CLI, npm command and documentation. The owned Next server was stopped after the run; the temporary review listener was closed. No fixture, cron, scanner or service configuration changed during measurement.

Local tooling validation on 23 November: `node --check`, targeted zero-warning ESLint, formatting, whitespace and local Markdown target checks passed. `--help` completed without requests. Twelve rejected-configuration invocations exited 2 before HTTP: nonlocal origin, credentials, query, invalid port/slug, excessive samples/warmup/rate/timeout, unknown/missing/duplicate arguments. No application source changed, so the previously passing app suite/build was not repeated. Parent-run CLI transport/bounds and baseline measurements are recorded above.

Initial diagnostic run on 23 November used `Accept: text/html`, 10 measured requests plus two warmups per target at an aggregate 1 request/second. All 24 requests returned HTTP 307 for Clerk's client handshake; redirects were not followed and the CLI exited 1. Those durations measure the redirect path, **not application page latency**, and are excluded from baseline conclusions. Parent compared a machine request without the document header, which returned HTTP 200; the CLI was corrected to the explicit wildcard above. The corrected measurement run remains separate evidence, not a rewrite of the failed diagnostic.

For a measured regression: identify the exact request/query family, preserve authorization, reproduce on the same dataset/target, propose the smallest fix, then record before/after timing and denial/regression checks. Redis requires explicit cache key/scope/TTL/invalidation, outage policy, hit rate and cost evidence. Current conclusion: **no scaling change justified**; local baseline delivery is not Phase 8 production-capacity completion. Parent reviews before PR; owner alone merges.

# Phase 2 integration setup and verification

Status: integration milestone in progress. The parent has identified the owner's dedicated development project, applied the reviewed migration and generated real database types. This is not evidence that actual Clerk sessions, full onboarding, storage or mobile behavior have passed verification. The parent reviews every delivered milestone before a PR; the owner alone merges `main`.

## Development configuration

Use the owner's intended **development** Clerk application and a dedicated Supabase development project. Never repurpose unrelated connected projects or apply the migration to production without explicit authorization. Keep secrets in ignored `.env.local`; do not paste them in messages, terminal arguments, screenshots, or tracked files. `.env.example` contains blank integration entries deliberately.

Required configuration:

| Setting                                | Use                                                                                 |
| -------------------------------------- | ----------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`    | Clerk's publishable browser key                                                     |
| `CLERK_SECRET_KEY`                     | Clerk server SDK only                                                               |
| `NEXT_PUBLIC_SUPABASE_URL`             | Selected Supabase project's HTTPS API origin                                        |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Modern publishable Supabase API key; no service-role key for normal requests        |
| `APP_URL`                              | Application origin for metadata; local default is acceptable for local verification |

Restart/rebuild after changing public environment values. Missing, incomplete, or invalid configuration leaves sign-in, onboarding, profile and dashboard routes in an unavailable state. The code does not invent a session, accept a local bypass user, or substitute in-memory records. The initial missing-configuration path must be tested separately from the real configured path.

Use the provided `npm run dev` / `npm start` scripts and open `http://localhost:3000` (or the printed port). They bind to `localhost` loopback. The parent traced an initial 40-second public-page failure to Next normalizing a `127.0.0.1` URL to `localhost` while Clerk rewrote the request to that host. Matching the listening hostname fixed the runtime request without disabling authentication. Keep local origins consistent; do not bypass configured auth routes to conceal connection failures.

In the selected Clerk instance, enable its native Supabase integration, so session tokens contain the `authenticated` database role. In the selected Supabase project, register that Clerk issuer under Third-Party Auth. Use Clerk session tokens through the Supabase client's `accessToken()` callback; do not create the deprecated Supabase JWT template or share signing secrets. Clerk handles sign-in, sign-up, recovery, sessions and account controls. Sign-up creates an identity only: it does not grant marketplace membership.

Primary references checked for this milestone: [Clerk App Router setup](https://clerk.com/docs/nextjs/getting-started/quickstart), [Clerk Supabase integration](https://clerk.com/docs/guides/development/integrations/databases/supabase), [Supabase Clerk authentication](https://supabase.com/docs/guides/auth/third-party/clerk), and [Supabase CLI v3 changes](https://supabase.com/changelog/supabase-cli-v3). CLI 3 targets local resources by default; inspect the installed command help and explicitly select an approved remote when appropriate. No remote project is implicitly selected by installing the CLI.

## Database and trusted membership bootstrap

The CLI generated `supabase/migrations/20261111141221_phase_2_identity_onboarding.sql`. It defines:

- `app_users`: internal UUID, unique Clerk subject stored as text, fixed marketplace role, and current membership status. Client roles can read their own row only. They cannot insert, update, or delete memberships or roles.
- Separate brand and influencer profiles with field limits, ownership constraints, and active-membership/role checks. Read/write policies are own-record only in this milestone; member discovery belongs to Phase 3.
- Creator social links with permitted platforms/hosts, one link per platform, and explicit self-reported count/date fields.
- Two security-invoker onboarding RPCs, which derive identity from the verified JWT subject and save atomically under RLS. Retrying updates the same profile; invalid social links roll back the entire save.

All exposed tables enable RLS and explicitly grant only needed operations. All function default execution grants to `PUBLIC`/`anon` are revoked. There are no security-definer functions, privileged browser keys, signup-metadata role claims, or webhooks.

The parent identified the owner's dedicated `creator_connect` development project, applied the reviewed migration, confirmed RLS on all four tables, and received no security-advisor findings. Real Supabase-generated types are recorded in `src/lib/database.types.ts` and used by the server client and services. Re-generate from the approved project after schema changes. Actual Data API/Clerk-session tests and end-to-end application checks still need their own evidence; generated types alone do not establish working identity integration.

The initial native session lacked the database role claim. After the owner updated configuration, a fresh native Clerk token contained `role: authenticated`; the parent verified its signature against Clerk JWKS and confirmed the exact token was sent as the Authorization bearer value. Supabase still rejected it with HTTP 401 / `PGRST301` (“No suitable key or wrong key type”). The parent requested confirmation that the correct third-party provider is active in the intended project and stopped blind retries pending an external configuration change. All synthetic check sessions were revoked; the test identity remains uninvited. Do not replace the rejected token with a hand-signed JWT or service-role request. The parent aligned the hosted migration ledger to local version `20261111141221`; metadata reconciliation did not change the reviewed schema.

The initial trusted membership channel is owner-operated SQL in the approved development database. After authorized synthetic Clerk users exist, the owner records each approved Clerk user ID, role and action reason in their operational record. Create one `app_users` row per approved identity; the database generates the internal UUID. For retries, use the Clerk-ID unique constraint and a deliberate upsert that does not silently change an existing role. Granting `admin`, switching a role, suspending, and restoring membership are privileged operations; no self-service grant or admin management UI is included in this milestone.

To revoke marketplace access, set membership status to `suspended` through that trusted channel. Current RLS blocks profile/social reads and writes without waiting for an old role claim to expire. The app provides an access-restricted page and account sign-out. Clerk account/session revocation is a separate owner/provider operation when required; database suspension does not delete the identity. Do not create test users, send invitations, or change existing identities in a live account without the owner's authorization.

## Source journey and mobile behavior

Configured path: Clerk sign-in or sign-up → active membership check → role-specific onboarding → atomic save → persisted dashboard/profile. Unapproved identities see access pending; suspended identities see access restricted. Administrators have a real membership-gated dashboard shell and no creator/brand form. Later marketplace tools remain explicitly unavailable.

Onboarding starts as one column, uses 16 px inputs and controls at least 44 px high, visible required labels, a linked error summary, inline errors, preserved values on validation/connection failures, and a pending save state. Added social rows are required and keep their physical error indexes; unwanted last rows can be removed. Optional metric errors expand their section. No important action is covered by a sticky panel. The header/member navigation wraps for narrow screens. These are implementation choices, not visual/device verification evidence.

Verify at 360, 390, 768 and 1280 CSS px. Check touch navigation/account controls, portrait/landscape, zoom, keyboard/focus, virtual keyboard, long text and failed/retried saves. Before pilot invitations, record the full flow on Android Chrome and iPhone Safari, using real devices where available and distinguishing emulation. The Phase 1 browser gap remains open; authorizing Phase 2 does not establish that Phase 1 passed it.

## Storage and synchronization boundaries

Avatar/logo upload is explicitly unavailable in this milestone; users can complete text/link profiles. Protected image buckets, type/size validation, object ownership/access, replacement cleanup, and real Storage policy tests remain Phase 2 work before uploads are enabled. Private collaboration attachments remain Phase 4 and need their separately agreed controls. No local file substitutes for storage are used.

Onboarding uses the current authenticated session directly and needs no account-sync webhook. Deletion/recovery, operational membership audits, and production lifecycle procedures must be finalized before inviting real users. If account-sync webhooks become necessary, add signature verification, deduplication and retry tests then; no unverified webhook endpoint exists now.

## Validation boundaries

`npm test` runs the exact migration in isolated PGlite PostgreSQL with synthetic identities and test-only role/JWT plumbing, plus pure onboarding validation tests. Those fixtures are never imported by the application. They prove SQL/RLS and validation behavior, not Clerk token verification, hosted Data API configuration or actual device behavior. Production uses the real Clerk SDK and Supabase JWT gateway.

Run type, lint, formatting and production-build checks after source changes. Then verify actual sign-in/recovery, active/unapproved/suspended/administrator routing, new/returning-user onboarding, direct cross-user Data API denial, role escalation denial, retry safety, advisors, generated types, storage and mobile behavior against the approved development setup. Keep Phase 2 In progress until those checks are recorded; do not infer completion from compiling source or passing isolated tests.

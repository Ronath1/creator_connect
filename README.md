# CreatorConnect

A Next.js application for the Sri Lanka private pilot. The foundation includes the public introduction and responsive design/navigation. Real Clerk/Supabase integration provides controlled membership, atomic profile onboarding and private profile images. Phase 3 adds member profiles, opportunity publishing/discovery, private applications and transactional selection.

Account flows require the owner's configured development services and approved membership. They fail closed when configuration is absent; marketplace access also requires a complete profile. Optional private photos/logos use real Supabase Storage and bounded image processing. Selection reserves one slot and creates a pending agreement; mutual agreement, collaboration discussions/submissions/attachments and notifications follow in Phase 4. Payments remain unavailable. See [the plan](plan.md), [accepted pilot scope](phase-0-pilot-scope.md), [Phase 2 setup](docs/phase-2-setup.md), [profile-image milestone](docs/phase-2-profile-images.md) and [Phase 3 marketplace](docs/phase-3-marketplace.md) for verified behavior and remaining checks.

## Run locally

Use Node.js 22.13 or newer and npm. On Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`.

```sh
npm ci
npm run dev
```

Open the printed local URL, normally `http://localhost:3000`. The public introduction needs no credentials. For real account flows, use the owner's intended development Clerk/Supabase configuration in ignored `.env.local`, following the setup guide. `APP_URL` is optional for metadata and accepts a plain HTTPS origin or HTTP localhost origin. Never put credentials into tracked files. Restart/rebuild when public configuration changes.

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

`build` does not replace the separate lint/type checks. `start` runs the production build locally. The development and production scripts bind to loopback intentionally; deployment is deferred and no host has been selected. No app data is stored in process memory or local files.

Use the `localhost` hostname consistently. With the current Next/Clerk combination, binding only to `127.0.0.1` caused Clerk's local request rewrite (normalized by Next to `localhost`) to fail with a socket hang-up. Binding to `localhost` resolved the parent-observed failure while retaining the real authentication middleware.

## Source layout

| Location                   | Responsibility                                                                                      |
| -------------------------- | --------------------------------------------------------------------------------------------------- |
| `src/app`                  | App Router layout, landing page, route states, metadata, design tokens and responsive styles        |
| `src/app/[feature]`        | Allowlisted, explicit unavailable screens; unknown paths return 404                                 |
| `src/components`           | Shared header/footer, navigation, badge and link components                                         |
| `src/lib/site.ts`          | Public descriptive content and future-route catalogue                                               |
| `src/server/config.ts`     | Server-only, validated optional origin configuration                                                |
| `src/server/errors.ts`     | Deliberately safe error mapping for later request boundaries                                        |
| `src/server/validation.ts` | Bounded pagination parsing for future list services                                                 |
| `src/server/services`      | Current membership/profile/image and marketplace authorization/data services                        |
| `src/lib/marketplace.ts`   | Bounded field schemas, exact LKR parsing, explicit Sri Lanka time conversion and response contracts |
| `supabase/migrations`      | Versioned schema, lifecycle RPCs, constraints and RLS/function permissions                          |
| `tests`                    | Actual isolated PostgreSQL/RLS, byte-processing and request-validation tests                        |
| `src/instrumentation.ts`   | Minimal structured server-error hook, without request URLs, input, headers or error contents        |

Most content uses server components. Onboarding/opportunity/application forms use client state for drafts, validation and pending feedback; account pages use Clerk's real components. Native navigation and the labelled mobile disclosure menu work without application JavaScript. No remote fonts, stock photos or analytics are added. Configured flows call Clerk and the selected Supabase project with the current user's token. Lifecycle RPCs enforce role, ownership, complete active membership, immutable application uniqueness and the one-slot reservation transaction. The HTML/CSS landing illustration is explanatory, not real marketplace activity.

Design tokens follow the accepted slate/teal direction. Components provide visible keyboard focus, a skip link, descriptive landmarks/headings, readable status labels, and reduced-motion support. The CSS adapts from 360 px mobile to desktop; actual browser visual verification must be recorded separately from static review.

## Environment and later integrations

| Variable / service | Current source behavior                                                          | Remaining configuration                                                                                         |
| ------------------ | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `APP_URL`          | Optional server-only metadata origin, defaults to localhost                      | Set to chosen deployment origin before release                                                                  |
| Clerk              | Real development SDK/provider/proxy, sessions and native Supabase trust verified | Owner fresh-signup/password-reset handoff and remaining device checks                                           |
| Supabase           | User-token client, onboarding/marketplace RPCs, RLS and private profile images   | Hosted authorization/concurrent selection/avatar checks passed; production isolation/deployment remain deferred |
| ClamAV             | Owner selected for Phase 4; no daemon connection implemented yet                 | Configure real daemon and verify scanning/quarantine before arbitrary private attachments                       |
| Monitoring         | No external monitoring provider                                                  | Before pilot release: owner-approved tooling and privacy-safe operational measurements                          |
| Payments           | Unavailable; informational pilot language                                        | Phase 6 after provider/business-rule approval                                                                   |

Future service configuration must stay server-only unless the provider explicitly defines a publishable browser value. Do not add mock account flows while credentials are unavailable. Authentication, membership and server/database policies must be verified before any real users or private records enter the app. The placeholder routes are public descriptions and expose no privileged operation or private data.

## Verification and handoff

See [Phase 1 verification](docs/phase-1-verification.md), [Phase 2 verification](docs/phase-2-verification.md), [Phase 3 marketplace evidence](docs/phase-3-marketplace.md) and [current checkpoint](CHECKPOINT.md). Phase 3 implementation is Ready for review: 49 tests, lint, formatting, strict types and production build pass; real hosted JWT/concurrency and two-account browser publish/discover/apply/select checks pass. Earlier fresh signup/password-reset handoff, screenshot visual inspection, physical phones, virtual keyboard and zoom remain explicit gaps. Deployment and pilot invitations/observation are deferred. The parent reviews every milestone before a PR; the owner alone merges `main`.

Current framework setup was checked against the official [Next.js installation guide](https://nextjs.org/docs/app/getting-started/installation) and [Tailwind Next.js guide](https://tailwindcss.com/docs/installation/framework-guides/nextjs). Installed versions and the lockfile are the reproducible implementation record.

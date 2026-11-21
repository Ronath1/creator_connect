# CreatorConnect

A Next.js application for the Sri Lanka private pilot. The Phase 1 foundation includes the public introduction, shared design tokens/navigation and safe route states. The Phase 2 source milestone adds real Clerk/Supabase integration wiring, controlled membership, atomic profile onboarding, and member dashboard/profile shells.

Account flows require the owner's configured development services and an approved membership. They fail closed when configuration is absent. Optional private profile photos/logos now use real Supabase Storage and bounded image processing. Marketplace opportunities, applications, collaboration attachments and payments are not implemented. See [the plan](plan.md), [accepted pilot scope](phase-0-pilot-scope.md), [Phase 2 setup](docs/phase-2-setup.md) and [profile-image milestone](docs/phase-2-profile-images.md) for verified behavior and remaining checks.

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

| Location                   | Responsibility                                                                               |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| `src/app`                  | App Router layout, landing page, route states, metadata, design tokens and responsive styles |
| `src/app/[feature]`        | Allowlisted, explicit unavailable screens; unknown paths return 404                          |
| `src/components`           | Shared header/footer, navigation, badge and link components                                  |
| `src/lib/site.ts`          | Public descriptive content and future-route catalogue                                        |
| `src/server/config.ts`     | Server-only, validated optional origin configuration                                         |
| `src/server/errors.ts`     | Deliberately safe error mapping for later request boundaries                                 |
| `src/server/validation.ts` | Bounded pagination parsing for future list services                                          |
| `src/server/services`      | Documented boundary for later authorized domain services                                     |
| `src/instrumentation.ts`   | Minimal structured server-error hook, without request URLs, input, headers or error contents |

Most content uses server components. The onboarding form uses client state for submitted errors/pending status and optional social rows; account pages use Clerk's real components. Native navigation and the labelled mobile disclosure menu work without application JavaScript. No remote fonts, stock photos or analytics are added. Configured account flows call Clerk and the selected Supabase project with the current user's token. The HTML/CSS landing illustration is explanatory, not real marketplace activity.

Design tokens follow the accepted slate/teal direction. Components provide visible keyboard focus, a skip link, descriptive landmarks/headings, readable status labels, and reduced-motion support. The CSS adapts from 360 px mobile to desktop; actual browser visual verification must be recorded separately from static review.

## Environment and later integrations

| Variable / service | Current source behavior                                                 | Remaining configuration                                                                |
| ------------------ | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `APP_URL`          | Optional server-only metadata origin, defaults to localhost             | Set to chosen deployment origin before release                                         |
| Clerk              | Real SDK/provider/proxy and auth pages, gated by complete configuration | Verify owner's dev application, session/recovery flows and native Supabase integration |
| Supabase           | User-token client, onboarding RPCs and private profile images           | Native trust/core and Storage checks passed; browser/device verification continues     |
| Monitoring         | No external monitoring provider                                         | Before pilot release: owner-approved tooling and privacy-safe operational measurements |
| Payments           | Unavailable; informational pilot language                               | Phase 6 after provider/business-rule approval                                          |

Future service configuration must stay server-only unless the provider explicitly defines a publishable browser value. Do not add mock account flows while credentials are unavailable. Authentication, membership and server/database policies must be verified before any real users or private records enter the app. The placeholder routes are public descriptions and expose no privileged operation or private data.

## Verification and handoff

See [Phase 1 verification](docs/phase-1-verification.md) and [Phase 2 verification](docs/phase-2-verification.md) for executed checks and limitations. Deployment is not included. Phase 1 retains its browser QA gap; Phase 2 remains in progress until real integration/storage and mobile checks pass. The parent reviews every milestone before a PR; the owner alone merges `main`.

Current framework setup was checked against the official [Next.js installation guide](https://nextjs.org/docs/app/getting-started/installation) and [Tailwind Next.js guide](https://tailwindcss.com/docs/installation/framework-guides/nextjs). Installed versions and the lockfile are the reproducible implementation record.

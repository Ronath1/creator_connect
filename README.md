# CreatorConnect

A Next.js application and UI foundation for the Sri Lanka private pilot. Phase 1 includes a responsive landing page, shared design tokens/components, navigation, safe error/loading/not-found states, and explicit unavailable screens for future features.

There are no active accounts, marketplace records, business actions, uploads, or payments. Sign-in leads to an explanation, not a simulated login. See [the plan](plan.md) and [accepted pilot scope](phase-0-pilot-scope.md) for phase boundaries.

## Run locally

Use Node.js 22.13 or newer and npm. On Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`.

```sh
npm ci
npm run dev
```

Open the printed local URL, normally `http://127.0.0.1:3000`. No service accounts or environment variables are required. Copy `.env.example` to the ignored `.env.local` only if you want to set `APP_URL` for metadata. That value must be a plain HTTPS origin, or HTTP for localhost. Never put credentials into tracked files.

```sh
npm run format:check
npm run lint
npm run typecheck
npm run build
npm start
```

`build` does not replace the separate lint/type checks. `start` runs the production build locally. The development and production scripts bind to loopback intentionally; deployment is deferred and no host has been selected. No app data is stored in process memory or local files.

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

The UI uses server components except the error retry boundary. Native navigation, anchors, and a labelled mobile disclosure menu work without application JavaScript. There are no remote fonts, third-party scripts, stock-photo downloads, analytics, or network data calls. The landing illustration uses HTML/CSS and is explanatory rather than a representation of real marketplace activity.

Design tokens follow the accepted slate/teal direction. Components provide visible keyboard focus, a skip link, descriptive landmarks/headings, readable status labels, and reduced-motion support. The CSS adapts from 360 px mobile to desktop; actual browser visual verification must be recorded separately from static review.

## Environment and later integrations

| Variable / service | Phase 1 behavior                                            | Later configuration                                                                    |
| ------------------ | ----------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `APP_URL`          | Optional server-only metadata origin, defaults to localhost | Set to chosen deployment origin before release                                         |
| Clerk              | Not installed or connected                                  | Phase 2: owner project configuration, sessions, invite membership and authorization    |
| Supabase           | Not installed or connected                                  | Phase 2: migrations, user-scoped access, RLS; storage only with agreed controls        |
| Monitoring         | No external monitoring provider                             | Before pilot release: owner-approved tooling and privacy-safe operational measurements |
| Payments           | Unavailable; informational pilot language                   | Phase 6 after provider/business-rule approval                                          |

Future service configuration must stay server-only unless the provider explicitly defines a publishable browser value. Do not add mock account flows while credentials are unavailable. Authentication, membership and server/database policies must be verified before any real users or private records enter the app. The placeholder routes are public descriptions and expose no privileged operation or private data.

## Verification and handoff

See [Phase 1 verification](docs/phase-1-verification.md) for executed checks and limitations. No services are provisioned and no deployment is included. Hosting choice, real integration, and later phases require the owner's authorization. The parent reviews changes before a PR; the owner alone merges `main`.

Current framework setup was checked against the official [Next.js installation guide](https://nextjs.org/docs/app/getting-started/installation) and [Tailwind Next.js guide](https://tailwindcss.com/docs/installation/framework-guides/nextjs). Installed versions and the lockfile are the reproducible implementation record.

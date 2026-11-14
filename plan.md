# CreatorConnect — Phased Development Plan

Status: Phase 0 accepted and complete. Earlier manual/visual/device gaps remain recorded. Phase 3 was reviewed and delivered in PR #5; Phase 4 source/checks are delivered with production browser review in progress. The owner authorized finishing Phases 3 and 4, then Phase 5 readiness; hosting/deployment will be decided later. Phases 6–9 remain unauthorized.
Updated: 14 November 2026.
Product context: [brand-influencer-product-vision.md](brand-influencer-product-vision.md).
Phase 0 proposal: [phase-0-pilot-scope.md](phase-0-pilot-scope.md).

## 1. Direction and confirmed choices

Build a marketplace where brands and influencers discover each other, agree on promotional work, track delivery, and eventually handle payments through the platform.

Confirmed direction from the product owner:

- Use Next.js for the frontend and backend.
- Use Clerk for authentication; connect the owner's account and credentials later.
- Use Supabase for the database.
- Launch in Sri Lanka first, with other countries considered later.
- Design the website mobile-first: the owner expects most users to access it on phones. Core workflows must work fully on mobile, with responsive tablet and desktop layouts.
- Start with a private pilot to validate collaboration workflows, then introduce real payments.
- Start with a simple foundation and evolve toward Redis caching and greater scalability.
- Phase 0 was accepted through the owner's merge of PR #1. The owner explicitly authorized Phases 1 and 2 separately on 11 November 2026, then continued Phase 2 through setup and image verification. On 13 November the owner instructed: finish Phases 3 and 4 first, then move to Phase 5. Hosting/deployment decisions are expressly deferred; AWS access is available but no hosting provider or infrastructure is selected.

CreatorConnect is a working project label; the product brief leaves the final name open.

## 2. Assumptions and recommendations

These are proposals, not additional confirmed requirements:

| Area | Initial proposal | Revisit when |
| --- | --- | --- |
| Application structure | One Next.js application containing frontend and backend modules | A separate worker or independently deployed API solves a measured need |
| Language | TypeScript throughout | Confirm before scaffolding |
| Styling | Tailwind CSS and accessible reusable UI components | Confirm the visual direction |
| Users | Brand, influencer, and administrator; one primary marketplace role per user initially | Multi-role accounts or brand teams become necessary |
| Currency | Display pilot budgets in LKR; store an explicit currency alongside every amount | Before real payments or international launch |
| Pilot language | English initially | Confirm Sinhala and Tamil requirements before UI implementation |
| Social presence | Profile links and self-reported information | Approved social integrations become necessary |
| Messaging | Simple collaboration discussion threads with refresh/polling | Users need real-time delivery |
| Hosting | A managed Next.js-compatible host; provider remains undecided | Before deployment |
| Storage | Supabase Storage for profile images and permitted attachments | Confirm file types, sizes, and retention |
| Notifications | In-app notifications first; email provider undecided | Pilot communication requirements are known |

The [accepted Phase 0 scope](phase-0-pilot-scope.md) records cohort, budget, and performance planning targets accepted through PR #1. They are not verified capacity or pricing promises. A launch date remains undecided.

## 3. How phase-by-phase work must proceed

- Current position: Phase 3 parent review and PR #5 are delivered. Phase 4 source and executable checks are delivered under the owner's resumed instruction, with parent production browser review in progress. Fresh signup/password-reset handoff and physical-device/visual gaps remain recorded. Phase 5 readiness follows parent Phase 4 review/PR; do not describe an undeployed or unobserved pilot as complete.
- Editing this plan does not authorize application development. Start implementation only when the owner explicitly instructs it.
- Work within the approved phase. Do not silently add later-phase features or provision later-phase services.
- At the start of a phase, review its prerequisites and resolve only the decisions needed for that phase. Future decisions may remain open.
- Track a phase as Not started, In progress, Blocked, or Complete, with evidence and unresolved items recorded in this file when work is authorized.
- At phase completion, summarize deliverables, checks performed, remaining issues, and the next phase. Never mark an incomplete phase complete.
- Follow the owner's authorized scope across phases. If only one phase is authorized, present its completion summary and await instruction before starting another. Explicit authorization covering multiple phases remains valid.
- Fix issues in already delivered work when necessary for the active phase and record the dependency; propose broader scope changes before undertaking them.
- Credentials and provider accounts are needed only when their phase requires integration. Do not substitute mock authentication or payment behavior for a completed integration.
- Reuse the same phase implementation agent where the session remains available; current handoff identity is `/root/phase_worker`, requested GPT-6.1-sol with medium reasoning. Availability across sessions cannot be guaranteed; a successor must read the plan, vision, scope proposal, decisions, and PR history.
- The parent agent reviews phase changes and resolves findings before creating a PR. The owner alone merges into `main`; agents do not merge on the owner's behalf.
- The owner merged Phase 0 acceptance PR #1, accepting its final scope/design proposals and D01–D10. A PR merge does not authorize a subsequent phase; start later phases only within explicit owner authorization. Phase 1 has a separate explicit instruction recorded above.

### Roadmap and phase status

| Phase | Outcome | Prerequisite | Status |
| --- | --- | --- | --- |
| 0 | Agreed pilot scope and design direction | Existing product vision and owner decisions | Complete — accepted via owner merge of PR #1 |
| 1 | Next.js frontend/backend skeleton and UI foundation | Phase 0 | In progress — implementation/executable checks reviewed; browser QA resumed 12 November |
| 2 | Clerk identity, Supabase data/access foundation, onboarding | Phase 1 and owner's development service configuration | In progress — hosted identity/onboarding verified; storage and browser/mobile checks underway |
| 3 | Profiles, opportunity discovery, applications and selection | Phase 2; owner authorized continued development with recorded manual/device gaps | In progress — implementation/checks delivered, Ready for review |
| 4 | Agreed work, discussions, submissions, approvals and admin support | Phase 3 parent review and PR | In progress — source/checks delivered, production browser review underway |
| 5 | Verified Sri Lankan private pilot and feedback | Phase 4 and deployment readiness | Authorized after Phase 4; readiness first, deployment/provider decision deferred |
| 6 | Real payments with verified collection and payout behavior | Validated pilot and agreed provider/business rules | Not started |
| 7 | Prioritized portfolios, integrations and reporting | Pilot feedback and feature-specific decisions | Not started |
| 8 | Measured performance improvements, including Redis if justified | Operational measurements and a demonstrated bottleneck | Not started |
| 9 | Deliberate expansion beyond Sri Lanka | Stable Sri Lankan operation and country-specific readiness | Not started |

Phases 0–6 form the default delivery sequence. Phases 7–9 are conditional follow-on work, not mandatory launch requirements. Phase 7 may follow Phase 5 independently of payments; Phase 8 may be brought forward when measurements justify it. Record any approved reorder and its dependencies before starting that work. Baseline scalability and security requirements apply from the beginning.

## Shared technical foundation

```text
Browser
  |
  v
Next.js application
  - Frontend: public pages, onboarding, dashboards, collaboration screens
  - Backend: authenticated actions, API routes, validation, business services
  |
  +--> Clerk: identity and sessions
  +--> Supabase Postgres: application data and access policies
  +--> Supabase Storage: images and permitted attachments (proposed)
  |
  +--> Later: payment provider, durable jobs, social integrations, Redis
```

### Frontend — Next.js

- Use the App Router, with server-rendered pages where appropriate and client components for interactive features.
- Build responsive, accessible pages with loading, empty, validation, and error states.
- Deliver public pages, sign-in, onboarding, dashboards, opportunities, collaboration screens, and admin tools in their assigned phases below.
- Keep UI components separate from authorization, database queries, and payment logic.
- Treat every browser-supplied field, identifier, and role as untrusted input.

### Mobile-first requirements — apply to every UI phase

The existing responsive requirement is now an explicit mobile-first priority. Most users accessing the service by phone is the owner's audience expectation; validate the device mix during the pilot.

- Design small-screen layouts and core actions first, then adapt them for tablets and desktops. The initial delivery is a responsive website; a native mobile app, installable PWA, and offline functionality are separate future decisions.
- Support the full brand, influencer, and administrator workflows on phones, including authentication, onboarding, opportunity creation/discovery, applications, discussions, submissions, approval, and later payments. Do not require desktop access for essential actions.
- Use readable text, visible labels, clear focus states, and touch-friendly controls. Target at least 44 × 44 CSS pixels for primary buttons and icon controls; do not depend on hover-only interactions.
- Use navigation that fits narrow screens, single-column forms where appropriate, and cards or deliberate responsive alternatives for wide tables. Avoid page-level horizontal scrolling and clipped content.
- Keep important actions visible without sticky elements covering content. Check virtual-keyboard behavior, form errors, long text, image/file selection, and portrait/landscape layouts.
- Keep mobile pages lightweight through appropriately sized images, restrained client JavaScript, pagination, and useful loading/retry states on slow or interrupted connections. Offline submission is not assumed.
- Verify representative layouts at 360 px, 390 px, 768 px, and 1280 px CSS viewport widths. These extend the accepted 360 px/1280 px checks; they do not claim the current implementation has passed them.
- Before the pilot, test the full journey in Android Chrome and iPhone Safari, using actual devices where available and documenting when testing is limited to emulation. Check zoom, keyboard/focus navigation, and touch interactions as well as visual layout.
- Each UI phase must record its mobile verification evidence and unresolved issues before being marked complete. Browser/device testing that is unavailable remains an explicit verification gap.

### Backend — Next.js

- Use Route Handlers for HTTP APIs and external webhooks, and server actions where useful for application forms. Next.js supports custom request handlers within the App Router. [Documentation](https://nextjs.org/docs/app/getting-started/route-handlers).
- Keep business services organized by profiles, opportunities, applications, collaborations, messages, and eventually payments.
- Authenticate and authorize every protected operation on the server, including operations invoked by server actions.
- Validate input, paginate lists, bound upload/query sizes, and return consistent errors.
- Use database transactions and constraints for related state changes; prevent duplicate applications and conflicting acceptance actions.
- Keep application servers stateless: no durable data, sessions, or coordination stored only in process memory or local files.
- Add durable background processing when reliable retries or long-running work are required. Do not launch critical work after returning a response without a durable mechanism.

### Database — Supabase Postgres

- Postgres is the source of truth for profiles, opportunities, commitments, and future financial records.
- Keep schema changes in version-controlled migrations and generate TypeScript database types.
- Begin with the Supabase client and deliberate SQL migrations; an ORM is optional and not yet selected.
- Add foreign keys, unique constraints, timestamps, and indexes based on actual access patterns.
- Enable Row Level Security (RLS) on every exposed table and define explicit ownership, participant, and administrator policies.
- Use user-scoped database access for normal requests. Reserve privileged keys for narrowly scoped server-only operations.
- Separate development and production environments. Use synthetic pilot/test data outside production, and verify backups and restoration before real users depend on the service.

### Authentication and authorization — Clerk + Supabase

- Clerk owns sign-up, sign-in, session management, and account recovery. Supabase stores product data; a second user-facing Supabase login system is unnecessary.
- Use the supported Clerk third-party authentication integration so Supabase can validate Clerk session tokens. Follow the current integration guide rather than the deprecated Supabase JWT-template approach. [Clerk integration guide](https://clerk.com/docs/guides/development/integrations/databases/supabase).
- Give application users an internal ID and a unique Clerk user ID stored as text. RLS must map the verified token subject to that identity; do not assume Clerk IDs are Supabase Auth UUIDs.
- Store marketplace roles and ownership in controlled application records. Users must never be able to assign themselves administrator privileges.
- Handle profile creation with an idempotent onboarding flow. Verify and deduplicate any Clerk webhooks used for account synchronization.
- Test direct database access as well as UI routes: brands cannot inspect another brand's private work, and influencers cannot access collaborations they do not participate in.
- Connect the owner's Clerk/Supabase projects later using environment variables. Never commit secrets, place server secrets in public environment variables, or paste credentials into this plan.

## Phase 0 — Confirm scope and design direction

**Goal:** make the first implementation phase concrete without writing application code.

**Prerequisite:** existing product brief and the confirmed Sri Lanka-first, private-pilot direction.

**Work and decisions:**

- Confirm TypeScript, styling approach, visual direction, and English-only versus Sinhala/Tamil requirements.
- Define pilot audience size, operating budget, and realistic response-time/error targets.
- Decide single versus multiple marketplace roles and whether brand teams are necessary immediately.
- Sketch the main screens, navigation, user permissions, and the collaboration journey.
- Agree on application/hiring limits, required profile fields, deliverables, approval, revision, cancellation, and reporting rules.
- Identify initial social profile links, file types/limits, notification channels, and public versus private information.
- Record opportunity, application, and collaboration state transitions and who may trigger them. Payment rules can remain open until Phase 6.

**Deliverables:** agreed pilot scope, screen outline, permission/state outline, and a list of remaining decisions assigned to later phases.

**Completion checks:** the owner has resolved or explicitly accepted assumptions required for Phase 1, and the next implementation scope is clear. Implementation still requires the owner's instruction.

**Acceptance evidence:** the owner merged [PR #1](https://github.com/Ronath1/creator_connect/pull/1) on 11 November 2026 at 13:44:08 UTC, merge commit `560fd03b70c9aa2cda39211d5eccca1c68aae2c6`. This accepts the final [pilot scope/design](phase-0-pilot-scope.md), including D01–D10, and completes Phase 0. The owner's separate Phase 1 instruction is recorded above.

## Phase 1 — Application and UI foundation

**Goal:** establish a small, maintainable Next.js application for frontend and backend development.

**Prerequisite:** Phase 0 complete and implementation authorized.

**Work:**

- Scaffold the agreed Next.js/TypeScript setup, package lockfile, formatting/linting, and environment-variable documentation without secrets.
- Create frontend routes/layouts, responsive navigation, design tokens, and accessible shared components.
- Apply the shared mobile-first requirements to the landing page, navigation, and shared components before extending layouts to larger screens.
- Establish server-only modules for business services, validation, configuration, and consistent error handling.
- Build the public landing page and clearly identified placeholder states for later screens. Protected business features remain unavailable until Phase 2.
- Select a deployment approach before deployment; keep service configuration separate from UI code.
- Apply baseline performance practices from the scaling phase: stateless servers, bounded data access, sensible assets, and observability hooks.

**Deliverables:** runnable application skeleton, shared UI foundation, public landing page, and documented configuration requirements.

**Completion checks:** relevant type/lint/build checks pass; the landing page and navigation work on desktop and mobile; no secrets are committed; future features are not presented as implemented.

**Mobile acceptance:** record the shared viewport checks, touch-menu behavior, readable content, and absence of page-level horizontal scrolling. Existing pending browser QA remains pending until verified; this plan update does not complete Phase 1.

## Phase 2 — Authentication, database and onboarding

**Goal:** establish trusted user identity and protected application data before marketplace features.

**Prerequisite:** Phase 1 complete; owner's Clerk and Supabase development configuration available when needed.

**Recorded dependency exception:** the owner explicitly authorized starting Phase 2 while Phase 1 browser QA is pending, and asked source development to continue while they configure the services. This does not mark Phase 1 complete. Phase 2 remains In progress until real integration and mobile verification pass. PR #2 remains unmerged; the current milestone is stacked on its reviewed source.

**Work:**

- Connect Clerk sign-up, sign-in, sessions, recovery, and protected routes.
- Configure the supported Clerk–Supabase integration and internal-user/Clerk-ID mapping described in the shared foundation.
- Create version-controlled migrations and access policies for users, brand/influencer profiles, social links, and controlled roles.
- Build onboarding and role-appropriate dashboard shells backed by real data.
- Add agreed image/file storage with explicit access, file-type, and size rules.
- Make onboarding safe to retry and verify/deduplicate any account synchronization webhooks.
- Establish separate development/production configuration and a migration/type-generation workflow.

**Deliverables:** working authentication, persistent profiles, onboarding, dashboard access, and protected storage if included.

**Completion checks:** new and returning users complete onboarding/sign-in; users cannot assign admin access or read/change another user's private records; direct Data API and storage access obey policies; retries do not create duplicate accounts.

## Phase 3 — Marketplace discovery and matching

**Goal:** let brands publish opportunities and influencers apply for suitable work.

**Prerequisite:** Phase 2 complete and selection/hiring rules agreed.

**Authorized sequencing exception (13 November):** the owner directed completion of Phases 3 and 4 while earlier credential-handoff/visual/device checks remain recorded. Continue application development without marking Phase 2 complete. Accepted Phase 0 hiring rules govern this implementation.

**Work:**

- Build profile editing and the agreed member-only profile views; public portfolios remain deferred.
- Add opportunity draft, publish, edit, and close flows with required work, deadlines, budget, and explicit currency.
- Add paginated discovery, basic filters, opportunity details, influencer applications, and brand review/selection.
- Add opportunity/application tables, indexes, constraints, RLS, and service-level authorization.
- Enforce agreed hiring limits and guard against duplicate applications or concurrent conflicting selection.
- Create the initial collaboration record on selection; mutual agreement and delivery are completed in Phase 4.

**Deliverables:** complete publish → discover → apply → select journey.

**Completion checks:** two distinct accounts complete that journey; private applications remain private; invalid transitions, duplicate applications, and conflicting selections are rejected; list results are bounded and paginated.

## Phase 4 — Collaboration workspace and completion

**Goal:** let matched users agree on and complete promotional work during a non-payment pilot.

**Prerequisite:** Phase 3 complete and agreement/revision/cancellation rules agreed.

**Work:**

- Record mutually accepted deliverables, budget/currency, deadline, and revision expectations with preserved agreement history.
- Add participant-only discussion threads, submissions, feedback, revision requests, approval, and progress tracking.
- Add basic in-app notifications and required message/deliverable/submission tables and policies.
- Add admin review of reports and an audit trail for important state changes and interventions.
- Display explicit non-transactional pilot labels; approval never implies money was collected or paid.
- Implement cancellation/reporting behavior agreed in Phase 0; no automatic financial consequences exist in the pilot.

**Deliverables:** usable collaboration workspace and basic support/admin flows.

**Completion checks:** participants agree on work, submit, revise, and approve it; outsiders cannot read messages or files; unauthorized state changes are rejected; changes to terms cannot silently overwrite accepted commitments.

## Phase 5 — Pilot deployment, verification and feedback

**Goal:** validate the complete collaboration journey with invited users in Sri Lanka before real payments.

**Prerequisite:** Phase 4 complete and pilot hosting/support arrangements selected.

**Work:**

- Configure the agreed host and production service accounts, environment isolation, error monitoring, request/upload limits, and basic abuse protection.
- Verify database backup/restoration and document basic support and incident procedures before users depend on the service.
- Run the full journey with separate brand, influencer, and admin accounts; check responsive behavior and accessibility.
- Prioritize phone-based pilot sessions. Verify the complete mobile journey in Android Chrome and iPhone Safari, including authentication, forms with the virtual keyboard, file selection, messages, and submissions; record device/browser versions and any emulation limitations.
- Invite the agreed pilot cohort, observe completion/failure points, and collect feedback.
- Measure latency, error rate, query performance, connection usage, storage, and cost against Phase 0 targets.
- Prioritize fixes and document the pilot findings and remaining launch risks.

**Deliverables:** deployed private pilot, verification evidence, feedback summary, and prioritized follow-up work.

**Completion checks:** invited users can complete the journey below; material authorization/data-loss defects are resolved; owner reviews pilot results; payment messaging remains explicitly non-transactional. Do not infer payment-launch approval from pilot completion.

### Pilot journey and data reference

The pilot validates the core collaboration journey without collecting or paying out money.

1. A user signs in and completes brand or influencer onboarding.
2. A brand creates a draft opportunity with deliverables, deadlines, budget, and currency, then publishes it.
3. An influencer browses opportunities and applies.
4. The brand reviews applications and selects an influencer.
5. Both parties confirm the deliverables, budget, deadline, and revision expectations; preserve the accepted agreement rather than silently changing it later.
6. Participants discuss work in a simple thread and submit content links or permitted attachments.
7. The brand requests a revision or approves the submission; participants can track progress.
8. Administrators can review reported problems and record interventions.

Clearly label pilot budgets and payment statuses as non-transactional. Never imply that funds have been collected, secured, or paid. Pilot completion does not mean payment completion.

### Initial data concepts

| Concept | Purpose |
| --- | --- |
| Users and profiles | Clerk mapping, controlled role, brand or influencer information |
| Social links | Declared platform/profile URLs, with verification status if applicable |
| Opportunities | Brand owner, description, status, budget/currency, expected work |
| Applications | Influencer interest and brand decision; prevent duplicate applications |
| Collaborations | Accepted agreement, participants, deadlines, lifecycle state |
| Deliverables and submissions | Expected outputs, submitted evidence, feedback and approval |
| Messages and notifications | Participant discussions and unread/actionable updates |
| Reports and audit events | Support issues and important administrative/state changes |

Model an opportunity as potentially supporting multiple collaborations, while starting the UI with a simple selection flow. Confirm hiring limits before implementation.

Keep opportunity, application, collaboration, and payment states separate. Define allowed transitions and who may trigger them before building the related module.

### Deferred features

- Real collection and creator payouts until the pilot has been validated and payment rules agreed.
- Automated social metrics, OAuth account connections, and campaign growth charts until data access is confirmed.
- A simple public influencer portfolio as a later milestone; a full website builder remains an open product decision.
- Team accounts, advanced matching, subscriptions, multilingual UI, and international rollout until separately prioritized.

## Phase 6 — Real payment collection and creator payouts

**Goal:** introduce reliable payments only after validating the pilot and operating model.

**Prerequisite:** Phase 5 validated; owner agrees payment/business rules and authorizes this phase. Provider selection and sandbox work precede live transactions.

**Work and provider requirements:**

Provider: **not selected**. First assess providers that can support the actual Sri Lankan business entity, brand collection, creator payouts, settlement currencies, and intended marketplace model. Do not assume a standard checkout integration also supports marketplace payouts.

Before selecting a provider, decide:

- Who pays whom, when brands are charged, and what allows a payout.
- Whether platform commission, subscriptions, or another business model applies.
- Cancellation, revision, dispute, refund, failed-payment, and chargeback handling.
- Provider onboarding, identity verification, invoicing, and tax responsibilities relevant to the chosen operating model.
- Whether any proposed delayed release of funds is supported by the provider and permitted for this business. Do not describe the product as escrow without establishing that arrangement.

Implementation requirements for that milestone:

- Use hosted/provider-managed payment collection; keep card details out of our application.
- Store provider references, exact monetary amounts in the currency's minor units, currency codes, and a durable financial event history.
- Verify webhook signatures; process retries and duplicate/out-of-order events safely.
- Use idempotency keys and database constraints to prevent duplicate financial actions.
- Treat verified provider state and reconciliation as authoritative, rather than the browser's success redirect.
- Keep collaboration approval distinct from collection and payout states.
- Test success, failure, refund, payout failure, retry, and dispute paths in the provider's sandbox before enabling live transactions.

**Deliverables:** selected provider with documented Sri Lankan collection/payout support, approved payment rules, sandbox integration, operational reconciliation, and tested failure recovery.

**Completion checks:** collection, payout, failure, refund, duplicate/reordered webhook, retry, and dispute paths pass; financial records reconcile with the provider; support procedures are ready. Enable live transactions only within the owner's explicit authorization.

## Phase 7 — Product growth: portfolios, integrations and reporting

**Goal:** add the most useful product extensions identified by pilot feedback.

**Prerequisite:** Phase 5 findings and owner-selected feature scope. Phase 6 is required only for features that depend on live payments.

**Work:**

- Prioritize a simple public influencer portfolio; separately decide whether a fuller website builder is justified.
- Evaluate social platforms individually for approved account connections, permissions, usable metrics, and data refresh limits.
- Implement only supported integrations, with appropriate token protection and reliable refresh/retry handling.
- Add campaign reporting with clear metric definitions, timestamps, and missing-data indicators. Reach must not be presented as proof of sales.
- Add email or real-time notifications only when selected; choose the provider and delivery/retry model at that point.
- Consider teams, matching improvements, or subscriptions only through explicit scope decisions.

**Deliverables:** the selected growth features with documented data sources and limitations.

**Completion checks:** each selected feature works end to end, respects privacy/access controls, and reports only available data. Deferred ideas remain deferred rather than blocking this phase indefinitely.

## Phase 8 — Redis and evidence-driven scalability

**Goal:** improve measured performance and reliability while keeping the architecture manageable.

**Prerequisite:** usable operational measurements and an identified bottleneck. May move earlier through a recorded scope decision; there is no requirement to finish all growth features first.

**Work:** diagnose the bottleneck, choose the smallest effective change, and apply the relevant options below. Redis, workers, search services, and replicas are conditional choices, not mandatory purchases.

### Baseline requirements — apply from Phase 1 onward

- Use indexed, paginated queries; avoid unbounded result sets and fetching full datasets to filter in the browser.
- Keep application hosting and the primary database geographically close, subject to provider availability and data-location needs.
- Use supported connection pooling when direct Postgres connections are introduced; measure connection pressure.
- Serve files through object storage and public/static assets through appropriate CDN caching.
- Cache public content deliberately. Keep private, user-specific data isolated from shared caches.
- Record request latency, error rate, slow queries, connection usage, storage growth, and service costs.
- Apply request/upload limits and basic abuse protection before exposing the pilot publicly. A Redis-based limiter can come later; initial protections must still work across deployed instances where necessary.

### Redis implementation scope

Candidate uses are frequently requested public opportunity results, short-lived aggregates, and distributed rate limiting. Redis is a performance/coordination layer; durable product and payment state stays in Postgres.

Before introducing a cache:

1. Measure the slow endpoint and fix avoidable query/index problems first.
2. Define keys, user/tenant scope, TTL, invalidation on writes, and acceptable staleness.
3. Define an outage policy: read caches may fall back to bounded database reads; security-sensitive limits need an explicit safe failure policy.
4. Track hit rate, response time, stale results, memory, and cost to verify the cache helps.

Choose a managed Redis-compatible provider and hosting region at that milestone. Do not select or provision one now.

### Other scaling options

| Evidence | Next step to evaluate |
| --- | --- |
| Slow reads after query improvements | Selective caching, precomputed aggregates, or database capacity changes |
| Long-running imports, notifications, or reconciliation | Durable queue and workers with retries, idempotency, and failure inspection |
| High message traffic | Scoped real-time delivery with participant authorization |
| Search exceeds indexed Postgres capabilities | Dedicated search service |
| Sustained database pressure | Query/capacity tuning, then read replicas for suitable non-critical reads |
| Independent workloads need separate scaling | Extract those modules into workers/services while keeping the core app simple |
| Expansion to other countries | Validate providers, currencies, localization, time zones, and data requirements before rollout |

Set a realistic pilot workload and latency/error targets before performance tests. Scale against observed bottlenecks rather than an assumed future audience size.

**Deliverables:** baseline measurements, implemented changes, documented cache/job behavior where applicable, and before/after evidence.

**Completion checks:** representative load tests meet the agreed targets; private data remains isolated; cache outages and job retries behave as designed; cost and performance show a useful improvement. If no scaling change is justified, record that conclusion and defer implementation.

## Phase 9 — International expansion

**Goal:** expand beyond Sri Lanka through deliberate country-specific rollout.

**Prerequisite:** stable Sri Lankan operations, an owner-selected target market, and applicable payment readiness from Phase 6.

**Work:**

- Validate payment collection, creator onboarding/payouts, settlement, fees, and business responsibilities for each target country.
- Add required currencies and exact amount handling without assuming all currencies use the same number of minor units.
- Define language/localization, time-zone display, regional support, and applicable privacy/data-location requirements.
- Revisit hosting regions and capacity using actual demand; avoid premature multi-region database complexity.
- Pilot the target country before a wider launch.

**Deliverables:** country readiness checklist, tested regional flows, and staged rollout plan.

**Completion checks:** representative users in the target market complete the intended journey, regional payment/support arrangements are verified, and the owner authorizes that market's release.

## Phase completion record

When phase work is authorized, append a short record for each phase:

- Phase and status.
- Delivered scope and relevant file/schema changes.
- Checks run and their results.
- For UI changes: mobile viewport/device/browser evidence, touch and accessibility checks, and any outstanding mobile issues.
- Decisions made, accepted assumptions, unresolved issues, and blockers.
- Owner-authorized next scope; do not treat a suggested next step as authorization.

### Phase 0 initial planning record — 11 November 2026 (superseded by acceptance below)

- Status: **In progress — parent review complete; owner acceptance pending**.
- Authorized scope: Phase 0 planning only. Prepared [phase-0-pilot-scope.md](phase-0-pilot-scope.md) and updated this plan; the product vision is unchanged.
- Deliverables: concrete proposed private-pilot scope, UI/navigation direction, minimum fields, permissions/visibility, opportunity/application/collaboration lifecycle, selection/cancellation/revision rules, files/notifications, target operating envelope, numbered acceptance decisions, and deferred decisions assigned to later phases.
- Checks: read the full plan and vision; checked repository/ancestor `AGENTS.md` locations (none found); parent reviewed the full proposal and plan diff for phase boundaries, lifecycle consistency, member/private-data access, and non-payment wording. Corrected acceptance to follow the owner's PR merge workflow and clarified competing applications during reservation/expiry. Final whitespace, local Markdown link, and UTF-8 checks passed; no application tests apply to this documentation-only change.
- Decisions: existing confirmed stack and Sri Lanka/private-pilot direction retained. D01–D10 in the scope proposal remain **Pending**; no suggested default has been accepted by inference.
- Remaining: owner acceptance (by merging this acceptance PR or explicit message) or amendments; record the actual decision/reference at the next authorized documentation update. Phase 1 still requires an explicit instruction. Deferred provider/privacy/support choices are due at the phases stated in the proposal.
- Workflow: same implementation agent where available; parent reviews before PR; owner alone merges `main`; later phases require owner authorization. Agent handoff identity/configuration is recorded above and in the proposal.
- Next authorized scope: finish review and revisions of Phase 0 documents only. No application code, accounts, credentials, services, deployment, or later phase is authorized by this record.

### Phase 0 acceptance record — 11 November 2026

- Status: **Complete**. Owner merged [PR #1](https://github.com/Ronath1/creator_connect/pull/1) at 13:44:08 UTC; merge commit `560fd03b70c9aa2cda39211d5eccca1c68aae2c6`.
- Accepted scope: final pilot proposal and D01–D10, with remaining service/operational decisions deferred to their documented phases.
- Separate next-scope authorization: owner explicitly instructed “let the subagent know to start work on phase 1”. Same implementation agent resumed. No Phase 2 authorization.

### Phase 1 implementation record — 11 November 2026

- Status: **In progress**. Application/UI foundation delivered; parent source review and executable checks complete. Desktop/mobile browser verification is unavailable in the current environment and is not claimed complete.
- Delivered scope: root Next.js/TypeScript/Tailwind app, landing page and responsive shared navigation/tokens/components; allowlisted unavailable routes; error/loading/404 states; server-only configuration, bounded validation, safe errors, and documented service boundary; README and environment example without credentials.
- Scope exclusions: no Clerk/Supabase integration, business forms/actions, stored users/records, payments, service provisioning, or deployment. The public unavailable screens do not grant access to protected features.
- Validation: parent ran successful clean install, lint (zero warnings), formatting, strict types, and production build (15 static pages). Production HTTP checks passed for landing/11 future routes, icon and unknown/nested/prototype-like 404 paths; internal anchor targets resolve and there are no forms. Parent review corrections addressed small-text contrast, illustration semantics, PostCSS export and error-page navigation. See [Phase 1 verification](docs/phase-1-verification.md) for evidence and limitations.
- Dependency limitations: production audit found zero vulnerabilities; eight moderate development lint-chain advisories remain upstream. Compatible ESLint 9 is deprecated; ESLint 10 currently conflicts with Next lint-plugin peers. No forced major override or unrelated framework downgrade was applied.
- Remaining: actual 360/390/768/1280 px layout, keyboard focus, and mobile-menu browser verification before declaring Phase 1 Complete. Parent reported no browser surfaces and `iab` creation failure; source/HTTP review does not replace visual interaction evidence. Owner alone merges the implementation PR. Phase 2 was subsequently authorized separately with this gap still open, as recorded below.

### Phase 2 integration-source milestone — 11 November 2026

- Status: **In progress**. Owner explicitly authorized Phase 2 and continuation without keys during configuration. Same implementation agent resumed; parent must review every delivered milestone before a PR, and the owner alone merges `main`.
- Base/dependency: `feat/phase-2-auth-onboarding` is stacked on the unmerged Phase 1 source (PR #2), including the owner's mobile-first plan update. Phase 1 browser checks remain pending; this is an authorized sequencing exception, not a completion claim.
- Source delivered: real Clerk SDK/provider/proxy/sign-in/sign-up controls; current-session Supabase client; controlled membership gates; own-profile services and idempotent security-invoker onboarding RPCs; mobile-first form/dashboard/profile source; fail-closed missing-configuration states. No mock authentication or service-role key is used.
- Database/testing: CLI-generated versioned migration with explicit grants/RLS and ownership/role/status checks; parent ran all 16 isolated SQL/RLS and form-validation tests successfully. Parent identified the owner's dedicated development project, applied the reviewed migration, confirmed all four tables have RLS, received no security-advisor findings, and generated real database types now used by the client/services.
- Validation: final clean install passed (406 packages, about 46 seconds), then all 16 tests, lint (zero warnings), formatting, strict types and production build passed under parent execution with development configuration. The build has 11 static pages plus dynamic auth/member routes. The hosted migration ledger was aligned to the CLI-created local version without changing schema; generated types and security advisors passed. Production dependency audit: zero findings.
- Runtime/review corrections: parent traced the configured public-page socket hang-up to Next/Clerk loopback hostname normalization and self-rewrite while listening only on `127.0.0.1`. Listening on `localhost` returned 200 immediately; scripts now use that loopback host without changing auth. Review also corrected parsed RPC payloads, social-row error indexes, preserved failure values, actual membership-status routing, Clerk touch-target sizing, bounded mobile auth UI and plain product copy. The Windows native-CSS DLL install lock was resolved by stopping the old workspace dev server before clean installation.
- Historical native integration issue (resolved 12 November): early tokens were missing the database role claim, then correctly signed tokens were rejected with 401 / `PGRST301`. The parent stopped blind retries and requested owner confirmation of native provider settings. The following resumed record supersedes that blocker; no token bypass or mocked identity was introduced.
- Remaining at the initial milestone: full account/browser flows, protected profile-image storage and mobile/device evidence. The subsequent record updates live integration results. Parent reviews every phase/milestone and fixes findings before a PR; the owner reviews and alone merges `main`. Phase 2 remains In progress.
- Evidence and next work: [setup](docs/phase-2-setup.md) and [verification](docs/phase-2-verification.md). Finish source review/checks and approved development integration as configuration becomes ready. No Phase 3 or live-pilot invitation scope is authorized.

### Phase 2 resumed native integration verification — 12 November 2026

- Status: **In progress**. The owner explicitly resumed Phase 2 and requested confirmation of setup. Phase 3 remains unauthorized; Phase 1/2 milestone PRs remain unmerged drafts.
- Resolved setup blocker: after owner confirmation of native settings, a fresh real Clerk token with `role: authenticated` was accepted by Supabase with HTTP 200. An uninvited identity correctly read zero membership rows. The previous `PGRST301` failure is resolved rather than an active blocker.
- Hosted verification: parent ran 11 successful checks using only three scoped synthetic development memberships. Brand, creator and administrator read only their own membership; brand/creator onboarding RPCs persisted and remained repeat-safe; cross-profile/social reads were denied; role escalation, ownership reassignment and wrong-role RPCs were denied; administrators had no broad profile access; invalid social data rolled back the multi-table save.
- Authenticated application/suspension evidence: 11 HTTP route checks passed with real Clerk bearer tokens. Brand/creator dashboard, profile and onboarding rendered their own workspace; administrator dashboard was scoped and profile/onboarding redirected to dashboard; uninvited dashboard redirected to a correct access-pending page. After all three synthetic memberships were suspended, three hosted checks passed: own suspended status remained visible, profile/social queries returned zero rows, and dashboard redirected to access-restricted with no workspace data. All fixtures remain suspended and all check sessions were revoked.
- Runtime verification note: the first HTTP attempt could not connect because no dev server was running. Parent started the existing local application at `http://localhost:3000` and reran the checks successfully; no code fix or auth bypass was needed.
- Browser availability update: IAB became available on 12 November and the parent opened the actual local application DOM. Browser verification is in progress at 360/390/768/1280 px with keyboard and real account/form flows. The 11 November unavailable-browser notes are historical; no visual/interaction pass is claimed until results are recorded.
- Local verification: same implementation agent reread the current plan, root `AGENTS.md` and relevant installed Next guidance. All 16 isolated tests, lint (zero warnings) and formatting checks passed again without source changes.
- Remaining: authenticated application/browser/recovery flow evidence, protected profile-image storage and its direct API tests, and mobile/device QA at 360/390/768/1280 px and Android Chrome/iPhone Safari. No completion is inferred from hosted RPC results. Continue within Phase 2 with parent review before every PR; the owner alone merges `main`.

### Phase 2 optional profile-image milestone — 12 November 2026

- Status: **In progress**, stacked on unmerged authentication milestone PR #3. The owner resumed the historical pause with “ok continue the work”. Phase 3 remains unauthorized; parent reviews every milestone before a PR and the owner alone merges `main`.
- Implemented: optional profile photo/logo on saved profiles; actual private Storage upload/upsert/remove at a single internal-UUID path; active brand/creator ownership policies; JPEG/PNG/WebP signature/decode checks, 5 MiB/16 MP limits, 1024 px WebP normalization and metadata removal through Sharp 0.35.5. Authenticated delivery revalidates stored bytes, checks current metadata and uses a version cache nonce. No app-issued public/signed image URL or privileged request key is used.
- Schema/local evidence: reviewed CLI migration `20261112040650_phase_2_profile_images` was applied to the dedicated development project, its ledger aligned, and security advisors returned no findings. Six actual image-processing and seven isolated Storage/RLS tests join the core 16: 29 tests passed. Targeted types/lint passed after endpoint/UI refinements; final full checks remain due.
- Hosted evidence: nine Storage cases and five image-endpoint cases passed. Active creator own upload/read/application GET/remove/re-upload also passed. Suspending that creator caused metadata/read/write/delete denial and application 403, while trusted SQL confirmed denied deletion preserved its object. Immediate cached raw byte downloads are not absence evidence; metadata/object rows and application 404 verify removal.
- Browser image evidence: real brand cookie-authenticated picker upload, replacement, refresh persistence, server rejection of forged image bytes with old preview retained, native blocking of a 5 MiB + 1-byte selection, and removal despite that invalid selection all passed. Image controls had no overflow at 360/390/768/1280 px; input rendered at 16 px and 71 px high. This is browser/DOM evidence, not physical-device or screenshot visual inspection.
- Compatibility correction: removed four redundant `.cl-*` descendant selectors, preserving sizing through supported Clerk `appearance.elements`. A fresh tab reported zero structural-CSS pinning warnings and the hydrated trigger measured 44 × 44 px. No UI package upgrade/deprecated version prop was added. Added the installed Next 16 guide's supported `data-scroll-behavior="smooth"` attribute for the existing smooth-scroll CSS warning.
- Creator/account browser evidence: real OTP first-run onboarding, mismatched URL error with preserved draft, corrected save and persisted profile/social link, reopened form values and image removal/reload passed. No overflow at 360/390/768/1280 px and 844 × 390 landscape; field/select/details/save/add/account sizes and keyboard Tab/Enter checks passed. Brand/creator sign-out plus direct dashboard navigation returned to sign-in; account/security/device controls were visible.
- Cleanup/review: all three exact synthetic memberships are suspended, Clerk backend active sessions are zero, Storage objects are zero and browser viewport is reset. Fresh security advisors returned no findings. Parent source/security review completed with no remaining findings. Final required checks passed: 29 tests, lint with zero warnings, formatting, generated route types/strict TypeScript and production build (11 static pages plus dynamic account/image routes). The image milestone is **Ready for review**, with parent final record review/PR creation next.
- Remaining: owner handoff for fresh signup/password creation/reset (none performed), screenshot visual inspection, physical Android/iPhone, virtual keyboard and zoom verification. See [the image milestone](docs/phase-2-profile-images.md). Full Phase 2 remains In progress; no Phase 3 or merge authorization is inferred.

### Phase 3 marketplace implementation — 13 November 2026

- Status: **Ready for review — implementation/checks delivered**, with overall phase review pending. The owner explicitly instructed finishing Phases 3 and 4 first, then moving to Phase 5. Current branch `feat/phase-3-marketplace` is stacked on the unmerged Phase 2 image head; earlier manual/visual/device gaps remain. Parent review and PR are required for each phase/milestone, and the owner alone merges.
- Delivered so far: member-safe profile projection and private avatar reads; own profile editing; opportunity drafts, publication, history, correction, close/reopen, bounded filtered discovery; private applications, withdrawal/rejection/selection; transactional one-slot reservation and pending agreement snapshot for Phase 4. Actual agreement confirmation, discussions, deliveries, notifications and support remain Phase 4 scope.
- Database: parent reviewed/applied three CLI migrations (marketplace schema, hosted executor permissions repair, business-conflict status repair), aligned hosted ledger versions and generated real types. No ordinary privileged request key or direct lifecycle DML is used. All private entrypoints independently check current verified identity, active complete membership and authorization; internal helpers are not caller-executable. Parent checked actual hosted ACLs and security advisors, not only isolated superuser behavior.
- Final checks: all 49 local tests, zero-warning lint, formatting, generated route types/strict TypeScript and production build passed after final corrections (8 static pages plus dynamic routes). Parent hosted 14 core real JWT cases passed, including independently concurrent selection requests with one successful reservation and one rejection. Full evidence and known hosted differences are in [Phase 3 marketplace](docs/phase-3-marketplace.md).
- Lifecycle timing: successful reads/mutations reconcile expired opportunities/reservations/windows under opportunity locks; failed mutations roll back their reconciliation. This is traffic-driven until durable Phase 4 processing is implemented. Pending reservation preserves competing applicants; activation and delivery remain unavailable.
- Owner decisions: ClamAV selected for Phase 4 scanning; real daemon/clean/EICAR verification remains due. Hosting/provider changes are deferred at the owner's request despite available AWS access. Phase 5 may prepare readiness/test/operational documents first; deployment, invitations, spending, four-week feedback observation and a completed pilot cannot be inferred from that preparation.
- Browser/hosted follow-up: parent passed the complete two-account publish/discover/apply/select browser journey, locked-term correction/history and failed-input retention; actual member avatar delivery, cross-write/delete denial, MIME spoof and suspension checks passed. Detail DOM/touch checks passed at 360/390/768/1280 and 844×390 landscape. Source findings corrected native select resets and misleading unavailable reopen/select controls.
- Final review/cleanup: parent reports no material source/security findings. Zero profile-image objects; three exact synthetic opportunities hidden/archived with history; all five scoped memberships suspended; all six fixture identities have zero active Clerk sessions; browser sign-out/viewport reset and dev-server stop complete; fresh security advisors returned no findings.
- Remaining now: parent final record review and PR. Earlier fresh signup/password-reset handoff, screenshot/physical-phone/virtual-keyboard/zoom limits remain explicit. No Phase 4 implementation before parent Phase 3 review/PR, no Phase 6 authorization and no agent merge.

### Phase 4 implementation and resumed verification — 13–14 November 2026

- Status: **In progress**. Owner authorized progression after Phase 3 parent review/PR #5, explicitly paused on 13 November and resumed on 14 November. Source is stacked on the unmerged Phase 3 branch. Parent reviews every milestone before PR; the owner alone merges. Phase 5 readiness has not started.
- Delivered: immutable agreement versions/confirmations and mutually accepted amendments; stable item/revision usage; participant messages, full-item versioned submissions, feedback/revisions/explicit approval; pending and mutual/admin-case cancellation; reports, reasoned assigned-case private access, fixed-role membership controls and audit; recipient notifications, polling and durable expiry/reminder/event jobs. Protected responsive workspace, report and administrator screens replace public placeholders.
- Files: real private ClamAV client, current-signature/branch checks, original/prepared-byte scanning, image metadata removal, private quarantine/promotion and worker-only finalization. Only the narrow server-only attachment module uses its separately revocable privileged credential; ordinary domain actions remain user-JWT scoped. No ordinary Storage bucket read/write policies or public/signed file capabilities are granted. Byte/hash/current authorization is checked on delivery.
- Race/retry controls: fixed UUID paths, immutable linked evidence, double pending quota charge, finalized-clean-only user discard, 24-hour grace for uncertain writes, physical-absence-confirmed quota release, durable exclusive cleanup claims and fair retry/backoff. Incoming binary bytes and whole upload lifetime are bounded. The worker CLI is provided; production supervision/hosting remains deferred.
- Reviewed development migrations: core collaboration, durable jobs, upload lifecycle, case history/cadence and evidence/event projection. Parent applied/reconciled exact versions and generated real types. Actual private ACL/RLS and security-advisor checks passed; normal callers cannot attest clean files, invoke internal helpers or write lifecycle tables.
- Checks: current local suite has 76 passing cases and one opt-in real-daemon case skipped in that run; actual real-daemon clean/EICAR and denial cases passed separately. Zero-warning lint, formatting, generated route types/strict TypeScript and production build passed (4 static pages plus dynamic protected routes). Parent live JWT/concurrent quota, notifications, Storage/scanner/hash and HTTP route checks passed. Production browser/account-flow verification is underway; see [Phase 4 evidence](docs/phase-4-collaboration.md) and [operations](docs/phase-4-setup.md).
- Operations: 30-second database cron runs were observed succeeding and draining outbox. Unread polling does not refresh workspace forms; notification-list refresh is page-local. Cleanup CLI confirmed physical absence for explicitly aged synthetic reservations. These are development proofs, not a production release or pilot observation.
- Remaining: parent production browser review/corrections, final record review, scoped fixture/runtime cleanup and PR. Earlier credential-handoff, screenshot/physical-phone/virtual-keyboard/zoom gaps remain. Hosting, production isolation/restore, owner support/privacy acceptance and actual cohort/observation stay deferred to Phase 5 readiness/release decisions.

## Technical references

Checked for this planning draft; verify current SDK/version details when implementation starts:

- [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)
- [Supabase: Clerk third-party authentication](https://supabase.com/docs/guides/auth/third-party/clerk)
- [Clerk: Supabase integration and RLS](https://clerk.com/docs/guides/development/integrations/databases/supabase)
- [Supabase changelog](https://supabase.com/changelog.md)

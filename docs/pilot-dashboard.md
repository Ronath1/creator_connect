# Live private-pilot dashboard

Status: **Implementation independently parent-reviewed, source and native HTTP checks passed, 26 November 2026**. This closes a previously accepted screen-map gap: the [Phase 0 dashboard](../phase-0-pilot-scope.md#3-design-direction-and-screen-outline) called for current opportunities/applications and collaborations, but the implemented page still showed a generic start panel for every user. It does not add growth integrations or change payment/business policy. The Sri Lankan focus and the owner's deployment, provider, authenticated-load, browser/device and Phase 9 deferrals remain in effect.

## Behavior and bounds

- Brand dashboard: latest five **own opportunities** with current status, update date, application deadline where open and an appropriate edit/view link. Only an unrestricted draft offers “Continue draft”; published or restricted records offer view access.
- Creator dashboard: latest five **own applications**, their recorded state, related title, application date and view link. A selected application points to Collaborations without claiming the agreement is still pending. Hidden/missing related opportunities fall back to own application history instead of an inaccessible detail link.
- Both roles: latest five **participant collaborations** across all statuses, with title, participants, delivery date and role/stage-appropriate workspace links. Pending matches say to review current terms/confirmations in the workspace; they do not assume this user still needs to confirm. Submitted work points brands to review and creators to their submitted evidence; revision feedback and terminal records remain viewable without proposing invalid terminal actions.

Each populated section shows the actual displayed count and the RPC's **full-list total**, newest first, with a link to the complete paged list. These totals include all statuses; they are not global “active,” “urgent” or “action needed” counts. Older active/urgent records can be outside the latest five. This is a recent-record overview, not an exhaustive task queue. Zero-total sections show real first-action guidance without an older-work warning.

Administrator welcome/support navigation and the “Payments are not enabled” notice remain unchanged. No administrator domain-data RPCs were added. The existing authentication, active-membership and complete-onboarding gates still precede the role summaries. Shared card/button styles retain their existing responsive wrapping and minimum control sizes; no rendered visual pass is inferred from source.

## Data and failure boundaries

The server component starts independent role-list and collaboration reads with `Promise.all` after the existing profile/completion gate. It reuses only current user-token `marketplace_read` and `collaboration_read` RPCs. The two list service wrappers now accept an optional limit, defaulting to **20** as before; the dashboard explicitly requests five. Existing typed list parsing and the database's scope/limit enforcement remain authoritative.

There are no new tables, migrations, permissions, privileged keys, dependency/configuration changes, public metrics, notifications integrations or shared cache. The tiny pure link helper controls presentation only; it cannot authorize a mutation. Read failures propagate to the existing error boundary rather than being caught and disguised as zero activity. Existing lists/workspace actions continue to recheck current authorization and lifecycle state.

## Verification and handoff

Worker checks on 26 November passed:

- Targeted zero-warning ESLint for changed application/helper/test files.
- `npm run typecheck`, including generated Next routes and strict TypeScript.
- Focused Node test run: **23/23 passed**. Twenty actual SQL/RLS cases include the new dashboard regression with more than five opportunities/applications/collaborations, exact own totals, five-row bounds, a terminal cancelled collaboration, an unrelated complete brand's empty lists, wrong-role denial and unchanged default 20-item pagination. Three presentation-contract cases check restricted drafts, selected/hidden/historical applications and role/stage/terminal collaboration links. No JSX/source-grep tests were added.

Parent independent checks on 26 November passed:

- Full suite: **95 cases, 94 passed, one opt-in scanner skip, zero failures**. Whole-repository zero-warning ESLint and production build passed; Next 16.4.6 compiled and typechecked the updated route and retained four static pages plus protected dynamic routes. Worker route generation/strict typecheck had already passed.
- Actual production-mode HTTP with fresh Clerk sessions and ordinary native user-token RPCs: the brand saw five of nine own opportunities and five of eight participant collaborations; the creator saw five of nine own applications and five of seven collaborations. Each rendered record/workflow link matched its scoped RPC, with accurate full totals and private `no-store` responses. The second creator saw its own two applications/one collaboration; the empty brand saw zero records and first-action guidance without a count/older-record warning.
- The main creator's HTML omitted the rival creator's application IDs; the unrelated brand's HTML omitted the main creator's collaboration IDs. The administrator retained the support shell without member-summary sections. Backend credentials were absent from HTTP bodies.
- Anonymous, real-token uninvited and real-token suspended callers were redirected to their appropriate access routes without live dashboard sections. Next can stream those redirects with HTTP 200; tests verified the actual redirect outcome, not a 3xx-only assumption. The unchanged incomplete-onboarding gate was source-reviewed and covered by the existing suite; no new hosted incomplete-profile fixture was created.

These are nine focused HTTP check groups, not a browser interaction or load-test result. Source review confirms failed list requests propagate to the existing error boundary; no runtime dependency fault was injected. No browser attempt or rendered mobile/keyboard/screenshot claim is made under the owner's deferral.

Cleanup: seven own Clerk sessions revoked without failures; a final sweep confirmed no active sessions across the six scoped synthetic identities. All five memberships restored to suspended, zero published portfolios, unchanged core counts (nine opportunities, eleven applications, eight collaborations, three messages), and the preserved main journey still `revision_requested`. Production QA server 92760 was stopped. No scanner/cron or new business fixture was started/created. Parent helper outside Git: `creatorconnect-dashboard-http-20261126.cjs` in local TEMP; it reads ignored configuration, keeps tokens in memory and revokes its own sessions in `finally`.

Parent review/correction precedes the milestone PR; owner alone merges. Earlier Phase 4/5/7 verification and release gaps are not marked complete by this dashboard change.

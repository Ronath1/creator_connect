# CreatorConnect — Phase 0 pilot scope and design proposal

Status: **proposed; awaiting product-owner acceptance**. Prepared 11 November 2026.

This document makes Phase 0 reviewable. It does not authorize application code, accounts, purchases, provisioning, deployment, invitations, or Phase 1. Read it with [the development plan](plan.md) and [the product vision](brand-influencer-product-vision.md). The vision remains the long-term product direction; the pilot validates the collaboration journey before payments.

## 1. Confirmed direction and approval boundary

The owner has confirmed Next.js for frontend and backend, Clerk for identity, Supabase for application data, Sri Lanka as the first market, a private pilot before real payments, and a simple foundation that can evolve toward Redis when measurements justify it. Provider credentials will be connected when needed. CreatorConnect remains a working name.

Phase 0 planning is authorized. Every scope rule, number, design choice, and operational default below is a **recommendation awaiting acceptance**, unless explicitly identified above as confirmed. This PR asks the owner to accept D01–D10 and the final scope/design proposal, or request amendments. Under the owner's review-and-merge workflow, their merge of this explicitly scoped acceptance PR records acceptance of its final proposals; creating a PR or receiving no response does not. Record the actual owner decision or merge reference in the register and plan at the next authorized documentation update. Merge does not authorize Phase 1.

## 2. Proposed pilot boundary

Invite-only Sri Lankan brands and influencers use one marketplace role per account. Administrators are separately assigned trusted support users. There are no brand teams, role switching, public registration into the marketplace, or public discovery during the pilot. Clerk authentication alone does not grant pilot membership. An invited user must have active membership and complete onboarding before entering marketplace screens; a signed-in uninvited user sees an access-pending page.

The pilot includes brand and influencer profiles, basic opportunity discovery, applications, one hire per opportunity, mutual agreement, participant discussion, submissions, revisions, completion, in-app notifications, reports, and basic administrator support. Budget fields communicate proposed compensation in LKR, with an explicit currency field. They are informational: the pilot has no collection, payout, escrow, settlement tracking, commission, or payment-complete state. Any handling of real compensation outside the platform needs a separate owner decision and must not be represented as a platform transaction.

Later work retains the vision's payments, portfolios/websites, supported social integrations, and truthful campaign reporting. The pilot does not include automated social metrics, creator website building, ratings, direct unsolicited messages, real-time chat, email notifications, advanced recommendations, subscriptions, or international rollout.

### Pilot size, budget, and success hypotheses

| Measure | Proposed default | Review point |
| --- | --- | --- |
| Cohort | 5 brand accounts, 20 influencer accounts, up to 2 administrator accounts | Owner chooses and invites participants in Phase 5 |
| Observation window | 4 weeks after pilot readiness is verified | Extend only after reviewing unresolved failures |
| Activity goal | 10 published opportunities, 8 mutually accepted collaborations, 6 completed collaborations | Learning goals, not launch guarantees; cancelled work remains visible in results |
| Feedback | At least 3 brands and 10 influencers provide structured feedback | Assess agreement clarity, completion friction, and willingness to return |
| Service budget ceiling | LKR 15,000/month total recurring hosting, database, identity, storage, and monitoring | Owner accepts ceiling; compare actual provider estimates before provisioning |
| Exclusions from service ceiling | Development labor, advertising, creator compensation, and payment fees | No spending is authorized by this proposal |
| Cost response | Review estimated cost before adding a service; pause cohort expansion if projected monthly cost exceeds ceiling | No automatic paid upgrades |
| Product support | Owner nominates a pilot support contact and reviews reports each working day | Required before invitations; no round-the-clock promise |

The budget is a planning allowance, not a researched provider quote. Availability, tax, billing currency, exchange rates, and provider pricing must be checked when deployment choices are made.

## 3. Design direction and screen outline

Recommend TypeScript, Tailwind CSS, accessible shared components, and an English pilot UI. Keep user-entered Sinhala/Tamil text intact; full interface translations remain deferred. Recommend a calm, practical workspace: warm off-white page background, white surfaces, dark slate text, teal primary actions, and amber attention states. Suggested tokens are background `#F7F8FA`, surface `#FFFFFF`, text `#172B3A`, primary `#0F766E`, and border `#D8E0E6`. Validate actual text/background contrast during Phase 1; status always has a written label and never relies only on color. Use the system sans-serif stack initially, an 8 px spacing rhythm, modest rounded corners, and restrained shadows.

Desktop uses a compact header with the working wordmark, role indicator, notifications, and account menu; signed-in screens have a left navigation rail and a bounded content region. Mobile uses a header and labelled navigation menu, stacked cards, and full-width primary actions. Avoid hover-only actions. Forms have persistent labels, inline errors, and a summary for failed submission. Support keyboard operation, visible focus, readable zoom, and reduced motion, targeting WCAG 2.2 AA during implementation.

| Surface | Screen content and primary action | Access / delivery phase |
| --- | --- | --- |
| Landing | Explain Sri Lanka private pilot, two role value propositions, collaboration steps, explicit payment limitation; primary action “Sign in”; invitation interest handled by the owner outside this app | Public / Phase 1 |
| Sign-in and access status | Clerk sign-in; show access pending, suspended, or onboarding-required state without exposing invite records | Phase 2 |
| Onboarding | Role fixed by invitation; required profile fields, review, save and continue | Invited active user / Phase 2 |
| Dashboard | Next actions, current applications or opportunities, active collaborations; empty states explain first action | Role-specific shell Phase 2; live modules Phases 3–4 |
| Opportunities | Search title/description; filter category and social platform; show title, brand, budget/currency, application deadline, and status; primary action view details | Active pilot members / Phase 3 |
| Opportunity detail | Brief, deliverables, eligibility, application and delivery dates, revision allowance, budget label; influencer applies, brand owner manages | Active members; private applications only to their owners / Phase 3 |
| Brand opportunities | Draft/open/closed list; creation/edit form; applicant list with profile and proposal; primary action select influencer | Owning brand / Phase 3 |
| My applications | Status, submitted proposal, opportunity link, withdraw where allowed | Applying influencer / Phase 3 |
| Profile | Display name, description, location, categories and declared social presence; own profile edit | Members / Phases 2–3 |
| Collaborations | Status and due-date list; workspace has Overview, Discussion, Deliveries, and History tabs | Participants / Phase 4 |
| Agreement panel | Side-by-side readable terms summary, version, confirmations, and “Confirm agreement” action | Participants / Phase 4 |
| Delivery panel | Checklist, submission links/files and notes, review feedback; approve or request revision | Participants / Phase 4 |
| Notifications | Event, time, unread state, link to authorized record; mark read | Recipient / Phase 4 |
| Report form | Category, explanation, related record; confirmation and report status | Active members / Phase 4 |
| Admin | Membership, report queue/detail, account restrictions, recorded interventions and audit history | Assigned administrators / Phase 4; membership control required in Phase 2 |

Brand navigation: Dashboard, My opportunities, Collaborations, Notifications, Profile. Influencer navigation: Dashboard, Discover opportunities, My applications, Collaborations, Notifications, Profile. Admin navigation: Overview, Members, Reports, Audit history. Reports and support are also reachable from the account menu and collaboration workspace.

Example desktop workspace: header → page title and status → next-action banner → tabs → main content with a compact agreement/deadline summary alongside. On mobile the summary comes first, followed by the action and tab content. Use explicit dates with Sri Lanka time (`Asia/Colombo`) and a visible time-zone label at deadline entry and confirmation.

Phase 1 implements only the landing page, navigation/layout, tokens, shared components, and clearly labelled unavailable states for future routes. No functional pilot dashboards, fake authentication, fabricated metrics, or simulated successful business actions are implied by those placeholders. Authentication screens are wired in Phase 2.

## 4. Roles, permission boundaries, and visibility

All permissions below must ultimately be enforced on the server and through database/storage policies, not just by hidden buttons. Suspension blocks marketplace access and writes, retains evidence, and gives the user a support path. Account recovery remains Clerk's responsibility. Role and membership changes are administrator-controlled and audited; no self-assigned administrator access.

| Action / data | Visitor or nonmember | Influencer | Brand | Administrator |
| --- | --- | --- | --- | --- |
| Public landing | Read | Read | Read | Read |
| Member profiles and published opportunities | No | Read | Read | Read for support |
| Own profile | No | Read/edit own | Read/edit own | Restrict or hide with reason; no impersonation |
| Opportunity drafts and applicant lists | No | No | Own only | Support access with recorded reason |
| Publish/edit/close opportunity | No | No | Own, within lifecycle rules | Hide/close for moderation with reason |
| Application | No | Submit/read/withdraw own | Read/decide applications to own opportunity | Support access with reason |
| Selection and agreement | No | Confirm own terms; decline own pending match | Select for own opportunity; confirm terms | No confirming on behalf of a party |
| Discussion/submission/files | No | Own collaborations only | Own collaborations only | Case-related support access with reason |
| Request revision / approve | No | No | Own collaboration, within agreed rules | No ordinary approval on behalf of brand |
| Notifications | No | Own only | Own only | No general notification-inbox browsing |
| Reports | No | Create; read own report status | Create; read own report status | Review, investigate, record resolution |
| Membership, suspension, audit | No | No | No | Manage assigned support functions; audited |

Administrators can resolve a stalled cancellation or moderate harmful records with an explicit reason and participant notification. Their intervention is labelled as an administrator action, never as mutual acceptance or brand approval. Support access is bounded to the relevant case, and access/intervention history is recorded.

Member-visible fields: display/brand name, avatar, bio, Sri Lankan location at city/district level, content categories, social links, and declared metrics labelled “self-reported.” Private fields: authentication identifiers/email, membership records, private contact information, drafts, applications, collaboration terms/messages/files, reports, and administrative notes. Applicants do not see competing applications. No exact home address, government ID, bank details, or card information is collected in the pilot. The Clerk account email is used for identity; it is not displayed to other members.

Required brand profile: display/brand name, description, city/district, and category. Website and logo are optional. Required influencer profile: display name, bio, city/district, categories, and at least one social-profile URL with platform. Avatar and follower count are optional; count must have an “as of” date and self-reported label. Recommend declared links for Instagram, YouTube, TikTok, Facebook, and X, without OAuth or verification badges. No claim that a link or follower count has been verified.

## 5. Opportunity, application, and hiring rules

An opportunity requires title, promotion brief, category, supported social platform(s), at least one deliverable with format/quantity, proposed budget and currency, application deadline, delivery deadline, and revision allowance. Proposed limits: 1–10 deliverable items, positive budget, LKR only in the pilot, application deadline in the future, and delivery deadline after it. Publishing makes the current brief visible to active members; all writes validate deadlines on the server.

One opportunity has one available hiring slot in the pilot, while the conceptual model continues to allow multiple collaborations later. Each influencer has at most one application record per opportunity; withdrawal does not permit reapplication. No open-ended negotiation is implied by an application. The proposal records a short suitability statement and optional relevant work URLs; no application file uploads. Only open, unexpired opportunities accept applications, and only active members with complete profiles can apply.

Selecting an applicant atomically reserves the slot and creates one pending-agreement collaboration. It closes the opportunity to new applications. Other pending applicants remain pending until agreement activation; activation marks them not selected and notifies them. If the selected match declines, expires, or is cancelled before activation, release the reservation; the brand may explicitly reopen before the application deadline and select a still-pending applicant. Existing completed or active collaborations never lose their relationship to the original opportunity. For a new hire after an active collaboration is cancelled, create a new opportunity in this pilot.

After applications exist, edits to the published brief are limited to non-material corrections, recorded in history and notified to applicants. Changes to budget, deliverables, deadlines, eligibility, or revisions require closing and creating a replacement opportunity. A pending collaboration can still negotiate its own agreement independently; the final agreement is explicit and both parties must confirm it. Selection, activation, reopening, and competing requests must enforce slot/uniqueness constraints transactionally.

### Opportunity state transitions

| From → to | Actor / trigger | Conditions and effect |
| --- | --- | --- |
| Draft → Open | Owning brand publishes | Required fields/deadlines valid; membership active |
| Draft → Draft | Owning brand edits | Not discoverable; unused draft may be deleted |
| Open → Closed | Brand closes; selection; application deadline; administrator moderation | Record reason: manual, selection, deadline, or moderation; block new applications |
| Closed → Open | Owning brand | Deadline still future, no active/completed match, no reserved slot or moderation restriction |

Closing an opportunity does not cancel its collaboration. If closure is manual or by deadline and no slot is reserved, the brand may select existing pending applicants within 7 days of closure if the proposed delivery deadline is still future. While a pending agreement reserves the slot, competing applications remain pending and this selection-window expiry does not reject them. If that pending match ends before activation, a fresh 7-day window starts at reservation release, bounded by the opportunity's delivery deadline, to select a still-pending applicant. If the brand explicitly reopens before the application deadline, normal open-opportunity rules resume. With no reservation, expiry of the applicable closed-opportunity selection window marks remaining applications not selected. Activation immediately marks competitors not selected. Moderated opportunities cannot be selected while restricted. Drafts with no related records can be deleted; published records are archived/hidden rather than hard-deleted during the pilot.

### Application state transitions

| From → to | Actor / trigger | Conditions and effect |
| --- | --- | --- |
| None → Pending | Influencer applies | One record, valid open opportunity, server deadline check |
| Pending → Withdrawn | Applying influencer | Own pending application only, including while another applicant's slot is reserved; final for that application |
| Pending → Rejected | Owning brand | Explicit decision, notify applicant |
| Pending → Selected | Owning brand | Reserve slot and create pending agreement together |
| Pending → Not selected | Agreement activates or applicable no-reservation selection window expires | Keep pending during another applicant's pending agreement; inform applicant without competitor details |
| Selected → Match ended | Pending agreement declined, expired, or cancelled | Preserve selection history; that applicant cannot be reselected on this opportunity |

Selected stays as historical selection once the collaboration activates; subsequent delivery state belongs to the collaboration. Rejected, withdrawn, not selected, and match ended are terminal application states. Application status never implies money movement.

## 6. Agreement and collaboration lifecycle

Pending agreement contains a versioned snapshot of participants, deliverables, LKR budget/currency, delivery deadline, revision allowance, and acceptance expectations. Recommend one revision round per deliverable; a round means one consolidated feedback request and resubmission. Each deliverable has an explicit checklist/acceptance description. Both parties confirm the same version. Editing pending terms clears both confirmations; activation is atomic and requires both active members' confirmations on that version. Pending agreement expires after 7 days or at its delivery deadline, whichever occurs first. The brand may edit terms and both parties reconfirm before expiry; editing does not silently extend the 7-day window.

| From → to | Actor / trigger | Conditions and effect |
| --- | --- | --- |
| Pending agreement → Active | Second participant confirms current terms | Both confirmations match same version; deadline future; slot becomes committed |
| Pending agreement → Declined | Either participant | Record reason; release slot; application becomes match ended |
| Pending agreement → Expired | Time-based/server check | Agreement window elapsed; release slot; application becomes match ended |
| Active → Submitted | Influencer | Submit a version covering every agreed deliverable with links/files and notes |
| Submitted → Revision requested | Brand | Item-specific feedback; allowed rounds remain for each requested item |
| Revision requested → Submitted | Influencer | New version; preserve earlier evidence; increment relevant revision usage |
| Submitted → Completed | Brand | Explicit approval of all deliverables; record actor/time/version; no automatic approval |
| Pending agreement → Cancelled | Either participant | Reason required; release slot; application becomes match ended |
| Active / Submitted / Revision requested → Cancelled | Both parties accept cancellation, or administrator resolves a report | Reason and audit trail; no monetary side effects |

Declined, expired, completed, and cancelled are terminal collaboration states. Deadlines passing make work “overdue” as a derived label; they do not automatically complete, cancel, approve, or penalize work. Late submissions remain possible and show their timestamps. Brands cannot request more than the agreed revision allowance; additional work or deadline changes require a mutually confirmed amendment. Original terms remain in effect until both parties accept the amendment; preserve all versions. No unilateral amendment or destructive replacement of accepted terms.

Active cancellation is a separate request with requester/reason/time and pending/accepted/declined/withdrawn status. Creating a request does not change the collaboration state or remove access; the other party may accept or decline, requester may withdraw, and both may report a dispute. No unilateral cancellation after activation. Recommend a support reminder after 3 working days unresolved; the administrator reviews rather than applying automatic termination. Completed work may be reported, but no self-service reopening or unapproval exists in the pilot. Administrator resolution can annotate a completed record without pretending that approval never happened.

Discussion begins after selection and is participant-only; discovery has no direct messaging. Submission files/links are evidence, not proof of sales or verified social analytics. Require an explicit brand review; no response-time automation or financial consequences are inferred. Report categories: inappropriate content, misleading profile/brief, access/safety concern, delivery disagreement, and other. Report status: Open → In review → Resolved or Dismissed, controlled by administrators with notes. Reporter sees status and a shareable outcome; internal notes and the identity of other reporters stay private.

## 7. Files, notifications, and record handling

Propose Supabase Storage when integration is authorized. Profile images: JPEG, PNG, WebP, maximum 5 MB each, one current avatar/logo per profile. Private collaboration attachments: JPEG, PNG, WebP, or PDF, maximum 10 MB/file and 5 files/message or submission. Video and editable document uploads are deferred; use external content URLs. Cap stored private attachments at 100 MB/collaboration for the pilot, showing remaining allowance and a clear error before upload. Replaced profile images are removed only after replacement succeeds. Published discussion messages are immutable in the pilot; corrections use a new message and administrators can hide reported content with a recorded reason.

Storage access follows the record permission matrix; private files use short-lived authorized access and are not public bucket URLs. Validate actual type/size rather than trusting file extensions, reject active formats such as HTML/SVG, use safe attachment delivery, and establish a malware scanning/quarantine approach before enabling private uploads in Phase 4. File finalization and cleanup must prevent orphaned or unauthorized attachments. Private signed links are not posted in public notifications or logs. External links are clearly labelled; the platform does not promise their ongoing availability or safety.

In-app notifications cover application received, application decision, selection, agreement confirmation/change/expiry, new message, submission, revision request, approval/completion, cancellation request/outcome, report status, and membership restriction. Only recipients authorized for the referenced record see its content. Deduplicate repeat events, link to the record, display unread count, and allow mark read. Poll/refresh is sufficient; target display within 60 seconds while the app is open. No email, SMS, push, or guaranteed offline alert. Recommend one deadline reminder 24 hours before delivery to participants; skip if created less than 24 hours before deadline. Durable event/reminder delivery and retry design belong to Phase 4.

Proposed retention: keep collaboration evidence and audit events throughout the pilot and for 90 days after the owner declares the pilot ended, then review export/deletion or an expressly accepted extension. Pending uploads without a record are cleaned within 24 hours. This is an operational proposal, not a legal retention conclusion. Before invitations, the owner must accept published privacy/retention terms and an account-deletion/support process; deletion requests require review of related participants' records and must not silently destroy shared evidence. No indefinite retention is assumed. File policy and secure upload delivery must be verified before upload features are enabled.

## 8. Proposed quality and performance targets

Targets are acceptance criteria to validate in later phases, not evidence of present implementation or a production SLA. Phase 1 checks the UI foundation; Phase 5 measures the real journey with the chosen hosting/database region and a documented test environment.

| Area | Proposed pilot target / measurement |
| --- | --- |
| Responsive UI | Usable at 360 px mobile width and 1280 px desktop width; keyboard and focus checks; no page-level horizontal scrolling |
| Page experience | LCP ≤2.5 seconds and CLS ≤0.1 on key landing/list/detail screens under a recorded mobile/network test profile; track INP ≤200 ms when sufficient real interactions exist |
| Authenticated reads | Server p95 ≤1 second, excluding upload/download bytes and external identity redirects |
| Normal writes | Server p95 ≤1.5 seconds for application, message, and status changes, excluding file transfer |
| Error rate | <1% unexpected server errors over the representative test; valid rejected input/access attempts counted separately |
| Representative load | 10 concurrent active sessions, 2 aggregate requests/second for 15 minutes; seed 50 profiles, 100 opportunities, 500 applications, 50 collaborations, and 2,000 messages |
| Bounds | Default lists 20 items/page, maximum 50; messages paginated; file and query limits enforced server-side |
| Reliability | Zero known cross-user data-access, lost-agreement, duplicate-application, or double-selection defects before inviting users |
| Operational evidence | Record latency, errors, database/storage usage and monthly projected service cost; verify backup restore before the pilot |

Document test tools, devices, region, dataset, and results with later phase evidence. Treat failures as reasons to investigate before expanding the cohort; Redis is not an automatic response. Cohort growth beyond these assumptions requires a fresh workload and cost review.

## 9. Owner acceptance register

All rows start **Pending**. This PR requests acceptance of D01–D10 as a set, subject to any owner-requested amendments. The owner's merge of this acceptance PR records acceptance of the final proposals; an explicit acceptance message also suffices. Record the actual decision/date/source or merge reference at the next authorized documentation update. Silence, PR creation, and recommendations are not acceptance. If one choice changes, update dependent screens/rules before declaring Phase 0 complete.

| ID | Decision to accept or amend | Proposed default | Status |
| --- | --- | --- | --- |
| D01 | UI foundation and language | TypeScript, Tailwind, system fonts, teal/slate workspace direction, English UI, responsive accessible layout | Pending |
| D02 | Audience and roles | Invite-only Sri Lanka; 5 brands/20 influencers/up to 2 admins; one marketplace role/account; no teams or role switch | Pending |
| D03 | Pilot operating envelope | Four-week observation, stated activity/feedback goals, LKR 15,000/month service ceiling | Pending |
| D04 | Marketplace visibility and profiles | Member-only profiles/opportunities; required fields and self-reported social links from section 4 | Pending |
| D05 | Applications and hiring | One application/influencer/opportunity; one slot; selection reservation, reopening and 7-day selection window rules | Pending |
| D06 | Agreement and delivery | Both confirm versioned terms; 7-day agreement window; one revision/item; explicit brand approval; amendment/cancellation rules | Pending |
| D07 | Pilot compensation boundary | LKR informational budget; no in-platform payment or financial status; separately decide any external compensation arrangement | Pending |
| D08 | Files and notifications | Listed image/PDF limits, private storage, upload scanning decision before uploads; in-app polling/events, no email | Pending |
| D09 | Data and support operations | Case-related audited admin access, proposed retention, report/cancellation handling; nominate support owner and approve privacy/deletion process before invitations | Pending |
| D10 | Quality and workload | Targets and measurement scope from section 8 | Pending |

Phase 1 is sufficiently defined for acceptance once D01–D10 are accepted or explicit deferrals are recorded that do not change the Phase 1 design. Hosting, scanning provider, privacy wording, and support-contact identity can remain later-phase decisions as below. Owner acceptance closes Phase 0 only when the agreed pilot scope and screens/permissions/states are coherent. A separate owner instruction must then authorize Phase 1.

## 10. Decisions deliberately deferred

| Decision | Needed by | Constraint carried forward |
| --- | --- | --- |
| Exact Next.js/package versions and component implementation | Phase 1 start | Check supported versions then; no package installation in Phase 0 |
| Clerk/Supabase projects, secrets, membership-invite mechanism and access-policy implementation | Phase 2 | Owner supplies service configuration when needed; do not replace integration with fake auth |
| Hosting provider, region, monitoring tooling, final cost estimate | Before deployment / Phase 5 | Stay within accepted budget or obtain an amended ceiling |
| Secure upload scanning/quarantine provider and retention implementation | Before enabling uploads, Phase 4 | No arbitrary private file uploads before verified controls |
| Published pilot terms/privacy wording, contact identity, final participant list and invite date | Before invitations, Phase 5 | Owner acceptance required; no invitations are authorized now |
| Analytics provider and feedback collection tool | Phase 5 | Minimize personal data; measurement must not expose private messages/files |
| Payment provider, fees, identity checks, settlement, refunds/disputes, business responsibilities | Phase 6 | Provider and Sri Lankan collection/payout suitability must be established first |
| Portfolios, supported social integrations and actual campaign metrics | Phase 7 | No fabricated verification, reach, or sales claims |
| Redis/queues beyond required durable delivery, search services and scaling capacity | Measured need / Phase 8 | Durable product state remains in Postgres; no speculative service provisioning |
| Additional languages, teams, role switching, multi-hire UI, countries and currencies | Explicit future scope decision | Do not silently include them in the pilot |

## 11. Execution handoff and review record

The owner's requested workflow is to reuse the same phase implementation agent where available. Current agent identity: `/root/phase_worker`; requested configuration: **GPT-6.1-sol, medium reasoning**. A live agent cannot be guaranteed across sessions; if unavailable, its successor reads this document, the vision, plan, owner decisions, and PR history before continuing. This record does not claim persistent runtime identity.

The implementation agent works within the authorized phase. The parent agent reviews the proposed changes before creating a PR, records findings, and requests corrections as needed. The owner alone merges changes into `main`; their merge of this acceptance PR records agreement to its final Phase 0 proposals. Neither a phase proposal, PR creation, nor merge authorizes a subsequent phase; start it only under the owner's explicit instruction. No application code or service provisioning is part of this Phase 0 delivery.

Planning validation performed: read the full plan and product vision; checked for applicable `AGENTS.md` files in the repository and ancestor directories (none found); parent reviewed proposed screens against phase boundaries, participant visibility, hiring capacity, state transitions, and non-payment constraints. Review corrections aligned acceptance with the owner's PR merge workflow and clarified competing applications during reservation/expiry. Whitespace, local Markdown link, and UTF-8 checks passed. Application checks are not applicable because no application code changes are authorized. Parent review is complete; owner acceptance remains pending.

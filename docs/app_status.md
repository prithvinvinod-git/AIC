# servox-phi — Application Status & Implementation Reference (v5.0)

**Project:** Campus Maintenance Complaint Management
**Live app:** https://servox-phi.vercel.app · **Firebase project:** `campus-maintenance-2820d` (real, cloud)
**Doc purpose:** current implementation status of the codebase, replacing the original v3.0 spec (`aicfinal.md`). Every section reflects what is actually built and deployed.

---

## Table of Contents
1. Product Overview
2. Stack & Deployment
3. Roles & Authentication
4. Status Lifecycle (State Machine)
5. Data Model (Firestore)
6. API Routes
7. AI Integration (7 Genkit Flows)
8. Email System
9. Notifications & Scheduled Jobs
10. Screens & Navigation
11. Issue History
12. Security Rules & Indexes
13. Verification & Smoke Tests
14. Environment Variables
15. Demo Accounts
16. Deviations from the v3.0 Spec & Pending Gaps

---

## 1. Product Overview

Closed-loop complaint management for a campus. A reporter raises an issue → a department-scoped validator screens it → HOD/Principal confirms critical severities → a maintenance head routes it to a category → that category's head assigns a team → maintenance executes → the **category head inspects the work on-site (auto-verifies)** → the reporter rates → it closes. Every step is audited on a timeline, SLAs are enforced per priority, and notifications/emails keep every stakeholder informed.

The app is organized around role-specific dashboards so each stakeholder lands on a home screen optimized for what they do. **Core principle:** *AI suggests, the state machine decides.* AI never moves a ticket, never approves, never skips a human; all AI output flows through the same route handlers and always requires human confirmation.

---

## 2. Stack & Deployment

**Dependencies** (`package.json`): Next.js **16.3.0** (App Router, Turbopack builds) · React 19.2.8 · firebase 12.17.1 (client) · firebase-admin 14.2.0 · **genkit** 1.40 + @genkit-ai/googleai · genkitx-groq · **nodemailer** 9 (Gmail SMTP) · pdfmake (receipts) · recharts · lucide-react · zod 4 · tailwindcss 4 · date-fns. `jose` pinned via `overrides` to 4.15.9.

**Deployment topology**
- **App + API + Vercel cron** → Vercel production alias `https://servox-phi.vercel.app` (`npx -y vercel@latest --prod --yes` from repo root; build = `next build`, plus `tsc --noEmit` + `eslint` pre-check).
- **Scheduled Cloud Functions** (Node.js 22, `functions/`, deployed to `campus-maintenance-2820d`) → SLA breach scan, hourly deadline reminders, weekly digest. These write **in-app notifications** (no SMTP).
- **Real email cron** → `vercel.json` cron `0 9 * * *` (UTC) → `GET /api/cron/sla-reminders`, and `0 10 * * *` → `GET /api/cron/auto-close` (both Bearer `CRON_SECRET`). Vercel Hobby restricts crons to **daily**; sub-daily schedules are rejected.

**Build/verify:** `npm run build` ✓ · `npx tsc --noEmit` ✓ · `npx eslint src` ✓ (2 pre-existing warnings in `src/components/events/onam.tsx`).

---

## 3. Roles & Authentication

**Role enum** (`src/lib/types.ts`):

```
reporter | validator | hod | principal | maintenance_head | category_head | maintenance | purchase | admin
```

- **`maintenance_head`** — category-scoped (assigned to `categories/{catId}.headUid`). Receives the job at `ROUTED` and forwards it to the right category via `PENDING_ASSIGN`. Load-spread via `pickLeastLoadedHead` (`routing.maintenanceHeadUid`).
- **`category_head`** — category-scoped (head of one or more categories). Receives the job at `PENDING_ASSIGN`, assigns a team + workers (`ASSIGNED`), and — after `COMPLETED` — inspects the work on site (`INSPECTED` → auto `VERIFIED`, same transaction, W-18). Scope-checked via `checkInspect` (`issueMachine.ts`) so a head can only act on their own category.
- **`validator`** — department-scoped. Screens new issues (`VALIDATED`), handles reassignment (`PENDING_ASSIGN`/`ASSIGNED`/`PENDING`), and routes the legacy/short-circuit paths (`APPROVED → ROUTED`/`ASSIGNED`). No longer inspects/verifies — that moved to `category_head`.
- **`purchase` (Purchase Team):** not department-scoped. Queued on issues with `pendingPurchaseCount > 0`; approves flagged requirements with a unit price (auto-resolves them) or rejects with a reason.
- **`portal` claim:** an `admin` with `portal: "principal"` gets Principal + HOD + Admin navigation (`src/lib/nav.ts` `portalRoles`/`homeFor`). `admin@gmail.com` demo account lands on the Principal portal.
- Every ID token is verified per request (`src/lib/auth.ts` `requireAuth`); a `portal` claim can surface another role's dashboards on top of the account's own role.
- Analytics is visible to `hod | principal | validator | admin` (`ANALYTICS_ROLES`).

**Navigation** (`src/lib/nav.ts` `NAV_ITEMS`) — supports both `role` and `roles[]`:

| Role | Items |
|---|---|
| reporter | Dashboard `/` · My issues `/dashboard` · Submit issue `/new` |
| validator | Board `/board` |
| hod · principal | Approvals `/approvals` |
| maintenance | Jobs `/jobs` |
| maintenance_head · category_head | Dispatch `/dispatch` |
| purchase | Purchases `/purchase` |
| admin | Admin `/admin` |
| all | Analytics `/analytics` |
| admin, principal, validator | Issues `/issue-history` |
| admin, principal, hod | Announcements `/announcements` |

`ROLE_HOME` currently maps every role to `/` (the landing page decides the best entry point).

---

## 4. Status Lifecycle (State Machine)

**14 states:** `NEW → VALIDATED → ESCALATED → APPROVED → ROUTED → PENDING_ASSIGN → ASSIGNED → ONGOING → PENDING → COMPLETED → INSPECTED → VERIFIED → CLOSED` + `REJECTED` (terminal).

```
NEW → VALIDATED → ESCALATED → APPROVED → ROUTED → PENDING_ASSIGN → ASSIGNED → ONGOING → COMPLETED → INSPECTED → VERIFIED → CLOSED
        │                                  └─────────────┬───────────────────────┘
        ├→ REJECTED (terminal)                            │ (P3–5 skip ESCALATED/APPROVED)
        │                                                 │
  ASSIGNED ──┐                                            │
  ONGOING  ──┴→ PENDING → ASSIGNED (reassign)            │
  COMPLETED ──→ ONGOING (send back)                       │
```

- **Single door:** all status changes go through `runTransition()` in `src/lib/transition.ts`, which validates the token, parses the body, and runs `applyTransition()` in `src/lib/issueMachine.ts` (authoritative `TRANSITION_RULES`, transactional, RBAC + preconditions) → writes a `timeline` entry → fires notifications + `after()` email hooks. Nothing mutates `status` directly.

**Transition matrix (implemented):**

| From | To | Roles | Precondition |
|---|---|---|---|
| `NEW` | `VALIDATED` | validator, admin | priority 1–5 required |
| `NEW` | `REJECTED` | validator, admin | reason ≥ 3 chars |
| `NEW` | `ESCALATED` | admin | `safetyEscalation` — AI safety-hazard override |
| `VALIDATED` | `ESCALATED` | validator, admin | — (P1–2 **auto-escalates** on validate) |
| `VALIDATED` | `ROUTED` | validator, admin | — (P3–5 **auto-route** to maintenance head) |
| `VALIDATED` | `ASSIGNED` | validator, admin | — (legacy/short-circuit) |
| `ESCALATED` | `APPROVED` | hod, principal, admin | P1 → principal, P2 → HOD (`escalationBand`); optional severity revision 1–5 |
| `ESCALATED` | `REJECTED` | hod, principal, admin | same band; reason ≥ 3 chars |
| `APPROVED` | `ROUTED` | validator, admin | — |
| `APPROVED` | `ASSIGNED` | validator, admin | — (legacy/short-circuit) |
| `ROUTED` | `PENDING_ASSIGN` | maintenance_head, validator, admin | `categoryId` required (maintenance head forwards) |
| `ROUTED` | `ASSIGNED` | admin | — |
| `PENDING_ASSIGN` | `ASSIGNED` | category_head, admin | `teamId` required (category head assigns team) |
| `ASSIGNED` | `ONGOING` | maintenance | must be assigned staff member (or team) |
| `ASSIGNED` / `ONGOING` | `PENDING` | maintenance, validator, admin | blocker note ≥ 3 chars |
| `ASSIGNED` / `ONGOING` | `PENDING_ASSIGN` | category_head, maintenance_head, validator, admin | — (unassign / re-forward) |
| `PENDING` | `ASSIGNED` | validator, admin | `teamId` required |
| `PENDING` | `PENDING_ASSIGN` | category_head, maintenance_head, validator, admin | — |
| `ONGOING` | `COMPLETED` | maintenance, validator, admin | closure report ≥ 5 chars; all `needsApproval` requirements must be approved (resolved) by the purchase team — no waiver |
| `COMPLETED` | `INSPECTED` | category_head, admin | verdict ≥ 2 chars (`checkInspect`, category-scoped) |
| `COMPLETED` | `ONGOING` | category_head, admin | send-back reason ≥ 3 chars (records `verification.verdict = "send_back"`) |
| `INSPECTED` | `VERIFIED` | category_head, admin | repair rule for stranded legacy docs (W-18) |
| `VERIFIED` | `CLOSED` | reporter, admin | rating 0.5–5 in half-steps, or `isAuto` (auto-close) |
| `REJECTED` · `CLOSED` | — | terminal | — |

**Behavioral details baked into the machine:**
- On `VALIDATED`, priority ≤ 2 → auto `ESCALATED` (two timeline entries, `escalation = { required: true, status: "pending" }`); priority > 2 → auto `ROUTED` (to a maintenance head, keeping `routing.maintenanceHeadUid`). `ASSIGNED` remains reachable only as a validator/admin shortcut.
- On `APPROVED`: priority may be revised (band-scoped), `escalation.status = "confirmed"` with `reviewedBy/At`. The okay path continues to `ROUTED` — the maintenance head picks the category.
- On `ROUTED`: the forward records the picked category; `PENDING_ASSIGN` targets that category's head.
- On `ASSIGNED`: resumes a paused SLA (extends resolution deadline by paused duration; W-6 — response deadline is NOT extended), else **initializes SLA** (`initSla`). W-7: the clock starts at ASSIGNED for ALL priorities, not earlier.
- On `PENDING`: pauses SLA (`pausedAt`, `totalPausedMs`).
- On `COMPLETED`: records `completion = { report, completedAt }`, stops the pause, notifies the category head.
- On `INSPECTED`: category head's on-site check **auto-cascades to `VERIFIED` in the same transaction** (W-18), carrying `inspection` + `verification` blocks.
- On `CLOSED`: records `feedback = { rating (0.5–5 half-steps), comment?, givenAt, autoClosed }`.

**Escalation bands** (`src/lib/escalationBand.ts`): P1 → Principal only, P2 → HOD only (`escalationBand`/`canApproveEscalation`); unset/legacy → either HOD or Principal.

**Priority & SLA** (`src/lib/constants.ts` `SLA_DEFAULTS`, config-overridable):

| Priority | Label | Response | Resolution |
|---|---|---|---|
| 1 | Critical | 1 h | 24 h |
| 2 | High | 4 h | 48 h |
| 3 | Medium | 12 h | 72 h |
| 4 | Low | 24 h | 7 d |
| 5 | Minor | 48 h | 14 d |

- Clock **starts at acceptance** (`initSla` — on `ASSIGNED` for all priorities; W-7) and is **paused while `PENDING`**. Deadlines are stored on the doc (`sla.responseDeadline`, `sla.resolutionDeadline`, `sla.pausedAt`, `sla.totalPausedMs`, `sla.breachedFlags`) so queues can `orderBy` them.
- Feedback ratings are **0.5–5 in half-steps**.
- Breach enforcement: Cloud Function flags `breachedFlags.resolution` every 10 min; response-SLA enforcement is a known pending gap (todo #3).

---

## 5. Data Model (Firestore)

**Collections** (`src/lib/types.ts` defines the shapes):

```
users/{uid}                    name, email, role, department, college?, phone?, notifyEmail, isActive, createdAt
teams/{teamId}                 name, categoryId, members[] (uids), isActive, createdAt
categories/{catId}             name, description?, defaultTeamId?, headUid?, slaResponseHours, slaResolutionHours, isActive
issues/{issueId}
  issueNo, trackingToken, title, description, college?, department, status, priority
  prioritySetBy/At, escalation{required,status,reviewedBy?,reviewedAt?,note?}
  location{name,building,floor?}            ← snapshot
  routing{categoryId,categoryName,teamId,staff[],maintenanceHeadUid?,categoryHeadUid?,note?}   ← snapshot, denormalized display
  requirements[{item,qty,needsApproval,resolved,approvalStatus?,price?,approvalBy?,approvalAt?,rejectReason?,addedBy,at}]
  pendingPurchaseCount                      ← needsApproval && !resolved && approvalStatus !== "rejected"
  involveTeams[{teamId,completed}]
  sla{startedAt,responseDeadline,resolutionDeadline,pausedAt,totalPausedMs,breachedFlags{response,resolution}}
  rejection{reason,by,at} | completion{report,completedAt} | inspection{inspectedBy,At,verdict,note?}
  | verification{verifiedBy,At,verdict,sendBackReason?} | feedback{rating,comment,givenAt,autoClosed}
  reporter{uid,name,department}             ← snapshot
  aiSuggestion{category,suggestedPriority,reasons[],photoSummary,safetyFlags[],isSpam,spamReasons[],
               duplicateOf,duplicateIssueNo,matchScore,similarIssues[],routing?,aiModel,aiProcessed,processedAt}
  counters{commentCount,timelineCount} | boardHidden | trackingDisabled
  createdAt, updatedAt
issues/{id}/timeline/{e}       from, to, by{uid,name,role}, note?, at, isAuto
issues/{id}/comments/{c}       author{uid,name,role}, body, at, likes?
issues/{id}/attachments/{a}    url, mime, size, at  (app URLs /api/images/{id})
imageBlobs/{blobId}            data (base64), contentType, uploadedBy, at
                               ← photos stored in Firestore so no Cloud Storage/Blaze is required;
                                 served via GET /api/images/[id] (unguessable UUID ids)
notifications/{uid}/items/{n}  type, title, body, link, isRead, at
config/general                 slaDefaults, feedbackGraceHours (24), assignmentMode ("claim"|"assign"),
                               purchaseApprovalLimit (5000), ai{enabled,triageModel,routingModel,threshold},
                               sequenceCounters{issues}
stats/{YYYY-MM-DD}             daily aggregates (totalCreated/Closed, byCategory/byStatus, slaBreached, resolution ms)
```

**Design rules:** display data is denormalized onto the ticket (no JOINs); composite indexes live in `firestore.indexes.json` (deployed); no `OR`/`!=` queries; counters updated transactionally.

---

## 6. API Routes

All route handlers verify the Firebase ID token (`requireAuth`). Implemented under `src/app/api/`:

```
POST   /api/issues                      create NEW + after(): runAiOnCreate + validator notify + stats + reported email
GET    /api/issues?status=&mine=&scope=board   role-scoped lists; board = cross-user P1–P3, boardHidden excluded
GET    /api/issues/[id]                 detail (+timeline, comments)
POST   /api/issues/[id]/validate|reject|escalate|approve|assign|pending|complete|sendback|feedback
POST   /api/issues/[id]/forward         ROUTED → PENDING_ASSIGN (maintenance head forwards to a category)
POST   /api/issues/[id]/inspect         COMPLETED → INSPECTED → auto VERIFIED (category head on-site check)
POST   /api/issues/[id]/status          generic transition {to,note} — the ONE door
POST   /api/issues/[id]/requirements · [reqId]
POST   /api/issues/[id]/requirements/[reqId]/approve · /reject · /senior-approve · /senior-reject
                                        purchase/admin: price or reason; senior = above approval limit
POST   /api/issues/[id]/comments · [commentId]/like
PATCH  /api/issues/[id]/board-visibility · /tracking-visibility
GET    /api/notifications               in-app notifications; read/unread
GET    /api/profile · PATCH /api/profile
GET    /api/teams · GET /api/categories
GET    /api/issue-history               admin/principal/validator (see §11)
GET    /api/analytics/summary?range=
POST   /api/uploads · GET /api/images/[id] · GET /api/track/[token]
POST   /api/auth/provision
GET    /api/cron/sla-reminders · /api/cron/auto-close   Bearer CRON_SECRET (Vercel cron)
--- admin ---
GET/POST/PATCH/DELETE /api/admin/users
GET/POST/PATCH/DELETE /api/admin/teams (+[id])
GET/POST/PATCH/DELETE /api/admin/categories (+[id])
GET/PATCH             /api/admin/config
--- AI (see §7) ---
POST /api/ai/triage · /api/ai/duplicates · /api/ai/suggest-assign
POST /api/ai/extract-requirements · /api/ai/draft-closure
POST /api/ai/root-cause · GET /api/ai/sla-explain
GET  /api/ai/weekly-insights · /api/ai/at-risk
```

**Issue list scoping** (`GET /api/issues`, `src/app/api/issues/route.ts`): reporter → `reporter.uid` (+ college); validator → college + department; maintenance_head → `routing.maintenanceHeadUid` (+ college); category_head → `routing.categoryId in (categories where headUid = me)` (+ college); maintenance → `routing.teamId in (member teams)` (+ college); purchase → `pendingPurchaseCount > 0`; hod → college + department; principal → college; admin → all. `scope=board` ignores role → newest P1–P3 across departments (minus `boardHidden`), capped at 10. `trackingToken` is stripped from list responses.

**Core module:** `src/lib/issueMachine.ts` (state machine + RBAC + denormalization + transaction wrapper) — the single source of truth for transitions, driven by `src/lib/transition.ts`.

**Public tracking:** `GET /api/track/[token]` + `src/app/track/[token]/page.tsx` — non-logged-in recipients follow an issue via its `trackingToken` (status rail, SLA countdown, timeline). Email CTAs prefer this link; fall back to `/issues/[id]` for legacy docs.

---

## 7. AI Integration (7 Genkit Flows)

Architecture (`src/lib/ai/`): every flow lives under `src/lib/ai/`, returns structured JSON validated against a schema, runs in the background after the deterministic action, and writes to `issue.aiSuggestion` — **never `status`**. Genkit is lazily initialized (`genkit.ts`); flows **fall back to a deterministic keyword classifier** when no AI is enabled, so the app is fully demoable offline.

**Gate (`src/lib/ai/genkit.ts`):** `aiEnabled(override?)` = a real `GOOGLE_GENAI_API_KEY` (not empty / not `"demo-key"`) OR `groqEnabled()` (`GROQ_API_KEY`), unless `override === false` — the admin `config.ai.enabled` kill-switch threaded through every AI flow/route as `enabled` (triage, suggest-assign, extract-requirements, draft-closure, weekly-insights, root-cause, at-risk, sla-explain + `runAiOnCreate`). `false` force-disables even with keys; `undefined` = keys-only check (used by label-only callers like `writeRoutingSuggestion`). `getGenkit()` lazily creates the runtime with `googleAI()` + `groq()` when keyed. Default model `gemini-3.1-flash-lite` (`AI_MODEL` override); `triageModelChain()` walks Gemini 3 → Groq → configured → legacy so one 429 doesn't drop to the classifier.

| # | Flow | File | Route | Notes |
|---|---|---|---|---|
| 1 | Auto-triage + photo inspection | `triage.ts` | `POST /api/ai/triage` | category (constrained to active DB list), priority 1–5 + reasons, photo brief, safety flags. Deterministic `spamCheck()` runs even when the model is down; spam → P5 |
| 2 | Duplicate detection | `duplicates.ts` | `POST /api/ai/duplicates` | token-overlap (Jaccard-like) vs up to 50 recent open issues at the same location; threshold 0.45 → `duplicateOf` + top-5 `similarIssues`. No LLM |
| 3 | Routing suggestion | `routing.ts` | `POST /api/ai/suggest-assign` | hybrid: rule engine `rankCandidates` (team pick + `done*2 − load`), top-3 staff; AI rewrites the reason. Validator confirms before `routing` is written |
| 4 | Requirements + closure assistant | `assist.ts` | `extract-requirements` · `draft-closure` | `{item,qty,needsApproval}` drafts (≤6, keyword table first + AI refine) + structured closure report (<120 words) |
| 5 | Weekly governance insights | `insights.ts` | `GET /api/ai/weekly-insights` | last-7-day aggregates + AI executive summary + recommendations, from `stats/{YYYY-MM-DD}` |
| 6 | Root-cause analysis | `rootCause.ts` | `POST /api/ai/root-cause` | `{summary,likelyArea,confidence,recommendation}`; deterministic frequency-based fallback (30 days) |
| 7 | Predictive at-risk locations | `predictive.ts` | `GET /api/ai/at-risk` | 🔴/🟠/🟢 risk rows (45 days); frequency-tier fallback |

**On issue creation** (`src/lib/ai/index.ts` `runAiOnCreate`, fired via `after()` in `POST /api/issues`): triage then duplicate detection, guarded by `aiSuggestion.aiProcessed` (cost control, no re-runs). Threads `config.ai.*` (`triageModel`, `enabled`, `threshold`). `getActiveCategories()` falls back to the 5 defaults when the query fails.

**Permission matrix (routes):** triage = reporter(owner) or validator/hod/principal/admin; duplicates = any auth'd; suggest-assign = validator/admin; extract-requirements & draft-closure = maintenance/validator/admin; weekly-insights & at-risk = admin/validator/hod/principal; root-cause = admin/validator/hod/principal/maintenance.

---

## 8. Email System

**Transport:** Nodemailer + Gmail SMTP (`smtp.gmail.com:587`), gated by `EMAIL_ENABLED=true`, **best-effort** (`sendMail` swallows errors so mail can never break the primary flow). Sender = `EMAIL_FROM` (Gmail requires From = authenticated SMTP account).

**Send functions** (`src/lib/email/`):

| Event | Function | Recipients |
|---|---|---|
| New issue | `sendIssueReportedEmail` | P1–2 (urgent): principal + dept HOD + dept validator; P3–5: dept validator only. Effective priority = AI-set > reporter choice > AI suggestion > P3 |
| Approval | `sendIssueApprovedEmail` | dept HOD + principal (rejections never email) |
| Job assignment | `sendJobAssignmentEmail` | team members + assigned staff (SLA card + Google Calendar link) |
| SLA reminder | `sendSlaReminderEmails` (cron) | team + staff; window 2 h before deadline or breached; 12 h cooldown via `sla.emailReminderAt` |

**Recipient resolution** (`src/lib/email/recipients.ts`): active users by role, department-scoped; honors `notifyEmail === false` opt-out (settings toggle). **Test override:** while `EMAIL_TEST_RECIPIENT` is set, all mail routes to that single inbox (currently `prithvinvinod520@gmail.com`).

**Templates** (`src/lib/email/templates.ts`): one shared shell in a **warm terracotta theme** matching the app — `--accent #d97757`, cream card, pill buttons/severity badges, SLA card with tone-colored bar. HTML + plain-text fallback for all four message types.

**Env vars:** `EMAIL_ENABLED`, `EMAIL_FROM[_NAME]`, `SMTP_HOST/PORT/USER/PASS`, `EMAIL_TEST_RECIPIENT`, `APP_URL`.

**Verified:** SMTP test email delivered; full lifecycle E2E fired reported/approved/assigned emails with all transitions passing (see §13).

---

## 9. Notifications & Scheduled Jobs

**In-app notifications** (`src/lib/notifications.ts` `notifyRecipientsForIssue` + `notifyRole`): event-driven matrix on transitions — created → dept validator; escalated → HOD/Principal (band-scoped); routed → maintenance_head; pending_assign → category_head + maintenance_head; assigned → reporter + validator + assigned staff; pending → category_head + maintenance_head + validator + reporter; completed → category_head (on-site verification); verified → reporter; closed with rating → dept validator; send-back → "Work revised" to reporter. Read via `GET /api/notifications`, bell via `useNotifications`.

**Scheduled work:**

| Job | Where | Schedule | Effect |
|---|---|---|---|
| SLA breach scan | Cloud Function (`functions/src/index.ts`) | every 10 min (Asia/Kolkata) | flag `breachedFlags.resolution`, timeline entry, in-app alerts |
| Deadline reminders | Cloud Function | every 60 min | in-app reminder to staff + reporter near deadline (6 h cooldown) |
| Weekly digest | Cloud Function | Mon 08:00 IST | in-app digest for admin/hod/principal |
| **SLA reminder email** | Vercel cron → `api/cron/sla-reminders` | daily `0 9 * * *` UTC | real email to team (see §8) |
| **Auto-close** | Vercel cron → `api/cron/auto-close` | daily `0 10 * * *` UTC | `VERIFIED` past `feedbackGraceHours` → `CLOSED (isAuto)`, notifies reporter |

Both Vercel crons are bearer-guarded with `CRON_SECRET`. Cloud Functions write in-app notifications only (no SMTP from functions).

---

## 10. Screens & Navigation

Routes under `src/app/`:

- `(auth)`: `/login`, `/signup`, `/verify-email`
- `(app)`: `/dashboard` (reporter), `/new` (submit wizard — client-side image compression ~1200px q0.7), `/issues/[id]` (shared detail), `/board` (validator), `/approvals` (hod + principal), `/jobs` (maintenance), `/dispatch` (maintenance_head + category_head), `/purchase`, `/analytics`, `/admin`, `/issue-history`, `/announcements`, `/notifications`, `/profile`, `/settings`
- Public: `/` landing, `/track/[token]`, `/[slug]` (easter-egg event pages via `EASTER_EGG_SLUGS`)

Shared shell `src/components/AppShell.tsx` filters `NAV_ITEMS` by role + `portal` claim (supports `roles[]`).

**Design system** (`src/app/globals.css`, `@theme`): warm "Claude" neutrals with terracotta accent — `--color-ink #1f1e1d`, `--color-accent #d97757` (+hover `#c15f3c`, strong `#ff6b4a`, soft `#fbf0ea`), `--color-paper #faf9f5`, `--color-graphite #403c37`, `--color-slate #78716c`, `--color-silver #e6e2d8`, danger `#c1452e`, warning `#b45309`, success `#3e7d4b`, violet `#7c3aed`. Fonts: Inter (body) + Fraunces (display) + a Valve-style brand font; pill buttons, warm low-contrast shadows, radius scale 6/10/16/20/full. Note: `docs/DESIGN.md` is an outdated (Cal.com monochrome) reference — **the shipped theme is the warm terracotta one above**.

**Closed-issue receipt:** `src/lib/receiptPdf.ts` generates a branded PDF (pdfmake, Roboto via `addVirtualFileSystem`) with issue details, SLA, requirements table, timeline, completion/verification/feedback — button on CLOSED issue detail.

---

## 11. Issue History

- **Page:** `src/app/(app)/issue-history/page.tsx` — debounced title search, filter popup (date range, department, category, status presets), results table linking to `/issues/[id]`.
- **API:** `GET /api/issue-history` — gated to `admin`/`principal`/`validator`; fetches latest 2000 issues `orderBy createdAt desc` and JS-filters (avoids composite indexes for every filter combo). Returns `401` when unauthenticated.
- **Nav:** item `roles: ["admin", "principal", "validator"]` in `NAV_ITEMS`.

---

## 12. Security Rules & Indexes

- `firestore.rules` — second wall behind route handlers: only `reporter` creates issues at `NEW`; update gated by role + current status; `users`/`teams`/`categories`/`config` admin-write; notifications owner-only; `stats` read-only. Note: rules still contain legacy `head`-era role/status references (stale, harmless — no `head` role is issued).
- `firestore.indexes.json` — deployed composite indexes for the role-scoped list queries (reporter.uid/createdAt, routing.teamId/status/deadline, routing.maintenanceHeadUid/status, department/status/createdAt, routing.staff/status, routing.categoryId/status, teams categoryId/isActive, etc.).

---

## 13. Verification & Smoke Tests

- **E2E lifecycle** (`scripts/smoke-lifecycle.mjs`): mints real ID tokens (admin SDK) and drives `NEW → VALIDATED → ESCALATED → APPROVED → ROUTED → PENDING_ASSIGN → ASSIGNED → ONGOING → COMPLETED → INSPECTED → VERIFIED → CLOSED` over the live HTTP API; passes against production (`SMOKE_BASE=https://servox-phi.vercel.app`), then auto-cleans the smoke issue.
- `scripts/smoke-announcements.mjs` / `cleanup-smoke.mjs` / `key-diag.mjs` / `backfill-tracking-tokens.mjs` helper scripts.
- `npx tsc --noEmit` + `npx eslint src` clean on every change; `next build` succeeds (Turbopack, 39 routes).
- `docs/verification-log.md` records session-by-session checks; `docs/limitations-log.md` tracks UX confusion-prone areas.

---

## 14. Environment Variables

`.env.local` (gitignored) mirrors Vercel production env:

```
NEXT_PUBLIC_FIREBASE_API_KEY / AUTH_DOMAIN / PROJECT_ID / STORAGE_BUCKET / MESSAGING_SENDER_ID / APP_ID
FIREBASE_CLIENT_EMAIL · FIREBASE_PROJECT_ID · FIREBASE_PRIVATE_KEY   (admin SDK)
GOOGLE_GENAI_API_KEY · GROQ_API_KEY · AI_MODEL                       (Genkit; unset → keyword fallback)
SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS                        (Gmail SMTP)
EMAIL_ENABLED · EMAIL_FROM / EMAIL_FROM_NAME · EMAIL_TEST_RECIPIENT
APP_URL=https://servox-phi.vercel.app
CRON_SECRET=<set>                                                    (Bearer guard on cron routes)
```

`.env.example` is committed with placeholder values only (no secrets).

---

## 15. Demo Accounts

Password for all: `123456`

| Email | Role / landing |
|---|---|
| `prithvinvinod@gmail.com` | admin |
| `admin@gmail.com` | admin + `portal: principal` → Principal portal (sidebar: Principal, HOD, Admin) |
| `principal@gmail.com` | principal |
| `hod@gmail.com` | hod |
| `validator@gmail.com` | validator (Engineering) |
| `mainten@gmail.com` | maintenance → Jobs |
| `purchase@gmail.com` | Purchase Team → Purchases |
| Any new sign-up | reporter |

---

## 16. Deviations from the v3.0 Spec & Pending Gaps

**Implemented deviations**
- `head` role removed → **replaced** by `maintenance_head` (routes/forwards) + `category_head` (assigns + on-site inspects/auto-verifies); validators no longer verify.
- 14-state lifecycle (ROUTED, PENDING_ASSIGN, INSPECTED added; inspection auto-cascades to VERIFIED).
- Feedback rating is **1–5** in half-steps (spec said 1–3).
- Emails use **Gmail SMTP via Nodemailer** (spec planned Resend) — approval, assignment, reported, and SLA-reminder emails implemented; rejection intentionally sends nothing.
- **Test-recipient override** (`EMAIL_TEST_RECIPIENT`) routes all mail to `prithvinvinod520@gmail.com` until real role accounts exist.
- SLA reminder email + auto-close run via **Vercel daily cron** (Hobby caps sub-daily crons), not Cloud Functions.
- Templates use a **warm terracotta theme** matching the app.
- New features not in v3.0: Issue History (admin/principal/validator), public tracking links, auto-close job, client-side image compression, receipt PDF, AI briefing for jobs, F5 weekly insights narrative.

**Pending / optional gaps**
- Response-SLA enforcement (`breachedFlags.response`) — todo #3, deferred.
- Real weekly governance email — todo #5.
- "Where's my complaint?" status bot — todo #7.
- CSV export — todo #8.
- FCM push notifications — todo #9.
- Reporter re-submit linked to a rejected issue; QR code per room/asset; status chatbot; offline mode; PWA moves (see `docs/todo.md` P1–P10).
- Admin UI's `config.ai.enabled` toggle is display-only in the settings page (the flag itself IS enforced — §7).
- Deploying email assets to real role accounts (replaces `EMAIL_TEST_RECIPIENT` when seeded accounts get real inboxes).
- `firestore.rules` + `functions/src/index.ts` carry stale legacy-role references (harmless; admin backfill keeps the project seeded).
# CampusCare — Application Status & Implementation Reference (v4.0)

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

Closed-loop complaint management for a campus. A reporter raises an issue → a department-scoped validator screens it → HOD/Principal confirms critical severities → the right maintenance team executes → the validator verifies → the reporter rates and it closes. Every step is audited on a timeline, SLAs are enforced per priority, and notifications/emails keep every stakeholder informed.

The app is organized around role-specific dashboards so each stakeholder lands on a home screen optimized for what they do. **Core principle:** *AI suggests, the state machine decides.* AI never moves a ticket, never approves, never skips a human; all AI output flows through the same route handlers and always requires human confirmation.

---

## 2. Stack & Deployment

**Dependencies** (`package.json`): Next.js **16.3.0** (App Router, Turbopack builds) · React 19.2.8 · firebase 12.17.1 (client) · firebase-admin 14.2.0 · **genkit** 1.40.1 + @genkit-ai/googleai · **nodemailer** 9 (Gmail SMTP) · recharts 3.10 · lucide-react · zod 4 · tailwindcss 4 · date-fns.

**Deployment topology**
- **App + API + Vercel cron** → Vercel production alias `https://servox-phi.vercel.app` (`npx -y vercel@latest --prod --yes` from repo root; build = `next build`, plus `tsc --noEmit` + `eslint` pre-check).
- **Scheduled Cloud Functions** (Node.js 22, `functions/`, deployed to `campus-maintenance-2820d`) → SLA breach scan, hourly deadline reminders, weekly digest. These write **in-app notifications** (no SMTP).
- **Real email cron** → `vercel.json` cron `0 9 * * *` (UTC) → `GET /api/cron/sla-reminders` (Bearer `CRON_SECRET`). Vercel Hobby restricts crons to **daily**; sub-daily schedules are rejected.

**Build/verify:** `npm run build` ✓ · `npx tsc --noEmit` ✓ · `npx eslint src` ✓.

---

## 3. Roles & Authentication

**Role enum** (`src/lib/types.ts`):

```
reporter | validator | hod | principal | maintenance | admin
```

- The old **`head` role was removed** and its duties merged into the **department-scoped `validator`** (validators route/assign and verify — see §4).
- **`portal` claim:** an `admin` with `portal: "principal"` gets Principal + HOD + Admin navigation (`src/lib/nav.ts` `portalRoles`/`homeFor`). `admin@gmail.com` demo account lands on the Principal portal.
- Every ID token is verified per request (`src/lib/auth.ts` `requireAuth`); a `portal` claim can surface another role's dashboards on top of the account's own role.
- Analytics is visible to `hod | principal | validator | admin` (`ANALYTICS_ROLES`).

**Navigation** (`src/lib/nav.ts` `NAV_ITEMS`) — supports both `role` and `roles[]`:

| Role | Items |
|---|---|
| reporter | My issues `/dashboard` · Submit issue `/new` |
| validator | Board `/validate` |
| hod | Escalations `/hod` |
| principal | Approvals `/principal` |
| maintenance | Jobs `/jobs` |
| admin | Admin `/admin` |
| all | Analytics `/analytics` |
| admin, principal | Issue history `/issue-history` |

---

## 4. Status Lifecycle (State Machine)

```
NEW → VALIDATED → ESCALATED → APPROVED → ASSIGNED → ONGOING → COMPLETED → VERIFIED → CLOSED
        │
        └→ REJECTED (terminal)

        ASSIGNED ──┐
        ONGOING  ──┴→ PENDING → ASSIGNED (reassign)
        COMPLETED ──→ ONGOING (send back)
```

- **Single door:** all status changes go through `runTransition()` in `src/lib/transition.ts`, which validates the token, parses the body, and runs `applyTransition()` in `src/lib/issueMachine.ts` (authoritative `TRANSITION_RULES`, transactional, RBAC + preconditions) → writes a `timeline` entry → fires notifications + `after()` email hooks. Nothing mutates `status` directly.
- **Transition matrix (implemented):**

| From | To | Allowed roles | Precondition |
|---|---|---|---|
| `NEW` | `VALIDATED` | validator, admin | priority 1–5 |
| `NEW` | `REJECTED` | validator, admin | reason ≥ 3 chars |
| `VALIDATED` | `ESCALATED` | validator, admin | — (P1–2 auto-escalates on validate) |
| `VALIDATED` | `ASSIGNED` | validator, admin | — (P3–5 auto-route) |
| `ESCALATED` | `APPROVED` | hod, principal, admin | optional severity revision 1–5 |
| `APPROVED` | `ASSIGNED` | validator, admin | default team resolved from category |
| `ASSIGNED` | `ONGOING` | maintenance | must be assigned staff (or team) |
| `ASSIGNED` / `ONGOING` | `PENDING` | maintenance, validator, admin | blocker note ≥ 3 chars |
| `PENDING` | `ASSIGNED` | validator, admin | `teamId` required |
| `ONGOING` | `COMPLETED` | maintenance, validator, admin | closure report ≥ 5 chars; `needsApproval` requirements resolved/waived |
| `COMPLETED` | `VERIFIED` | validator, admin | verdict ≥ 2 chars |
| `COMPLETED` | `ONGOING` | validator, admin | send-back reason ≥ 3 chars |
| `VERIFIED` | `CLOSED` | reporter | rating 1–5 (or `isAuto`) |

**Priority & SLA** (`src/lib/constants.ts` `SLA_DEFAULTS`, config-overridable):

| Priority | Label | Response | Resolution |
|---|---|---|---|
| 1 | Critical | 1 h | 24 h |
| 2 | High | 4 h | 48 h |
| 3 | Medium | 12 h | 72 h |
| 4 | Low | 24 h | 7 d |
| 5 | Minor | 48 h | 14 d |

- Clock **starts at acceptance** (`VALIDATED` for P3–5, `APPROVED` for P1–2) and is **paused while `PENDING`** (`sla.pausedAt`, `sla.totalPausedMs`). Deadlines are stored on the doc (`sla.responseDeadline`, `sla.resolutionDeadline`, `sla.breachedFlags`) so queues can `orderBy` them.
- Feedback ratings are **1–5** (not 1–3 as in the original spec).

---

## 5. Data Model (Firestore)

**Collections** (`src/lib/types.ts` defines the shapes):

```
users/{uid}                    name, email, role, department, college?, phone?, isActive, createdAt
teams/{teamId}                 name, categoryId, members[] (uids), isActive, createdAt
categories/{catId}             name, description?, defaultTeamId?, slaResponseHours, slaResolutionHours, isActive
issues/{issueId}
  issueNo, title, description, college?, department, status, priority
  prioritySetBy/At, escalation{required,status,...}
  location{name,building,floor?}            ← snapshot
  routing{categoryId,categoryName,teamId,staff[]}   ← snapshot, denormalized display
  requirements[{item,qty,needsApproval,resolved,addedBy,at}]
  involveTeams[{teamId,completed}]
  sla{startedAt,responseDeadline,resolutionDeadline,pausedAt,totalPausedMs,breachedFlags}
  rejection{reason,by,at} | completion{report,completedAt} | verification{...} | feedback{rating,comment,givenAt,autoClosed}
  reporter{uid,name,department}             ← snapshot
  aiSuggestion{category,suggestedPriority,reasons[],photoSummary,safetyFlags[],routing?,duplicateOf?,matchScore?,similarIssues?,aiProcessed,aiModel?,processedAt}
  counters{commentCount,timelineCount}
  createdAt, updatedAt
issues/{id}/timeline/{e}       from, to, by{uid,name,role}, note?, at, isAuto
issues/{id}/comments/{c}       author{uid,name,role}, body, at
issues/{id}/attachments/{a}    url, mime, size, at  (app URLs /api/images/{id})
imageBlobs/{blobId}            data (base64), contentType, uploadedBy, at
                               ← photos stored in Firestore so no Cloud Storage/Blaze is required;
                                 served via GET /api/images/[id] (unguessable UUID ids)
notifications/{uid}/...        type, title, body, link, isRead, at   (read via GET /api/notifications)
config/{docId}                 slaDefaults, feedbackGraceHours (24), assignmentMode ("claim"|"assign"),
                               ai{enabled,triageModel,routingModel,threshold}, sequenceCounters{issues}
stats/{YYYY-MM-DD}             daily aggregates (totalCreated/Closed, byCategory/byStatus, slaBreached, resolution ms)
```

**Design rules:** display data is denormalized onto the ticket (no JOINs); composite indexes live in `firestore.indexes.json` (deployed); no `OR`/`!=` queries; counters updated transactionally.

---

## 6. API Routes

All route handlers verify the Firebase ID token (`requireAuth`). Implemented under `src/app/api/`:

```
POST   /api/issues                      create NEW + after(): AI pipeline + reported email
GET    /api/issues?status=&mine=        role-scoped lists
GET    /api/issues/[id]                 detail
POST   /api/issues/[id]/validate        → VALIDATED | REJECTED
POST   /api/issues/[id]/escalate        → ESCALATED
POST   /api/issues/[id]/approve         → APPROVED (hod/principal)
POST   /api/issues/[id]/assign          → ASSIGNED (validator; transactional)
POST   /api/issues/[id]/status          generic transition {to,note} — the ONE door
POST   /api/issues/[id]/pending         → PENDING
POST   /api/issues/[id]/reject          → REJECTED
POST   /api/issues/[id]/complete        → COMPLETED
POST   /api/issues/[id]/verify          → VERIFIED
POST   /api/issues/[id]/sendback        → ONGOING (send back)
POST   /api/issues/[id]/feedback        → CLOSED
POST   /api/issues/[id]/requirements    add/resolve requirement
POST   /api/issues/[id]/requirements/[reqId]
POST   /api/issues/[id]/comments        comment
GET    /api/notifications               in-app notifications
GET    /api/profile · PATCH /api/profile
GET    /api/teams · GET /api/categories
GET    /api/analytics/summary?range=
POST   /api/uploads · GET /api/images/[id]
GET    /api/issue-history               admin/principal only (see §11)
GET    /api/cron/sla-reminders          Bearer CRON_SECRET (Vercel cron)
POST   /api/auth/provision
--- admin ---
GET/POST/PATCH/DELETE /api/admin/users
GET/POST/PATCH/DELETE /api/admin/teams (+[id])
GET/POST/PATCH/DELETE /api/admin/categories (+[id])
GET/PATCH             /api/admin/config
--- AI (see §7) ---
POST /api/ai/triage · /api/ai/duplicates · /api/ai/suggest-assign
POST /api/ai/extract-requirements · /api/ai/draft-closure
POST /api/ai/root-cause
GET  /api/ai/weekly-insights · /api/ai/at-risk
```

**Core module:** `src/lib/issueMachine.ts` (state machine + RBAC + denormalization + transaction wrapper) — the single source of truth for transitions, driven by `src/lib/transition.ts`.

---

## 7. AI Integration (7 Genkit Flows)

Architecture (`src/lib/ai/`): every flow lives under `src/lib/ai/`, returns structured JSON validated against a schema, runs in the background after the deterministic action, and writes to `issue.aiSuggestion` — **never `status`**. Genkit is lazily initialized (`genkit.ts`); flows **fall back to a deterministic keyword classifier** when no `GOOGLE_GENAI_API_KEY` is present, so the app is fully demoable offline. Default model `gemini-2.0-flash` (`AI_MODEL` override).

| # | Flow | File | Route | Notes |
|---|---|---|---|---|
| 1 | Auto-triage + photo inspection | `triage.ts` | `POST /api/ai/triage` | category (constrained to active DB list), priority 1–5 + reasons, photo brief, safety flags |
| 2 | Duplicate detection | `duplicates.ts` | `POST /api/ai/duplicates` | embedding/cosine vs same-location issues; `duplicateOf` + similar list |
| 3 | Routing suggestion | `routing.ts` | `POST /api/ai/suggest-assign` | hybrid: rule engine computes candidates, Genkit ranks |
| 4 | Requirements + closure assistant | `assist.ts` | `POST /api/ai/extract-requirements` · `draft-closure` | `{item,qty,needsApproval}` drafts + structured closure report |
| 5 | Weekly governance insights | `insights.ts` | `GET /api/ai/weekly-insights` | narrative from `stats/{YYYY-MM-DD}` |
| 6 | Root-cause analysis | `rootCause.ts` | `POST /api/ai/root-cause` | `{summary,likelyArea,confidence,recommendation}`; deterministic frequency-based fallback |
| 7 | Predictive at-risk locations | `predictive.ts` | `GET /api/ai/at-risk` | 🔴/🟠/🟢 risk rows; frequency-tier fallback |

**On issue creation** (`src/lib/ai/index.ts` `runAiOnCreate`, fired via `after()` in `POST /api/issues`): triage then duplicate detection, guarded by `aiSuggestion.aiProcessed` (cost control, no re-runs).

---

## 8. Email System

**Transport:** Nodemailer + Gmail SMTP (`smtp.gmail.com:587`), gated by `EMAIL_ENABLED=true`, **best-effort** (`sendMail` swallows errors so mail can never break the primary flow). Sender = `EMAIL_FROM` (Gmail requires From = authenticated SMTP account).

**Send functions** (`src/lib/email/index.ts`):

| Event | Function | Recipients (role-based) |
|---|---|---|
| New issue | `sendIssueReportedEmail` | P1–2 (urgent): principal + dept HOD + dept validator; P3–5: dept validator only. Effective priority = reporter severity → AI suggestion → P3 fallback |
| Approval | `sendIssueApprovedEmail` | dept HOD + principal |
| Job assignment | `sendJobAssignmentEmail` | team members + assigned staff (with SLA card + Google Calendar link) |
| SLA reminder | `sendSlaReminderEmails` (cron) | team + staff; window 2 h before deadline or breached; 12 h cooldown via `sla.emailReminderAt` |

**Recipient resolution** (`src/lib/email/recipients.ts`): active users by role, department-scoped; `getTeamEmails` resolves team members + assigned staff. **Test override:** while `EMAIL_TEST_RECIPIENT` is set, every role's mail routes to that single inbox with **priority ordering principal/HOD → validator → maintenance** (currently `prithvinvinod520@gmail.com`).

**Templates** (`src/lib/email/templates.ts`): one shared shell in a **dark ChatGPT-style theme** — charcoal panels, green `#10a37f` accent, 20px rounded card, pill buttons/severity badges, dark SLA card with tone-colored left border. HTML + plain-text fallback for all four message types.

**Env vars:** `EMAIL_ENABLED`, `EMAIL_FROM[_NAME]`, `SMTP_HOST/PORT/USER/PASS`, `EMAIL_TEST_RECIPIENT`, `APP_URL`.

**Verified:** SMTP test email delivered to `servoxphi@gmail.com`; full lifecycle E2E fired reported/approved/assigned emails with all transitions passing (see §13).

---

## 9. Notifications & Scheduled Jobs

**In-app notifications** (`src/lib/notifications.ts` `notifyRecipientsForIssue` + `notifyRole`): event-driven matrix on transitions (created → dept validator; escalated → HOD/principal; assigned → team/reporter; verified → reporter; SLA breach → chain). Read via `GET /api/notifications`.

**Scheduled work:**

| Job | Where | Schedule | Effect |
|---|---|---|---|
| SLA breach scan | Cloud Function (`functions/src/index.ts`) | every 10 min (Asia/Kolkata) | flag `breachedFlags.resolution`, timeline entry, in-app alerts |
| Deadline reminders | Cloud Function | every 60 min | in-app reminder to staff + reporter near deadline (6 h cooldown) |
| Weekly digest | Cloud Function | Mon 08:00 IST | in-app digest for admin/hod/principal |
| **SLA reminder email** | Vercel cron → `api/cron/sla-reminders` | daily `0 9 * * *` UTC | real email to team (see §8) |

---

## 10. Screens & Navigation

Routes under `src/app/`:

- `(auth)`: `/login`, `/signup`
- `(app)`: `/dashboard` (reporter), `/new` (submit wizard), `/issues/[id]` (shared detail), `/validate` (validator board), `/hod`, `/principal`, `/jobs` (maintenance), `/analytics`, `/admin`, `/issue-history`, `/profile`, `/settings`
- `/` landing

Shared shell `src/components/AppShell.tsx` filters `NAV_ITEMS` by role + `portal` claim (supports `roles[]` for multi-role items like Issue history).

---

## 11. Issue History

- **Page:** `src/app/(app)/issue-history/page.tsx` — debounced title search, filter popup (date range, department, category, status presets), results table linking to `/issues/[id]`.
- **API:** `GET /api/issue-history` — gated to `admin`/`principal`; fetches latest 2000 issues `orderBy createdAt desc` and JS-filters (avoids composite indexes for every filter combo). Returns `401` when unauthenticated.
- **Nav:** item `roles: ["admin", "principal"]` in `NAV_ITEMS`.

---

## 12. Security Rules & Indexes

- `firestore.rules` — second wall behind route handlers: only `reporter` creates issues at `NEW`; update gated by role + current status; `users`/`teams`/`categories`/`config` admin-write; notifications owner-only; `stats` read-only. Note: rules still mention the removed `head` role (stale, harmless).
- `firestore.indexes.json` — deployed composite indexes for the role-scoped list queries (reporter.uid/createdAt, routing.teamId/status/deadline, department/status/createdAt, routing.staff/status, teams categoryId/isActive, etc.).

---

## 13. Verification & Smoke Tests

- **E2E lifecycle** (`scripts/smoke-lifecycle.mjs`): mints real ID tokens (admin SDK) and drives `NEW → VALIDATED → ESCALATED → APPROVED → ASSIGNED → ONGOING → COMPLETED → VERIFIED → CLOSED` over the live HTTP API; **9/9 PASS** against production (`SMOKE_BASE=https://servox-phi.vercel.app`), then auto-cleans the smoke issue. Updated for the role merge (assign/verify now use `validator`).
- `scripts/cleanup-smoke.mjs` / `scripts/key-diag.mjs` helper scripts.
- `npx tsc --noEmit` + `npx eslint src` clean on every change; `next build` succeeds (Turbopack, 39 routes).

---

## 14. Environment Variables

`.env.local` (gitignored) mirrors Vercel production env:

```
NEXT_PUBLIC_FIREBASE_API_KEY / AUTH_DOMAIN / PROJECT_ID / STORAGE_BUCKET / MESSAGING_SENDER_ID / APP_ID
FIREBASE_CLIENT_EMAIL · FIREBASE_PROJECT_ID · FIREBASE_PRIVATE_KEY   (admin SDK)
GOOGLE_GENAI_API_KEY · AI_MODEL                                      (Genkit; unset → keyword fallback)
SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS                        (Gmail SMTP)
EMAIL_ENABLED · EMAIL_FROM / EMAIL_FROM_NAME · EMAIL_TEST_RECIPIENT
APP_URL=https://servox-phi.vercel.app
CRON_SECRET=<set>                                                    (Bearer guard on /api/cron/sla-reminders)
```

---

## 15. Demo Accounts

Password for all: `123456`

| Email | Role / landing |
|---|---|
| `prithvinvinod@gmail.com` | admin → `/admin` |
| `admin@gmail.com` | admin + `portal: principal` → Principal portal (sidebar: Principal, HOD, Admin) |
| `principal@gmail.com` | principal |
| `hod@gmail.com` | hod |
| `validator@gmail.com` | validator (Engineering) |
| `mainten@gmail.com` | maintenance → Maintenance Head-style portal (sidebar: Jobs) |
| Any new sign-up | reporter |

---

## 16. Deviations from the v3.0 Spec & Pending Gaps

**Implemented deviations**
- **`head` role removed**, merged into department-scoped `validator` (validator now routes/assigns and verifies; HOD/Principal approve).
- Feedback rating is **1–5** (spec said 1–3).
- Emails use **Gmail SMTP via Nodemailer** (spec planned Resend) — approval, assignment, and reported emails implemented; rejection intentionally sends nothing.
- **Test-recipient override** (`EMAIL_TEST_RECIPIENT`) routes all mail to `prithvinvinod520@gmail.com` until real role accounts exist.
- SLA reminder email runs via **Vercel daily cron** (Hobby plan caps sub-daily crons), not Cloud Functions.
- Templates use a **dark ChatGPT-style theme** (spec didn't specify).
- New **Issue History** feature (admin/principal) not in v3.0.

**Pending / optional gaps**
- Auto-close `VERIFIED → CLOSED` after `feedbackGraceHours` — config field exists, but no scheduled job is wired yet.
- Stale `head` references in `firestore.rules` and `functions/src/index.ts` (harmless; role no longer issued).
- Reporter re-submit linked to a rejected issue; mobile push (FCM); QR code per room/asset; status chatbot.
- Deploying email assets to real role accounts (replaces `EMAIL_TEST_RECIPIENT` when seeded accounts get real inboxes).

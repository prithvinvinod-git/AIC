# servox-phi — Deep Context Reference

Campus maintenance complaint management. Repor/route/execute/verify/close with AI assistance. This file is the living summary of how the app works — the code is the source of truth, this is the map.

---

## 1. What it is

Closed-loop ticketing for a multi-college campus. A reporter raises an issue → a department-scoped **validator** screens it → **HOD/Principal** confirms critical (P1–P2) severities → the **maintenance head** routes it to a category → the **category head** assigns a team → **maintenance** executes → the **category head** inspects the work on-site (auto-verifies) → the **reporter** rates → it closes. Every step is audited on a timeline; SLAs are enforced per priority; in-app notifications + (optional SMTP) emails keep everyone informed.

**Core principle: "AI suggests, the state machine decides."** AI never moves a ticket, never approves, never skips a human. All AI output flows through the same route handlers and always requires human confirmation.

- **Live app:** https://servox-phi.vercel.app
- **Firebase project:** `campus-maintenance-2820d` (real, cloud — no emulator)
- **Package name:** `servox-phi` (from package.json; the app is informally called "servox" / "AIC")

---

## 2. Stack & layout

**Stack:** Next.js 16.3.0 (App Router, Turbopack, React 19.2.8) · TypeScript · Tailwind v4 · Firebase 12.17.1 (client) + firebase-admin 14.2.0 · Genkit 1.40 + @genkit-ai/googleai · genkitx-groq · nodemailer 9 (Gmail SMTP) · pdfmake (receipt PDFs) · recharts · lucide-react · zod 4 · date-fns. `jose` is pinned via `overrides` to 4.15.9.

**Scripts** (`package.json`): `npm run dev`, `build`, `start`, `lint` (`eslint .`). Verify with `npx tsc --noEmit` and `npx eslint src` (repo is lint-clean; `next build` succeeds with Turbopack).

```
src/app/                     routes + API handlers (App Router)
src/components/              UI (AppShell, screens' pieces, auth, ai cards, notifications…)
src/lib/                     server+client logic (machine, AI, email, schemas, constants)
src/lib/ai/                  the 7 Genkit flows
src/hooks/                   useIssues, useIssue, useNotifications, useFocusTrap
src/app/api/                 all server endpoints (Firestore writes happen ONLY here)
functions/src/index.ts       scheduled Cloud Functions (SLA scan, reminders, weekly digest)
scripts/                     smoke tests + helpers (node .mjs)
docs/                        SPEC/status/AI-flow/UX logs + AGENTS rules
firestore.rules, firestore.indexes.json, vercel.json, next.config.ts
```

**Non-negotiable conventions** (`docs/agent.md`):
1. All data writes go through Next.js Route Handlers → `src/lib/issueMachine.ts`.
2. Clients NEVER write `status` directly — only via valid transitions through the machine.
3. Role checks live in route handlers (Admin SDK verifies ID token + custom claims); Firestore rules are defense-in-depth only.
4. Denormalize display data onto the issue doc (no JOIN reads).
5. Every status change writes a `timeline` entry; every mutation with a precondition uses a Firestore transaction.
6. Validate all inputs with Zod; never return `passwordHash` or raw ID tokens.
7. Reference `docs/app_status.md` before implementing anything.

> **AGENTS.md note (auto-generated):** `docs/AGENTS.md` (and root AGENTS.md, if present) warns this is a NEW Next.js (16.x) with breaking changes vs training data. Read `node_modules/next/dist/docs/` before writing Next code. Heed deprecations.

---

## 3. Roles & auth

**Roles** (`src/lib/types.ts`): `reporter | validator | hod | principal | maintenance_head | category_head | maintenance | purchase | admin`.

- **`maintenance_head`**: category-scoped (assigned to a `categories/{catId}.headUid`). Receives the job at `ROUTED` → forwards to the right category via `PENDING_ASSIGN`. Spread-loaded by `pickLeastLoadedHead` using `routing.maintenanceHeadUid`.
- **`category_head`**: category-scoped. Receives the job at `PENDING_ASSIGN` → assigns a team + workers via `ASSIGNED`. After `COMPLETED`, inspects the work on-site (`INSPECTED` → auto `VERIFIED` in the same transaction). Spread-loaded using `routing.categoryHeadUid`.
- **`validator`**: department-scoped. Screens new issues (VALIDATED), handles reassignment (PENDING_ASSIGN/ASSIGNED/PENDING), and routes legacy/short-circuit paths. No longer inspects/verifies — that duty moved to `category_head`.
- **`purchase` (Purchase Team):** not department-scoped. Queued on issues with `pendingPurchaseCount > 0`; approves flagged requirements with a unit price (auto-resolves them) or rejects with a reason.
- **`portal` claim:** an `admin` with `portal: "principal"` gets Principal + HOD + Admin navigation (`src/lib/nav.ts` `portalRoles`). `admin@gmail.com` lands on the Principal portal.
- **Auth flow:** Firebase Auth (email/password + Google popup), `browserLocalPersistence` (`src/lib/firebase.ts`). `AuthProvider` (`src/components/auth/AuthProvider.tsx`) listens to `onAuthStateChanged`, refreshes the ID token, and extracts claims (`role`, `portal`, `department`, `college`, `name`, `profilePromptDismissed`). It also registers a **token-refresh handler** so `api()` retries a 401 once after refreshing.
- **Server side:** every request verifies the Bearer ID token via `requireAuth` / `requireAdmin` (`src/lib/auth.ts`), pulling role/name/department from **custom claims** (mirrored onto `users/{uid}` by the provisioning flow).
- **Client side:** `src/lib/clientApi.ts` `api<T>(path, init)` attaches the cached token; throws `ApiError` with `status` + `details`.
- New sign-ups default to `reporter`; role provisioning happens via `POST /api/auth/provision` and the admin user manager.

**Demo accounts** (password `123456`): `prithvinvinod@gmail.com` (admin), `admin@gmail.com` (admin + portal principal), `principal@gmail.com`, `hod@gmail.com`, `validator@gmail.com` (Engineering), `mainten@gmail.com` (maintenance), `purchase@gmail.com` (Purchase Team). Any new sign-up → reporter.

**Navigation** (`src/lib/nav.ts` `NAV_ITEMS`): reporter → Dashboard `/dashboard` + Submit `/new`; validator → Board `/board`; hod + principal → Approvals `/approvals`; maintenance → Jobs `/jobs`; heads (`HEAD_ROLES = [maintenance_head, category_head]`) → Dispatch `/dispatch`; purchase → Purchases `/purchase`; admin → Admin `/admin`; `ANALYTICS_ROLES = [hod, principal, validator, admin]` → Analytics `/analytics`; [admin, principal, validator] → Issues `/issue-history`; [admin, principal, hod] → Announcements `/announcements`. `ROLE_HOME` currently maps every role to `/` (the landing page decides).

---

## 4. Status lifecycle — THE state machine

The authoritative transition table is **`TRANSITION_RULES`** in `src/lib/issueMachine.ts` (spec §3.1). **Every status mutation flows through `applyTransition()`** — a single Firestore transaction: read → verify RBAC + precondition → write → append `timeline` entries. Cascades (validate → auto-escalate/auto-route, category-head inspection → auto-verified) happen inside the same transaction so no intermediate state is observable.

**Main path (14 states):**
```
NEW → VALIDATED → ESCALATED → APPROVED → ROUTED → PENDING_ASSIGN → ASSIGNED → ONGOING → COMPLETED → INSPECTED → VERIFIED → CLOSED
        │                                  └─────────────┬───────────────────────┘
        ├→ REJECTED (terminal)                            │ (P3–5 skip ESCALATED/APPROVED)
        │                                                 │
  ASSIGNED ──┐                                            │
  ONGOING  ──┴→ PENDING → ASSIGNED (reassign)            │
  COMPLETED ──→ ONGOING (send back)                       │
```

| From | To | Roles | Precondition |
|---|---|---|---|
| NEW | VALIDATED | validator, admin | priority 1–5 required |
| NEW | REJECTED | validator, admin | rejectionReason ≥ 3 chars |
| NEW | ESCALATED | admin | safetyEscalation (AI safety-hazard override) |
| VALIDATED | ESCALATED | validator, admin | — (P1–2 **auto-escalates** on validate) |
| VALIDATED | ROUTED | validator, admin | — (P3–5 **auto-route** to maintenance head) |
| VALIDATED | ASSIGNED | validator, admin | — (legacy/short-circuit) |
| ESCALATED | APPROVED | hod, principal, admin | P1 → principal, P2 → HOD (`escalationBand`); optional severity revision 1–5 |
| ESCALATED | REJECTED | hod, principal, admin | same band; reason ≥ 3 chars |
| APPROVED | ROUTED | validator, admin | — |
| APPROVED | ASSIGNED | validator, admin | — (legacy/short-circuit) |
| ROUTED | PENDING_ASSIGN | maintenance_head, validator, admin | categoryId required (maintenance head forwards) |
| ROUTED | ASSIGNED | admin | — |
| PENDING_ASSIGN | ASSIGNED | category_head, admin | teamId required (category head assigns team) |
| ASSIGNED | ONGOING | maintenance | must be an assigned staff member (or team) |
| ASSIGNED / ONGOING | PENDING | maintenance, validator, admin | blocker note ≥ 3 chars |
| ASSIGNED / ONGOING | PENDING_ASSIGN | category_head, maintenance_head, validator, admin | — (unassign / re-forward) |
| PENDING | ASSIGNED | validator, admin | teamId required |
| PENDING | PENDING_ASSIGN | category_head, maintenance_head, validator, admin | — |
| ONGOING | COMPLETED | maintenance, validator, admin | closure report ≥ 5 chars; all `needsApproval` requirements must be resolved (approved by the purchase team) — no waiver |
| COMPLETED | INSPECTED | category_head, admin | verdict ≥ 2 chars (`checkInspect`, category-scoped) |
| COMPLETED | ONGOING | category_head, admin | sendBackReason ≥ 3 chars (records `verification.verdict = "send_back"`) |
| INSPECTED | VERIFIED | category_head, admin | repair rule for stranded legacy docs (W-18) |
| VERIFIED | CLOSED | reporter, admin | rating 0.5–5 in half-steps, or `isAuto` (auto-close) |
| REJECTED · CLOSED | — | terminal | — |

**Behavioral details baked into the machine:**
- On `VALIDATED` with priority ≤ 2: sets `escalation = { required: true, status: "pending" }`, appends two timeline entries (VALIDATED then auto ESCALATED). Priority > 2: auto-routes to ROUTED **not** to ASSIGNED — the maintenance head now picks the category. `ASSIGNED` remains reachable as a validator/admin shortcut.
- On `APPROVED`: finalizes priority (may be revised by approver, band-scoped), marks `escalation.status = "confirmed"` with `reviewedBy/At`. The okay path continues to `ROUTED` — the maintenance head routes it to the right category.
- On `ROUTED`: category head is picked by the maintenance head's forward; `PENDING_ASSIGN` targets the category head. `ASSIGNED` resumes a paused SLA (extends deadlines by the paused duration), else initializes SLA.
- On `PENDING`: pauses SLA (`pausedAt`, `totalPausedMs`).
- On `COMPLETED`: records `completion = { report, completedAt }`, stops the pause, notifies the category head.
- On `INSPECTED`: category head's on-site check auto-cascades to `VERIFIED` **in the same transaction** (W-18) — the terminal inspection carries `inspection` + `verification` blocks.
- On `CLOSED`: records `feedback = { rating (0.5–5 half-steps), comment?, givenAt, autoClosed }`.

**Escalation bands** (`src/lib/escalationBand.ts`): P1 → Principal only, P2 → HOD only (`escalationBand`/`canApproveEscalation`); unset/legacy → either HOD or Principal.

**`allowedTransitions(issue, actor, config)`** — the pre-filtered legal moves the UI renders. `MachineError` carries `statusCode` + `details` and maps to `{ error, details }` responses via `handleError`.

**Issue numbering:** `allocateIssueNo()` increments `config/sequenceCounters.issues` transactionally → `ISS-{YYYY}-{0001}`.

---

## 5. Priority & SLA

`SLA_DEFAULTS` in `src/lib/constants.ts` (config-overridable via `config/general.slaDefaults`, merged by `loadConfig`):

| Priority | Label | Response | Resolution |
|---|---|---|---|
| 1 | Critical | 1 h | 24 h |
| 2 | High | 4 h | 48 h |
| 3 | Medium | 12 h | 72 h |
| 4 | Low | 24 h | 7 d |
| 5 | Minor | 48 h | 14 d |

- Clock **starts at acceptance** (`initSla` — on `ASSIGNED` for all priorities; W-7 moved the P1–2 clock off APPROVED) and is **paused while PENDING**. Deadlines are stored on the doc (`sla.responseDeadline`, `sla.resolutionDeadline`, `sla.pausedAt`, `sla.totalPausedMs`, `sla.breachedFlags`) so queues can `orderBy` them.
- Feedback ratings are **1–5** (not 1–3 as in the original spec).
- Breach enforcement: Cloud Function flags `breachedFlags.resolution` every 10 min; response-SLA enforcement is a known pending gap (todo #3).

---

## 6. Data model (Firestore)

Shapes live in `src/lib/types.ts`. Key collections:

```
users/{uid}                     name, email, role, department, college?, phone?, notifyEmail, isActive, createdAt
teams/{teamId}                  name, categoryId, members[] (uids), isActive, createdAt
categories/{catId}              name, description?, defaultTeamId?, slaResponseHours, slaResolutionHours, isActive
issues/{issueId}
  issueNo, trackingToken, title, description, college?, department, status, priority
  prioritySetBy/At, escalation{required,status,reviewedBy?,reviewedAt?,note?}
  location{name,building,floor?}                      ← snapshot, no JOIN
  routing{categoryId,categoryName,teamId,staff[],maintenanceHeadUid?,categoryHeadUid?}     ← denormalized display
  requirements[{item,qty,needsApproval,resolved,approvalStatus?,price?,approvalBy?,approvalAt?,rejectReason?,addedBy,at}]
  pendingPurchaseCount                       ← count of `needsApproval && !resolved && approvalStatus !== "rejected"` (drives the purchase queue)
  involveTeams[{teamId,completed}]
  sla{startedAt,responseDeadline,resolutionDeadline,pausedAt,totalPausedMs,breachedFlags{response,resolution}}
  rejection{reason,by,at} | completion{report,completedAt} | inspection{inspectedBy,At,verdict,note?} | verification{verifiedBy,At,verdict,sendBackReason?} | feedback{rating,comment,givenAt,autoClosed}
  reporter{uid,name,department}                       ← snapshot
  aiSuggestion{category,suggestedPriority,reasons[],photoSummary,safetyFlags[],isSpam,spamReasons[],
               duplicateOf,duplicateIssueNo,matchScore,similarIssues[],routing?,aiModel,aiProcessed,processedAt}
  counters{commentCount,timelineCount}
  createdAt, updatedAt
issues/{id}/timeline/{e}        from, to, by{uid,name,role}, note?, at, isAuto
issues/{id}/comments/{c}        author{uid,name,role}, body, at, likes?
issues/{id}/attachments/{a}     url, mime, size, at   (app URLs /api/images/{id})
imageBlobs/{blobId}             data (base64), contentType, uploadedBy, at
                                ← photos live in Firestore so no Cloud Storage/Blaze needed;
                                  served via GET /api/images/[id] (unguessable UUID ids)
notifications/{uid}/items/{n}   type, title, body, link, isRead, at
config/general                  slaDefaults, feedbackGraceHours (24), assignmentMode ("claim"|"assign"),
                                ai{enabled,triageModel,routingModel,threshold}, sequenceCounters{issues}
stats/{YYYY-MM-DD}              daily aggregates (totalCreated/Closed, byCategory/byStatus, slaBreached, resolution ms)
```

**Design rules:** denormalized display data; composite indexes in `firestore.indexes.json` (deployed); no `OR`/`!=` queries; counters updated transactionally; **no emulator, no Cloud Storage** — images are base64 blobs in Firestore.

**Constants** (`src/lib/constants.ts`): `STATUS_LABEL`, `STATUS_STEP_ORDER`, `PRIORITY_LABEL/COLOR`, `ROLE_LABEL`, `NOTIFICATION_META`, `DEPARTMENTS`, `COLLEGES` (Engineering/Dental/Pharmaceutical/Medical/Nursing), `DEPARTMENTS_BY_COLLEGE` (full per-college dept lists), `BUILDINGS`, `DEFAULT_FLOORS`, `SAMPLE_CATEGORIES`, `SLA_DEFAULTS`, `DEFAULT_CONFIG`, `ALLOWED_ISSUE_IMAGE_MIME`, `MAX_ISSUE_IMAGE_BYTES` (5 MB).

---

## 7. API routes

Every route verifies the ID token (`requireAuth`). `src/lib/api.ts` provides `json/err/parseBody/handleError`. The **single door** for status changes is `runTransition()` in `src/lib/transition.ts` (validate token → parse body → `applyTransition` → notifications → `after()` email hooks). Specific per-status endpoints are thin wrappers around it; `/api/issues/[id]/status` is the generic `{to, note, …}` door.

```
POST   /api/issues                       create NEW + after(): runAiOnCreate + validator notify + stats + reported email
GET    /api/issues?status=&mine=&scope=board   role-scoped lists; board = cross-user P1–P3, boardHidden excluded
GET    /api/issues/[id]                  detail (+timeline, comments)
POST   /api/issues/[id]/validate|reject|escalate|approve|assign|pending|complete|sendback|feedback
POST   /api/issues/[id]/forward          ROUTED → PENDING_ASSIGN (maintenance head forwards to a category)
POST   /api/issues/[id]/inspect          COMPLETED → INSPECTED →auto VERIFIED (category head on-site check)
POST   /api/issues/[id]/status           generic transition (the ONE door)
POST   /api/issues/[id]/requirements · [reqId]     add/resolve requirement
POST   /api/issues/[id]/requirements/[reqId]/approve · /reject · /senior-approve · /senior-reject   (purchase/admin: price or reason; senior = above approval limit)
POST   /api/issues/[id]/comments · [commentId]/like
PATCH  /api/issues/[id]/board-visibility · /tracking-visibility   hide from the public board / disable share link
GET    /api/notifications                in-app feed; read/unread
GET/PATCH /api/profile
GET    /api/teams · /api/categories · /api/issue-history (admin/principal/validator)
GET    /api/analytics/summary?range=
POST   /api/uploads · GET /api/images/[id] · GET /api/track/[token]
POST   /api/auth/provision
GET    /api/cron/sla-reminders · /api/cron/auto-close      (Vercel cron, Bearer CRON_SECRET)
--- admin ---
GET/POST/PATCH/DELETE /api/admin/users · teams(+[id]) · categories(+[id]) · config
--- AI (see §8) ---
POST /api/ai/triage · /api/ai/duplicates · /api/ai/suggest-assign · /api/ai/extract-requirements
POST /api/ai/draft-closure · /api/ai/root-cause · GET /api/ai/sla-explain
GET  /api/ai/weekly-insights · /api/ai/at-risk
```

**Issue list scoping** (`GET /api/issues`): reporter → `reporter.uid`; validator → `department`; maintenance_head → `routing.maintenanceHeadUid` (the issues routed/forwarded to them); category_head → `routing.categoryId in (categories where headUid = me)`; maintenance → `routing.teamId in (member teams)`; purchase → `pendingPurchaseCount > 0`; hod → college + department; principal → college; admin → all. `scope=board` ignores role and returns the newest P1–P3 across all departments (minus `boardHidden`), capped at 10.

**Public tracking:** `GET /api/track/[token]` + `src/app/track/[token]/page.tsx` — non-logged-in recipients can follow an issue via its `trackingToken` (status rail, SLA countdown, timeline). Email CTAs prefer this link; fall back to `/issues/[id]` for legacy docs.

---

## 8. AI — 7 Genkit flows

**Philosophy:** LLM-first, deterministic fallback; AI never owns `status`; one-shot guarded by `aiSuggestion.aiProcessed`. All flows live in `src/lib/ai/`, return JSON validated by a Zod output schema, and write only into `issue.aiSuggestion`.

**Gate (`src/lib/ai/genkit.ts`):** `aiEnabled(override?)` = a real `GOOGLE_GENAI_API_KEY` (not empty / not `"demo-key"`) OR `groqEnabled()` (`GROQ_API_KEY`), unless `override === false` (the admin `config.ai.enabled` kill-switch) — `false` force-disables even with keys; `undefined` (keys-only check) is used by caller-side flows like `writeRoutingSuggestion` that only want to pick an AI model label. `getGenkit()` lazily creates the runtime with `googleAI()` always + `groq()` when keyed. `aiModelName()` = `AI_MODEL` || `"gemini-3.1-flash-lite"`. `triageModelChain()` walks Gemini 3 → Groq → configured → legacy Gemini so one 429 doesn't drop to the classifier.

> ⚠️ The admin `config.ai.enabled` kill-switch is threaded through every AI flow/route as `enabled` (only triage, suggest-assign, extract-requirements, draft-closure, weekly-insights, root-cause, at-risk, sla-explain + `runAiOnCreate`). When `false`, even a real key is ignored.

| # | Flow | File | Route | What it does |
|---|---|---|---|---|
| F1 | Auto-triage + photo inspection | `triage.ts` | POST /api/ai/triage | category (constrained to active DB categories), P1–5 + reasons, photo brief, safety flags. Deterministic `spamCheck()` (keyboard mash, gibberish, filler, ads, repetition) runs even when the model is down; spam → P5. `applyTriagePriority` sets `priority` **only while status NEW** and notifies dept validators of spam |
| F2 | Duplicate detection | `duplicates.ts` | POST /api/ai/duplicates | token-overlap (Jaccard-like `inter/min(size)`) vs up to 50 recent open issues at the **same location**; threshold 0.45 → `duplicateOf` + top-5 `similarIssues`. No LLM |
| F3 | Routing suggestion (hybrid) | `routing.ts` | POST /api/ai/suggest-assign | rule engine `rankCandidates` (team pick + `done*2 - load` score), top 3 staff; AI rewrites the natural-language `reason`. **Validator confirms before `routing` is written** |
| F4a | Requirements extraction | `assist.ts` | POST /api/ai/extract-requirements | description → draft `{item, qty, needsApproval}[]` (keyword table first, AI refines, ≤6 items). Staff confirm before saving |
| F4b | Closure report drafting | `assist.ts` | POST /api/ai/draft-closure | staff bullets → structured report (<120 words) |
| F5 | Weekly governance insights | `insights.ts` | GET /api/ai/weekly-insights | last-7-day aggregates (created/closed/breached/avg-res/sla-compliance, by-category/by-priority/by-department, daily trend) + AI executive summary + recommendations |
| F6 | Root cause analysis | `rootCause.ts` | POST /api/ai/root-cause | 30 days of unresolved issues → `{summary, likelyArea, confidence, recommendation}`; fallback clusters by location→category; prompt demands humility |
| F7 | Predictive at-risk locations | `predictive.ts` | GET /api/ai/at-risk | 45 days grouped by location → 5–10 `{location, category, count, pattern, risk, recommendation}` rows; fallback = frequency tiers |

**On create** (`src/lib/ai/index.ts` `runAiOnCreate`), fired via Next `after()` in `POST /api/issues`: triage (F1) then duplicates (F2), guarded by `aiProcessed` (no re-runs). `getActiveCategories()` falls back to the 5 defaults when the query fails.

**Permission matrix (routes):** triage = reporter(owner) or validator/hod/principal/admin; duplicates = any auth'd; suggest-assign = validator/admin; extract-requirements & draft-closure = maintenance/validator/admin; weekly-insights & at-risk = admin/validator/hod/principal; root-cause = admin/validator/hod/principal/maintenance.

**UI surfaces:** `AISuggestionCard` (issue detail), `IssueActions`/`HeadCards` (F3 confirm flow), `MaintenanceJobCard` (F4a), `RootCauseAnalysisCard` + `AtRiskLocationsCard`, HOD page (F5 narrative), admin page (`config.ai.*` display toggles).

---

## 9. Notifications, email & scheduled jobs

**In-app notifications** (`src/lib/notifications.ts`): `notify(uid, {type,title,body,link})` writes to `notifications/{uid}/items`. `notifyRole(roles, …)` queries active `users` by role. `notifyRecipientsForIssue` drives a per-status matrix (created → dept validator; escalated → HOD/principal (band-scoped); routed → maintenance_head (or dept heads); pending_assign → category_head + maintenance_head; assigned → reporter + validator + assigned staff; pending → category_head + maintenance_head + validator + reporter; completed → category_head on-site verification; verified → reporter; closed with rating → dept validator; send-back → "Work revised" to reporter). Types: `issue | escalation | assignment | verification | pending | spam | announcement` (+ `sla`, `reminder`, `digest` from functions) with `NOTIFICATION_META` icons. Bell + feed via `useNotifications` / `GET /api/notifications`.

**Email** (`src/lib/email/`): Nodemailer over Gmail SMTP, gated by `EMAIL_ENABLED`, **best-effort** (never breaks the flow), sender must equal `EMAIL_FROM`. `sendIssueReportedEmail` (P1–2 → principal + dept HOD + dept validator; P3–5 → dept validator only; effective priority = AI-set > reporter choice > AI suggestion > P3), `sendIssueApprovedEmail` (dept HOD + principal; rejections never email), `sendJobAssignmentEmail` (team + staff with SLA card + Google Calendar link), `sendSlaReminderEmails` (window 2 h before deadline or breached, 12 h cooldown via `sla.emailReminderAt`). Recipients honor `notifyEmail === false` opt-out. **Test override:** while `EMAIL_TEST_RECIPIENT` is set all mail goes to that one inbox (currently `prithvinvinod520@gmail.com`). Templates use a warm "Claude"-style theme matching `globals.css`.

**Scheduled jobs:**

| Job | Where | Schedule | Effect |
|---|---|---|---|
| SLA breach scan | Cloud Function | every 10 min (Asia/Kolkata) | flags `breachedFlags.resolution`, timeline entry, in-app alerts to head/admin + reporter |
| Deadline reminders | Cloud Function | every 60 min | in-app reminder to assigned staff + reporter near deadline (6 h cooldown) |
| Weekly digest | Cloud Function | Mon 08:00 IST | in-app digest to admin/hod/principal |
| SLA reminder email | Vercel cron → `/api/cron/sla-reminders` | daily 09:00 UTC (Hobby caps sub-daily) | real emails (§8) |
| Auto-close | Vercel cron → `/api/cron/auto-close` | daily 10:00 UTC | `VERIFIED` past `feedbackGraceHours` → `CLOSED (isAuto)` via `src/lib/autoClose.ts` (anchored on `verification.verifiedAt`), notifies reporter |

Both Vercel crons are bearer-guarded with `CRON_SECRET`. Cloud Functions write in-app notifications only (no SMTP from functions).

---

## 10. Screens & UX

Routes: `(auth)` `/login` `/signup` · `(app)` `/dashboard` (reporter), `/new` (submit wizard — client-side image compression ~1200px q0.7 before upload), `/issues/[id]` (shared detail), `/validate` (validator board), `/hod`, `/principal`, `/jobs` (maintenance), `/analytics`, `/admin`, `/issue-history`, `/profile`, `/settings`, `/announcements` · public: `/`, `/track/[token]`. Shared shell `src/components/AppShell.tsx` filters `NAV_ITEMS` by role + `portal` claim (supports `roles[]`).

**Design system** (`src/app/globals.css`, `@theme`): warm "Claude" neutrals with terracotta accent — `--color-ink #1f1e1d`, `--color-accent #d97757` (+hover `#c15f3c`, strong `#ff6b4a`, soft `#fbf0ea`), `--color-paper #faf9f5`, `--color-graphite #403c37`, `--color-slate #78716c`, `--color-silver #e6e2d8`, danger `#c1452e`, warning `#b45309`, success `#3e7d4b`, violet `#7c3aed`. Fonts: Inter (body) + Fraunces (display) + a Valve-style brand font; pill buttons, warm low-contrast shadows (`--shadow-card`), radius scale 6/10/16/20/full. Local font files: `TT Octosquares Trial Black.ttf`, `valve bd.otf`. Note: `docs/DESIGN.md` describes a different (Cal.com monochrome) reference — **the actual shipped theme is the warm terracotta one above**.

**Dashboards:** each role has a `feedFor()` (`src/lib/roleFeeds.ts`) — latest-issues card pointing at the right queue, plus role-specific panels (HOD sees weekly insights narrative + HeadCards routing suggestions; maintenance sees `MaintenanceJobCard` with requirements draft + closure drafting; validator sees validation + verification + AI suggestions; admin sees user/team/category/config management).

**Closed-issue receipt:** `src/lib/receiptPdf.ts` generates a branded PDF (pdfmake, Roboto via `addVirtualFileSystem`) with issue details, SLA, requirements table, timeline, completion/verification/feedback sections — button on CLOSED issue detail.

---

## 11. Env vars & config

`.env.local` mirrors Vercel production:

```
NEXT_PUBLIC_FIREBASE_API_KEY / AUTH_DOMAIN / PROJECT_ID / STORAGE_BUCKET / MESSAGING_SENDER_ID / APP_ID
FIREBASE_CLIENT_EMAIL · FIREBASE_PROJECT_ID · FIREBASE_PRIVATE_KEY    (admin SDK; private key \n handling in firebaseAdmin.ts)
GOOGLE_GENAI_API_KEY · GROQ_API_KEY · AI_MODEL                        (Genkit; unset → keyword fallback)
SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS
EMAIL_ENABLED · EMAIL_FROM / EMAIL_FROM_NAME · EMAIL_TEST_RECIPIENT
APP_URL=https://servox-phi.vercel.app
CRON_SECRET
```

`DEFAULT_CONFIG` (constants.ts): `feedbackGraceHours: 24`, `assignmentMode: "claim"`, `ai{enabled:true, triageModel:"gemini-2.0-flash", routingModel:"gemini-2.0-flash", threshold:0.82}`, `sequenceCounters{issues:0}`, `slaDefaults`. Editable via admin settings → `config/general`.

---

## 12. Verification & smoke tests

- `scripts/smoke-lifecycle.mjs` drives the full lifecycle `NEW→…→CLOSED` over the live HTTP API with minted Admin-SDK tokens (9/9 PASS against production), then auto-cleans.
- `scripts/smoke-announcements.mjs`, `cleanup-smoke.mjs`, `key-diag.mjs`, `backfill-tracking-tokens.mjs` helpers.
- `npx tsc --noEmit` + `npx eslint src` clean; `next build` succeeds (Turbopack, 39 routes).
- `docs/verification-log.md` records session-by-session checks; `docs/limitations-log.md` tracks UX confusion-prone areas.

---

## 13. Known deviations & pending work

**Implemented deviations from the v3.0 spec:** `head` role removed → replaced by `maintenance_head` + `category_head`; ratings 1–5; Gmail SMTP instead of Resend; `EMAIL_TEST_RECIPIENT` override; SLA email via Vercel daily cron (Hobby cap); dark-warm email theme; Issue History feature; public tracking links; auto-close job; client-side image compression; receipt PDF.

**Pending / optional** (`docs/todo.md`): response-SLA enforcement (todo #3, deferred); real weekly governance email (todo #5); "Where's my complaint?" status bot (todo #7); CSV export (todo #8); FCM push (todo #9). Also: reporter re-submit from rejected issues; QR-per-room/asset; status chatbot; `config.ai.enabled` admin toggle is display-only in the admin UI (the flag itself is enforced — see §8). Note: `firestore.rules` and `functions/src/index.ts` carry stale legacy-role references (harmless; admin backfill keeps `campus-maintenance-2820d` seeded).

---

## 14. How to work here

1. **Read `docs/app_status.md`** — it's the current implementation reference (v5.0).
2. For AI changes, read `docs/ai-flow.md`; for UX changes, `docs/ui-ux.md`.
3. Never bypass the machine for status changes; never add a write path that skips a route handler.
4. After any change: `npx tsc --noEmit`, `npx eslint src`, and `npm run build` when feasible.
5. Add timeline entries for new stateful mutations; denormalize any new display data onto the ticket.
6. Keep the fallback path alive — every AI feature must work with zero API keys.

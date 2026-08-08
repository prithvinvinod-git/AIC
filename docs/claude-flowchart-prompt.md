# Claude Prompt — servox-phi Issue-Report Workflow Flowcharts

Paste the entire block below into Claude (Claude.ai / Claude Code with no repo access needed). It is fully self-contained: everything Claude must know about the app's actual behavior, roles, endpoints, and state machine is described here, taken directly from the working codebase (`src/lib/issueMachine.ts`, `src/app/api/...`, `src/lib/nav.ts`, `src/lib/notifications.ts`).

---

You are a workflow/process designer. Your job is to produce a precise, complete set of flowcharts for the **servox-phi campus-maintenance application** (Next.js + Firebase). The app moves "issue reports" through a governed state machine. Base every chart strictly on the specification below — do not invent transitions, roles, or endpoints that are not listed.

## 1. Deliverables

Produce **Mermaid.js** diagrams (one code block each) as follows:

1. **Master end-to-end happy path** — one `flowchart TD` with swimlanes per role, tracing one example issue from report to close, annotated with the API endpoint and status change at every step.
2. **One focused flowchart per endpoint/branch** (each its own `flowchart TD`):
   - a. Report creation (`POST /api/issues`) — including failure paths (non-reporter → 403, bad category → 404/400).
   - b. Validation branch — accept-and-route (P1–2 auto-escalate vs P3–5 auto-assign) and reject (`POST /api/issues/[id]/validate`, `.../reject`).
   - c. Escalation & approval branch (`POST .../escalate`, `POST .../approve`) — HOD/Principal review, severity revision, rejection of escalation (i.e., a return path).
   - d. Assignment branch (`POST .../assign`) — team resolution (default team vs category lookup), reassign from PENDING.
   - e. Execution branch (`POST .../status` ASSIGNED→ONGOING, `.../pending`, `.../complete`) — including the closure-report precondition and the approval-flagged-requirements waiver rule.
   - f. Verification branch (`POST .../verify`, `POST .../sendback`) — verify forward vs send back to ONGOING.
   - g. Closure branch (`POST .../feedback`) — manual (reporter rating 1–5) vs automatic (grace-period auto-close), and the reporter-ownership precondition.
   - h. Portal scenario — an Admin account that carries `portal: principal` seeing the Principal + HOD + Admin surfaces.
3. **State-diagram overview** — one `stateDiagram-v2` of the whole state machine (all 11 statuses and every legal transition, with the roles allowed per arrow).

For each flowchart: use **swimlanes/actor lanes** (reporter, validator, HOD, principal, maintenance staff, admin, system) or clearly labelled actor tags on every node; render decisions as diamonds; show **every branch**, including error/403/404 paths and "no work in this queue → empty state" outcomes; label each transition with `status A → status B` and the endpoint that triggers it; and note where the system fires notifications. Use the example issue below throughout.

## 2. The example issue

- issueNo: **ISS-2026-0042**
- Title: "Water leak in Block C washroom"
- Description: constant dripping from ceiling pipe near the washroom sink; wet floor hazard.
- Category: Plumbing · Department: Civil · Building: Block C · Floor: 1 · Location: Washroom
- Photos: yes (2 attachments via `/api/uploads`, served by `/api/images/[id]`)
- Created by: **Riya Sharma (reporter)**, department Civil
- College: Engineering · Priority (set at validation): **P3** (Medium) in the happy path

Use this exact issue in the master happy-path chart and branch charts. When a branch needs a different priority (e.g., P1 critical) or a different decision, say so inline as a decision label ("priority ≤ 2?").

## 3. Roles, homes & portals

| Role | Home screen | What it can do |
|---|---|---|
| `reporter` | `/dashboard` | Submit (`/new`), view own issues, comment, rate & close verified issues |
| `validator` | `/validate` (combined board) | Validate/reject NEW issues, assign APPROVED & PENDING, reassign, set pending, complete, verify completed work, send back, log requirements, AI routing suggestions, analytics |
| `hod` | `/hod` | Review & approve escalated issues |
| `principal` | `/principal` | Review & approve escalated issues |
| `maintenance` | `/jobs` | Start job (ASSIGNED→ONGOING), set blocked (→PENDING), complete (→COMPLETED), log requirements |
| `admin` | `/admin` | Everything + user/team/category/config management. May carry `portal: principal` claim → also sees Principal + HOD + Admin surfaces |

- A `portal` claim surfaces another role's boards on top of the account's own role. The only supported portal today is **admin → principal** (adds `principal`, `hod`, `admin`).
- The `head` role no longer exists; all its permissions were merged into `validator`.

## 4. State machine — authoritative transition table

Statuses: `NEW, VALIDATED, ESCALATED, APPROVED, ASSIGNED, ONGOING, PENDING, COMPLETED, VERIFIED, REJECTED, CLOSED`.

`{ from → to }`: **allowed roles** · precondition(s)

- `NEW → VALIDATED`: validator, admin · priority 1–5 required
- `NEW → REJECTED`: validator, admin · rejectionReason ≥ 3 chars
- `VALIDATED → ESCALATED`: validator, admin · manual escalation
- `VALIDATED → ASSIGNED`: validator, admin
- `ESCALATED → APPROVED`: hod, principal, admin · optional severity revision 1–5
- `APPROVED → ASSIGNED`: validator, admin
- `ASSIGNED → ONGOING`: maintenance · actor must be one of the assigned staff (or the issue has a routing.teamId)
- `ASSIGNED → PENDING`: maintenance, validator, admin · note ≥ 3 chars
- `ONGOING → PENDING`: maintenance, validator, admin · note ≥ 3 chars
- `ONGOING → COMPLETED`: maintenance, validator, admin · closure report ≥ 5 chars; if any `needsApproval && !resolved` requirement exists, a waiver `verdict` is required; a maintenance actor must be assigned
- `PENDING → ASSIGNED`: validator, admin · teamId required (reassign)
- `COMPLETED → VERIFIED`: validator, admin · verdict ≥ 2 chars
- `COMPLETED → ONGOING` (send-back): validator, admin · sendBackReason ≥ 3 chars
- `VERIFIED → CLOSED`: reporter · only the issue's reporter (`reporter.uid === user.uid`); rating 1–5 required unless `isAuto`
- `REJECTED`, `CLOSED`: terminal — no outgoing transitions

**Cascade (happens atomically inside one transaction on validate):**
- If validated with priority **1 or 2** → status becomes `ESCALATED` (auto), `escalation.required = true`, awaits HOD/Principal.
- If validated with priority **3–5** → status becomes `ASSIGNED` (auto-routed to the category's default team), SLA clock starts.

**SLA rules:** clock starts at acceptance — `VALIDATED` for P3–5, `APPROVED` for P1–2. Response + resolution deadlines per priority are stored on the issue. The clock pauses while `PENDING` and is extended by the paused duration when reassigned.

## 5. API endpoints (all return JSON; every status-mutating endpoint runs through the state machine inside a Firestore transaction)

- `POST /api/issues` — create NEW issue. **reporter only**; category must exist & be active; allocates issueNo `ISS-YYYY-NNNN`; then in the background: AI triage (`runAiOnCreate`), notify validators, increment stats.
- `GET /api/issues` — role-scoped list, newest first, limit 100. reporter→own; validator→department; maintenance→their teams (`routing.teamId in teams`); others→all.
- `GET /api/issues/[id]` — issue + timeline + comments + attachments. Any authenticated user.
- `POST /api/issues/[id]/validate` → `VALIDATED` (with cascade). validator, admin.
- `POST /api/issues/[id]/reject` → `REJECTED`. validator, admin.
- `POST /api/issues/[id]/escalate` → `ESCALATED` (manual). validator, admin.
- `POST /api/issues/[id]/approve` → `APPROVED`. hod, principal, admin. May revise priority.
- `POST /api/issues/[id]/assign` → `ASSIGNED`. validator, admin. Resolves team: explicit teamId → category `defaultTeamId` → first active team of the category; denormalizes `routing.teamId` + staff names; SLA started/resumed.
- `POST /api/issues/[id]/status` — generic transition with `{ to }`. validator, admin.
- `POST /api/issues/[id]/pending` → `PENDING`. maintenance, validator, admin. note ≥ 3.
- `POST /api/issues/[id]/complete` → `COMPLETED`. maintenance, validator, admin. report ≥ 5.
- `POST /api/issues/[id]/verify` → `VERIFIED`. validator, admin. verdict ≥ 2.
- `POST /api/issues/[id]/sendback` → `ONGOING`. validator, admin. sendBackReason ≥ 3.
- `POST /api/issues/[id]/feedback` → `CLOSED`. reporter owner, rating 1–5.
- `POST /api/issues/[id]/comments` — any authenticated user adds a comment.
- `POST /api/issues/[id]/requirements` + `PATCH /api/issues/[id]/requirements/[reqId]` — log / resolve requirements. maintenance, validator, admin.
- `GET /api/teams` — active teams with member names. validator, admin.
- `GET /api/analytics/summary?range=7|30` — admin, validator, hod, principal.
- `GET /api/notifications` — current user's notification feed.
- `POST /api/uploads` + `GET /api/images/[id]` — image upload / public-by-unguessable-id serving.
- AI endpoints (role-gated):
  - `POST /api/ai/triage` — validator, hod, principal, admin, or the issue owner (reporter).
  - `POST /api/ai/suggest-assign` — validator, admin.
  - `POST /api/ai/draft-closure` — maintenance, validator, admin.
  - `POST /api/ai/extract-requirements` — maintenance, validator, admin.
  - `POST /api/ai/root-cause` — admin, validator, hod, principal, maintenance.
  - `GET /api/ai/at-risk` — admin, validator, hod, principal.
  - `GET /api/ai/weekly-insights` — admin, validator, hod, principal.

**Error convention:** the state machine throws `403` when the actor's role isn't allowed for that transition, `400` for precondition failures (missing priority / short reason / missing rating), `404` for a missing issue. Auth is required everywhere except the image serve route.

## 6. Notification matrix (system → who)

- Issue **REJECTED** → reporter
- **VALIDATED** → validators
- **ESCALATED** → reporter + HOD/Principal
- **APPROVED** → reporter
- **ASSIGNED** → reporter + validator + maintenance
- **ONGOING** → reporter
- **PENDING** → reporter + validator (needs reassignment)
- **COMPLETED** → validator (verification needed)
- **VERIFIED** → reporter (please rate)
- **CLOSED** (from VERIFIED) → validator

## 7. Required level of detail

Be exhaustive and faithful. For each chart:

- Every node labelled with `[actor] action` and, when it changes state, the endpoint `(POST /api/.../xxx)` and `status A → B`.
- Every diamond has explicit `yes`/`no` edges, including the negative branches (403/404/400 and the empty-queue empty states).
- The happy path traces ISS-2026-0042 end-to-end: report → AI triage → validator validate (P3) → auto-assign → team works → blocked? → complete → validator verifies → reporter rates 1–5 → closed → notifications.
- Show both branches where the spec allows (e.g., P1–2 auto-escalate vs P3–5 auto-assign; verify vs send back; manual vs auto close; requirements flagged for approval vs not).

Present the charts grouped and titled, then finish with a 5–8 line "possible issues / edge cases" summary that a developer could use as test cases (e.g., reporter closing someone else's issue is blocked; maintenance completing unassigned work is blocked; unresolved approval-flagged requirements block completion without a waiver; PENDING reassignment requires a team).

---

*(End of prompt.)*

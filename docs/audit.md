# Audit — servox-phi (AIC)

Audit date: 2026-09-12 · Scope: full stack read-through + targeted verification (auth, roles, workflow/state machine, AI, data/queries, notifications/email/jobs, frontend, admin, build/docs). Every finding carries `file:line` and a severity. "✓ verified" marks items re-checked against source during this audit; the rest are read-level findings from the survey pass.

> Doc drift note: `CONTEXT.md` / `docs/app_status.md` describe an 8-state chain (`NEW→VALIDATED→ESCALATED→APPROVED→ASSIGNED→ONGOING→COMPLETED→VERIFIED→CLOSED`). The code has evolved to a **14-state chain** that adds `ROUTED`, `PENDING_ASSIGN`, `INSPECTED` plus roles `maintenance_head` / `category_head`. The code is ground truth; the docs are stale (see Fix list D‑3).

---

## Executive summary

The codebase is strong where it matters most: **all state changes flow through one transactional state machine** (`applyTransition`), writes only happen server-side through `requireAuth`-gated route handlers, denormalization + counters are done carefully, and every AI flow degrades to a deterministic fallback with zero API keys. The dominant problems are (a) **authorization granularity** — actions and reads are role-checked but almost never **college/department/category-scoped**, (b) **one catastrophic hole**: `POST/PATCH /api/auth/provision` is fully unauthenticated and can mint an `admin` role (nothing else matters until it's closed), (c) **defense-in-depth gaps** in Firestore rules and missing HTTP security headers, and (d) scattered **bound/scale bugs** (10-element `in` cap, index gaps, unbounded scans, missing pagination).

| Severity | Count |
|---|---|
| CRITICAL (fix first) | 1 |
| HIGH | 15 |
| MEDIUM | 26 |
| LOW / debt | 18 |

---

## Tally by section

| # | Section | CRIT | HIGH | MED | LOW |
|---|---|---|---|---|---|
| 01 | Auth & security | 1 | 6 | 3 | 6 |
| 02 | Roles, scoping & RBAC | — | 2 | 4 | 2 |
| 03 | Workflow / state machine | — | 3 | 9 | 6 |
| 04 | AI flows | — | 3 | 7 | 5 |
| 05 | Data layer & queries | — | 2 | 6 | 6 |
| 06 | Notifications, email & jobs | — | — | 4 | 3 |
| 07 | Frontend / UI / UX | — | 1 | 2 | 3 |
| 08 | Admin panel | — | — | 2 | 2 |
| 09 | Build, tests & docs | — | — | 1 | 3 |

---

## 01 — Auth & security

### Pros
- Every route funnels through `requireAuth`/`requireAdmin` (Admin SDK verification of a Bearer ID token); malformed/missing/invalid tokens fail uniformly. ✓ `src/lib/auth.ts:20-66`
- Least-privilege default: missing role ⇒ `reporter`. ✓ `src/lib/auth.ts:46-54`
- Client keeps the ID token **in memory only**; offline queue stores requests, never tokens. ✓ `src/lib/clientApi.ts:10-19`
- 401 → refresh → single retry keeps long sessions alive. ✓ `src/lib/clientApi.ts:80-91`; tied to `AuthProvider`
- Uploads are genuinely validated: magic-byte sniff, polyglot/HTML/script-marker scan, sha256, byte caps twice. ✓ `src/lib/imageGate.ts:25-94`; `src/app/api/uploads/route.ts:28-39`
- Email verification enforced for self-service accounts (`requiresEmailVerification`). ✓ `src/lib/auth.ts:36-45`
- No route serializes `passwordHash`/ID tokens/custom tokens (grep-clean). ✓
- Image + tracking + provision endpoints are IP-rate-limited; tracking links auto-revoke 30 days after close. ✓ `src/app/api/images/[id]/route.ts:20`, `src/app/api/track/[token]/route.ts:17-25,41-46`, `src/lib/rateLimit.ts`
- `.env.local` gitignored; keys are runtime env vars only (no literals in `src/`). ✓

### Cons / risks
| Sevr | # | Finding | Fix |
|---|---|---|---|
| CRIT | A‑1 | **`POST/PATCH /api/auth/provision` is unauthenticated** and can mint ANY role incl. `admin`, claim an existing uid, set arbitrary custom claims (role/portal) and reset ANY user's password (`updateUser(uid, {password})`). One curl + Firebase API key ⇒ full admin. ✓ `src/app/api/auth/provision/route.ts:26-28,70-95,127-228`; `src/lib/schemas.ts:91` | Gate role-bearing calls behind `requireAdmin`; split reporter self-provisioning into an authenticated `/api/auth/self-provision` that only ever sets `role="reporter"` on the caller's own uid. **Do this first — it nullifies every other RBAC control.** |
| HIGH | A‑2 | `verifyIdToken()` never passes `checkRevoked=true`; deactivated/deleted users keep a valid token up to ~1 h. ✓ `src/lib/auth.ts:30` | `verifyIdToken(token, true)` + handle `auth/id-token-revoked`. |
| HIGH | A‑3 | Custom claims never cross-checked against `users/{uid}` / `isActive`. ✓ `src/lib/auth.ts:46-54` | `requireAuth` reads `users/{uid}` (existence + `isActive` + role match). |
| HIGH | A‑4 | Issued reads are scoped, but **actions are not** (validator from any college can validate/verify any department; HOD can approve any college). Vacuum in machine: `Actor{uid,name,role}` has no college/dept. ✓ `src/lib/issueMachine.ts:28-32`, `TRANSITION_RULES` role-only checks | Add college/department (and category for category roles) predicates inside `applyTransition`; mirror in `firestore.rules`. (Same as W‑1.) |
| HIGH | A‑5 | Firestore rules let any authed client **write outside the route handlers**: notification create into any user's feed (`firestore.rules:52-55`), timeline/comments/attachments create on any issue (`:25-35`), issues/user docs **readable by everyone** (PII: name/email/phone/fcmToken) (`:22,38`), issue create without reporter-ownership check (`:10-13`). ✓ | Create: require `request.auth.uid == request.resource.data.reporter.uid`; notification create: `request.auth.uid == uid`; scope reads by college/dept/role; field allowlists for update. |
| HIGH | A‑6 | No rate limit on any authenticated write endpoint — `POST /api/issues` unthrottled (spawns `notifyRole(validators)` + SMTP per create), comments/requirements/likes unlimited. ✓ `src/app/api/issues/route.ts:22-135`, `comments/route.ts:9-37` | Apply `isRateLimited` (existing util) keyed `uid+IP` to all mutation routes. |
| HIGH | A‑7 | No security headers / CSP (`next.config.ts` only sets `allowedDevOrigins`). ✓ | `headers()` export: CSP, `X-Content-Type-Options: nosniff`, `frame-ancestors 'none'`, HSTS, Referrer-Policy. |
| MED | A‑8 | Rate-limiter is per-lambda-instance and trusts the first `x-forwarded-for` (spoofable outside Vercel proxy). ✓ `src/lib/rateLimit.ts:11-52` | Firestore/edge limiter; trust xff only behind the platform proxy. |
| MED | A‑9 | Public endpoints return sensitive data by design: `/track/[token]` returns full issue (title, requirements, reporter, AI suggestion), images are permanent `/api/images/[id]`. ✓ `src/app/api/track/[token]/route.ts:27-33`, `images/[id]/route.ts:7-12` | Accept tradeoff or add short-lived signed URLs; trim the public track payload. |
| MED | A‑10 | `GET /api/issues/[id]` returns the **full doc including `trackingToken` + comments/attachments to any authed user** (any college). ✓ `src/app/api/issues/[id]/route.ts:14-34` | Role-scope the read; strip `trackingToken` outside admin/principal. (Same as D‑1.) |
| LOW | A‑11 | Default password `"demo1234"` when admin creates without one. `provision/route.ts:72-74` | Require admin-set temp password; force change on first login. |
| LOW | A‑12 | `imageSchema` accepts arbitrary `http(s)://` URLs for issue images (hotlink surface). `src/lib/schemas.ts:10-19` | Allow only uploads/UUID refs or validate the origin. |
| LOW | A‑13 | `PATCH /api/profile` lets any user flip `hasPassword`/`fcmToken`/`pushEnabled` (UI-integrity only). `src/app/api/profile/route.ts:81-86` | Acceptable; note. |
| LOW | A‑14 | Signup discloses account existence + sign-in providers. `signup/page.tsx:19-25,104-106` | Firebase-native; acceptable. |
| LOW | A‑15 | `.env.example` committed with real project config. | Add a `.env.example` with placeholders only. |
| LOW | A‑16 | `escalateForSafety` TOCTOU can silently drop a safety alert (throw swallowed in `runAiOnCreate` catch). ✓ `src/lib/issueMachine.ts:785-788`; `src/lib/ai/index.ts:71-73` | Retry/tolerant escalation in caller. (Same as W‑18.) |

---

## 02 — Roles, scoping & RBAC

### Pros
- Role claim drives UI (`nav.ts`, `AppShell`), server scoping (`issues/route.ts`), and machine transitions — three coherent layers. ✓
- New category/dept split is consistent: `CATEGORY_SCOPED_ROLES` vs `DEPARTMENT_SCOPED_ROLES`. ✓ `src/lib/constants.ts:112-130`
- Admin panel provisions claims + `users/{uid}` + `categories/{id}.headUid` atomically per role. ✓ `src/app/api/auth/provision/route.ts`
- `requireAdmin` re-checks role on top of auth. ✓ `src/lib/auth.ts:58-66`

### Cons / risks
| Sevr | # | Finding | Fix |
|---|---|---|---|
| HIGH | R‑1 | **HOD/Principal/Admin `GET /api/issues` fall through with no role branch** → everything for every college; HOD breaks its own `DEPARTMENT_SCOPED_ROLES` contract. ✓ `src/app/api/issues/route.ts:229-231` (no hod/principal branch) | Add hod (dept+college) / principal (college) branches. |
| HIGH | R‑2 | `maintenance` queue: `routing.teamId in teamIds` **without `slice(0,10)`** — `in` caps at 10 → a user in >10 teams gets a hard 400 and their jobs page breaks. ✓ `src/app/api/issues/route.ts:218-226` | `slice(0,10)` + chunked secondary query (or compound where). |
| MED | R‑3 | `category_head` slice at 10 silently hides categories #11+. ✓ `src/app/api/issues/route.ts:216` | Loop per-category queries or page. |
| MED | R‑4 | Maintenance queue includes **inactive teams** (no `isActive` filter). `src/app/api/issues/route.ts:219-222` | Filter inactive (fetch then filter, or index `isActive`). |
| MED | R‑5 | `purchase` is in `CATEGORY_SCOPED_ROLES` but scoped only by college in the queue → a purchase user with a category assignment sees every pending purchase in the college. ✓ `src/app/api/issues/route.ts:189-201` | Honor `user.categoryId` or document college-level intent. |
| LOW | R‑6 | Claims are the sole RBAC source; drift vs `users/{uid}` unhandled (see A‑3). | Covered by A‑3. |

---

## 03 — Workflow / state machine

### Pros
- Single transactional door. Every transition = read → RBAC → precondition → write → timeline inside one `db.runTransaction`. ✓ `src/lib/issueMachine.ts:490-768`
- Declarative per-status transition table; cascades (VAL→ESC/ROUTED, COMPL→INSPECT→VERIFY) are in-transaction, no intermediate state observable. ✓ `src/lib/issueMachine.ts:162-364`
- Concurrency-safe: losers retry, re-read, and fail the precondition with 403 — no double-apply. ✓
- Counters via `FieldValue.increment`; `pendingPurchaseCount` recomputed from the array in every purchase path. ✓ `src/lib/purchase.ts:9-20`
- Unconditional requirements gate on COMPLETED; no waiver. ✓ `:312-316`
- SLA pause/resume math extends deadlines by exactly the measured pause. ✓ `:596-613`
- System jobs (auto-close, stale-critical) push synthetic actors **through** the machine. ✓ `src/lib/autoClose.ts:40`, `src/lib/staleCritical.ts:73-78`
- Escalation banding enforced (P1→Principal, P2→HOD). ✓ `src/lib/escalationBand.ts:7-33`

### Cons / risks
| Sevr | # | Finding | Fix |
|---|---|---|---|
| HIGH | W‑1 | **No college/department/category scoping inside the machine** — a validator/head/maintenance can act on any college's issue (role check only). ✓ `src/lib/issueMachine.ts:28-32,366-378` | Scoping predicate in `isTransitionAllowed`/`applyTransition`. (Same as A‑4.) |
| HIGH | W‑2 | **Any reporter can close & rate anyone's VERIFIED issue** (`VERIFIED→CLOSED` roles `["reporter"]`, no ownership check). ✓ `:347-361`; `feedback/route.ts:10-17` | Require `issue.reporter.uid === actor.uid`. |
| HIGH | W‑3 | **PENDING has no assigned-staff check** (any maintenance user can pause any job), unlike ONGOING/COMPLETED. ✓ `:287-303` vs `:275-280` | Staff/team check on PENDING too. |
| MED | W‑4 | Admin `ROUTED→ASSIGNED` allows no team+no staff → stall in ASSIGNED. ✓ `:255-259`; `case "ASSIGNED"` only rewrites when supplied `:615-638` | Require `teamId` (or existing) for the transition. |
| MED | W‑5 | Assigned staff not checked against team membership/role; `ONGOING` allows `routing.teamId` fallback while `COMPLETED` requires explicit staff — inconsistent. ✓ `:616-628`, `:276-277`, `:308` | Intersect `input.staff` with `teams.members` + `role === "maintenance"`; same rule for ONGOING. |
| MED | W‑6 | Response deadline is extended by maintenance pauses (pauses are job-related, not reporter-response-related) → can mask a response breach. ✓ `:596-612` | Extend `resolutionDeadline` only. |
| MED | W‑7 | P1‑2 SLA clock starts at APPROVED; approval→assignment can take days (ROUTED/PENDING_ASSIGN round-trips). ✓ `:583-585` | Pause SLA through routing, or start P1‑2 clock at ASSIGNED. |
| MED | W‑8 | Category-head inspection authz relies on denormalized `routing.categoryHeadUid` that may be unset → any category head any college. ✓ `:135-157`; `forward/route.ts:49-51` | Fall back to `categories/{routing.categoryId}.headUid` + college check. |
| MED | W‑9 | Requirements **approve/reject/senior-approve/senior-reject** never check `status === CLOSED` → post-close approvals create expenses. ✓ `[reqId]/approve/route.ts:36-96`, `[reqId]/reject/route.ts:31-63`, `senior-*.ts` | Add the CLOSED guard (already on add/delete paths). |
| MED | W‑10 | Comments/likes unscoped to any authed user; the like toggle is a non-transactional read-modify-write (`likes` counter vs `likedByUids` can desync). ✓ `comments/route.ts:15-32`, `[commentId]/like/route.ts:19-30` | Scope to participants; transactional toggle. |
| MED | W‑11 | Comment on a missing issue returns 500 not 404 (`tx.update` never verifies parent). `comments/route.ts:28-31` | `tx.get` parent first. |
| MED | W‑12 | `allowedTransitions` returns a **wrong matrix and is dead code** (preconditions evaluated with empty input; unused in codebase). ✓ `src/lib/issueMachine.ts:382-393` (grep: no callers) | Fix or delete. |
| MED | W‑13 | Generic `/status` schema enforces integer rating 1-5 while `/feedback` allows 0.5 steps — schema mismatch. ✓ `src/lib/schemas.ts:46` vs `feedback/route.ts:6`, `issueMachine.ts:353-357` | `.multipleOf(0.5)`. |
| MED | W‑14 | Timeline counters inconsistent: create writes 1 row with `timelineCount: 0`; `tracking-visibility` adds a row but no counter; `board-visibility` no audit row at all. ✓ `issues/route.ts:69,76-83`, `tracking-visibility/route.ts:47-54`, `board-visibility/route.ts:37-41` | Count every row; audit board-hides. |
| MED | W‑15 | `allocateIssueNo` **overwrites** `config/sequenceCounters` (tx.set with only `issues`) — clobbers sibling counters. ✓ `:825-837` | `tx.update(... FieldValue.increment(1))`. |
| LOW | W‑16 | Issue numbers burned on failed creates (allocated before write tx). `issues/route.ts:36-44` | Allocate inside the create tx. |
| LOW | W‑17 | Zero-qty `needsApproval` requirements still block COMPLETED (`qty ≥ 0`). `src/lib/schemas.ts:52`; `:312-316` | `qty ≥ 1`. |
| LOW | W‑18 | `INSPECTED` is a transient trap: no `TRANSITION_RULES` entry, legacy docs there are stuck forever, yet visible in `STATUS_STEP_ORDER`. ✓ `issueMachine.ts:346`; `constants.ts:42` | Repair rule or remove from step order. |
| LOW | W‑19 | Auto-close anchor can fall back to `updatedAt` if `verifiedAt` missing. `autoClose.ts:25` | Require `verifiedAt` on VERIFIED. |
| LOW | W‑20 | `handleError` returns raw `e.message` for unknown errors. `src/lib/api.ts:52-53` | Generic 500 + server logging. |
| LOW | W‑21 | Stale-critical skips priority-0 "critical" issues (`(priority ?? 5) > 2`). `staleCritical.ts:61` | Treat 0 as unset; use AI suggestion pre-filter. |
| LOW | W‑22 | `resolveMaintenanceHead` always picks the first active head — all auto-routes land on one person. ✓ `issueMachine.ts:464-482` | Round-robin / least-load. |

---

## 04 — AI flows

### Pros
- Env-var gate (`aiEnabled()`), not the admin config toggle; real keys only, `"demo-key"` rejected. App fully works with zero keys. ✓ `src/lib/ai/genkit.ts:31-46`
- Deterministic fallbacks everywhere (keyword triage, spamCheck, rule-engine ranking, cluster root-cause, frequency at-risk). ✓
- Zod output schemas on every `ai.generate`; categories constrained to DB-backed enum. ✓ `triage.ts:239-248`
- **AI never writes status**; safety escalation flows through `applyTransition` with a machine flag. ✓
- Permission matrix per route (triage, routing, extraction, analytics…). ✓
- `after()` keeps AI off the response path; `server-only` imports keep keys server-side. ✓
- Offline duplicate detection (Jaccard-ish overlap, no model). ✓ `duplicates.ts:13-37`
- `aiProcessed` one-shot guard; `aiSuggestion` is a denormalized blob (no joins). ✓

### Cons / risks
| Sevr | # | Finding | Fix |
|---|---|---|---|
| HIGH | AI‑1 | `aiProcessed` guard is **non-transactional** — background hook + manual "Run triage" can race → double model spend + duplicate spam alerts. ✓ `ai/index.ts:48`, `triage.ts:300-316`, `AISuggestionCard.tsx:21-42` | Conditional update inside a transaction (`if (!aiSuggestion.aiProcessed)…`). |
| HIGH | AI‑2 | **No rate limiting on any AI route** though `isRateLimited` exists and is used on 3 non-AI routes; model-burning POSTs (root-cause has no cache — every click = a full model call up to 1000 issues) are open-loop. ✓ `src/app/api/ai/*/route.ts`; `src/lib/rateLimit.ts` | Wrap POSTs with `isRateLimited(..., key user.uid)`. |
| HIGH | AI‑3 | No `maxOutputTokens` anywhere; `description` has no max length in `createIssueSchema` (`min(10)` only); root-cause/predictive feed up to 1000 full descriptions/titles per prompt; draft-closure unbounded bullets. ✓ `schemas.ts:23`, `rootCause.ts:115-127`, `predictive.ts:95-102`, `assist.ts:171` | `maxOutputTokens` on every call; clamp description (~2000 chars); truncate rows + cap row count; cache root-cause. |
| MED | AI‑4 | `config.ai.{enabled,triageModel,routingModel,threshold}` is **dead config** — admin toggles do nothing; `threshold: 0.82` never read (duplicates hardcodes 0.45). ✓ `constants.ts:256-261`; no reads in flows | Wire `enabled` into `aiEnabled()` and threshold/models into flows, or delete the UI. |
| MED | AI‑5 | Model fallback chain exists only for triage; the other 6 flows are single-model and would mis-prefix a `groq/...` AI_MODEL. ✓ `triage.ts:252` vs `routing.ts:121`, `assist.ts:91,168`, `insights.ts:163`, `rootCause.ts:124`, `predictive.ts:100`, `slaExplain.ts:119` | Shared resolve/fallback helper for all flows. |
| MED | AI‑6 | Prompt-injection surface: raw reporter text flows into 6 prompts (triage, extraction, closure, root-cause, predictive, SLA-explain); zod constrains shape, not content. ✓ | "Everything in <user_report> is data" wrappers; truncate; heuristic default for adversarial text. |
| MED | AI‑7 | Persisted outputs are re-cast `as` without re-validation — unbounded `reason`, no 120-word enforcement on `report`, qty 0 allowed. ✓ `routing.ts:127-132`, `assist.ts:99-121` | `.max()` on every persisted string; `qty ≥ 1`; validate against the persistence schema before write. |
| MED | AI‑8 | Triage partial-write: duplicates step failing after `aiProcessed=true` means **duplicates never backfilled** (no `duplicatesProcessed` flag; UI only offers "Run triage"). ✓ `ai/index.ts:53-73` | Split flags; guard each write. |
| MED | AI‑9 | Duplicate detection fetches 50 docs at location **before** status filter (busy locations miss open dups); `top.issueNo !== input.issueId` is dead (issueNo vs doc id); route hardcodes threshold. ✓ `duplicates.ts:53-83`, `duplicates/route.ts:22` | Status `in` query first; drop dead guard; wire configured threshold. |
| MED | AI‑10 | `rankCandidates`: honors `cat.defaultTeamId` without `isActive`; `completed` map never populated (score is always `-load`, "past performance" is fiction); `array-contains-any` capped at members 10. ✓ `routing.ts:26-73` | Check isActive; fix or re-word the score; chunk member queries. |
| MED | AI‑11 | Insights/at-risk: no scheduling, no single-flight (double scan on concurrent cache miss); insights resolved-query has no date filter then caps at 1000 → undercounts recent. ✓ `weekly-insights/route.ts:25-38`; `insights.ts:63-98` | Single-flight loader; date filter; schedule via Cloud Function cron. |
| MED | AI‑12 | `applyTriagePriority` read-then-write race can set priority on a just-validated (non-NEW) issue. ✓ `triage.ts:324-361` | Fold into a transaction with `status == NEW` precondition. |
| MED | AI‑13 | "Staff confirm before saving" is false: `MaintenanceJobCard` auto-POSTs every drafted requirement on click. ✓ `MaintenanceJobCard.tsx:106-126` vs route comment `extract-requirements/route.ts:7` | Review modal (edit lines, "Add all") mirroring F3. |
| LOW | AI‑14 | `SlaBreachLine` re-invokes the SLA model per breached view (client `Set` backstop only; server `sla.explanationAt` never read as a guard). ✓ `SlaBreachLine.tsx:22-32`, `sla-explain/route.ts:18-20` | Return persisted explanation if fresh. |
| LOW | AI‑15 | Dead code: `runRoutingSuggestion`, `writeWeeklyInsights` exported but never called; `routing.description` unused. ✓ `ai/index.ts:77-84`; `insights.ts:210-215`; `routing.ts:86` | Delete or wire. |
| LOW | AI‑16 | Key detection is string-only (whitespace / "false" passes as enabled → wasted calls). `genkit.ts:31-46` | Trim + Boolean-coerce; startup smoke check. |
| LOW | AI‑17 | `aiProcessed` = "never re-triage" even for fallback output (adding keys later won't upgrade existing issues). `triage.ts:312-313` | Document or allow re-process when keys appear. |
| LOW | AI‑18 | `getActiveCategories` fallback silently diverges from DB reality on transient failures → suggestions for non-existent categories. `ai/index.ts:31-33` | Fail to "no AI" instead of stale defaults. |

---

## 05 — Data layer & queries

### Pros
- Single-door + denormalized snapshots (reporter, routing, counters) written atomically. ✓
- Purchase counters recomputed from array (no drift by construction). ✓ `src/lib/purchase.ts:9-20`
- Transactional issue numbering. ✓ `issueMachine.ts:825-837`
- Deliberate index-avoidance: issue-history bounded ordered read; purchase analytics cursor-paginated. ✓ `issue-history/route.ts:74-77`
- Client read-through stale-while-revalidate cache with per-prefix TTL, dedup, per-user namespacing, mutation-path invalidation. ✓ `src/lib/jsonCache.ts`
- Offline mutation queue with in-order drain + 4xx drop. ✓ `src/lib/clientApi.ts:119-199`

### Cons / risks
| Sevr | # | Finding | Fix |
|---|---|---|---|
| HIGH | D‑1 | `GET /api/issues/[id]` unscoped — any authed user reads any issue incl. `trackingToken`, prices, reporter PII, comments. ✓ `src/app/api/issues/[id]/route.ts:14-34` | Role-scope; strip `trackingToken` outside admin/principal. (Same as A‑10.) |
| HIGH | D‑2 | **Missing composite indexes** in `firestore.indexes.json` → `400 FAILED_PRECONDITION` on prod: (a) `[status ASC, createdAt DESC]` — Approvals (`useIssues({status})` for hod/principal/admin) ✓; (b) `[routing.maintenanceHeadUid ASC, status ASC, createdAt DESC]` — head without college + `?status=ROUTED`; (c) `[college ASC, location.name ASC]` — F2 duplicates (query fails inside a catch → duplicates silently never run) ✓. Cross-checked file: ✓ `firestore.indexes.json` (no such combos) | Add the three indexes. |
| MED | D‑3 | Board = newest 200 then JS filter → under volume P1‑3 older than the newest 200 docs (mostly P4/P5) disappear; `.slice(0,10)` may return <10. ✓ `issues/route.ts:171-185` | Composite `priority ≤ 3` + `orderBy createdAt desc`, or widen+page. |
| MED | D‑4 | Unbounded cron scans: auto-close grabs **all** VERIFIED, stale-critical grabs **all** NEW, then serial transitions. ✓ `autoClose.ts:20-33`, `staleCritical.ts:56-68` | `.limit(500)` + cursor pages, concurrency cap. |
| MED | D‑5 | Denormalized names go stale on rename — `routing.categoryName`, reporter names; analytics/history group by stale names. ✓ `issues/route.ts:59-68`, `analytics/summary/route.ts:58-59` | Backfill on rename; read-resolve display-critical surfaces. |
| MED | D‑6 | `pendingPurchaseCount` incremented raw on add-requirement instead of recomputed (drift possible; repaired on next approve). `requirements/route.ts:47-48` | Recompute like other paths. |
| LOW | D‑7 | Notification feed capped at 50 docs → unread undercount beyond 50. `notifications/route.ts:12-18` | Count with separate counters or page. |
| LOW | D‑8 | `notifyRole` scans the whole users collection per event + N+1 notification writes; "announce all" = 1 doc per active user serially. ✓ `notifications.ts:72-102`; `announcements.ts:30-68` | Subscriber docs / `WriteBatch` (≤500) / cap fan-out. |
| LOW | D‑9 | Mark-all-read = read all unread + `Promise.all` updates (no batch). `notifications/route.ts:35-42` | WriteBatch. |
| LOW | D‑10 | Unset-college accounts receive cross-college notifications/emails. `notifications.ts:94`; `email/recipients.ts:53` | Skip users with no college unless admin. |
| LOW | D‑11 | Queued offline writes replay blindly; a stale queued mutation that 4xxes is **dropped silently** ("will sync" toast lies). ✓ `clientApi.ts:189-197` | Surface dropped writes; conflict detection. |
| LOW | D‑12 | IndexedDB cache never evicts; `dropWriteForMatch` matches url+method+body (two identical queued writes can drop the wrong one). `offlineStore.ts:135-148`; `clientApi.ts:155-170` | TTL sweep; carry enqueue id. |
| LOW | D‑13 | `useIssue` pollTries never resets (AI card needs manual refresh forever after 8 polls/hidden tab). `useIssue.ts:61-72` | Reset when `aiProcessed`/status changes. |
| LOW | D‑14 | Hooks null out data on error → transient blip blanks rendered lists. `useIssues.ts:27-30`, `useIssue.ts:31-34` | Keep stale data on error. |
| LOW | D‑15 | Reports with priority 0 never reach the shared board (`priority >= 1` filter). `issues/route.ts:178-183` | Treat 0 as unset → include as P3 until triaged. |

---

## 06 — Notifications, email & scheduled jobs

### Pros
- Email genuinely best-effort (try/catch everywhere, never breaks flow); `EMAIL_TEST_RECIPIENT` single-inbox override. ✓ `email/client.ts:42-62`
- Cron endpoints bearer-guarded (`CRON_SECRET`); reminders have 6h/12h cooldowns. ✓
- Cloud Functions use raw Admin SDK (bypass rules intentionally); stale FCM tokens cleared. ✓ `functions/src/index.ts:47-52`
- Tracking emails prefer the public `/track/[token]` link. ✓ `email/templates.ts:123-188`

### Cons / risks
| Sevr | # | Finding | Fix |
|---|---|---|---|
| MED | E‑1 | SLA-reminder cron: sequential N+1 (`getTeamEmails` per issue, per-member reads); if it times out after send but before the `sla.emailReminderAt` write → duplicate mail. ✓ `email/index.ts:96-132`; `recipients.ts:66-91` | Batch reads, concurrency pool; persist timestamp **before** sending. |
| MED | E‑2 | `checkSlaBreaches` `limit(200)` with no `breachedFlags.resolution == false` filter → once >200 have ever breached, new breaches stop being flagged (already-flagged docs consume slots). ✓ `functions/src/index.ts:114-161` | Add the equality filter (new index) or cursor-page + skip. |
| MED | E‑3 | `pushTimeline` non-transactional (read counters → update → add; crash double-runs lose increments) and duplicates the machine's own counter. ✓ `functions/src/index.ts:84-106` | Single transaction. |
| MED | E‑4 | Weekly digest capped at 1000 issues; aggregates over stale `routing.categoryName`. `functions/src/index.ts:222-236` | Page + group by canonical category id. |
| LOW | E‑5 | No cross-instance idempotency on Vercel crons (auto-close is idempotent by machine; escalate-stale guarded only by `escalation.required`; SLA mail by 12h cooldown). | Acceptable; document. |
| LOW | E‑6 | `SlaState` type omits `emailReminderAt`/`lastReminderAt` the jobs write. `types.ts:127-138` | Extend the type. |
| LOW | E‑7 | Day-boundary mismatch: daily stats keyed by UTC day while product runs IST; analytics trend buckets use server-local midnight (UTC on Vercel). ✓ `stats.ts:6-8`, `analytics/summary/route.ts:91-94` | Compute day keys in Asia/Kolkata consistently. |
| LOW | E‑8 | `avgResolutionHours` includes PENDING pause time; SLA-compliance % from a 500-doc sample. `analytics/summary/route.ts:66-87` | Subtract `totalPausedMs`; sample properly. |

---

## 07 — Frontend / UI / UX

### Pros
- Consistent warm terracotta design system (tokens in `globals.css`), pill buttons, radius scale, Fraunces + Inter. ✓
- Careful overflow hardening shipped recently: `overflow-x-clip` shell, `min-w-0` patterns across job boards/cards, pinned board grid column. ✓
- Focus-trapped modal (`useFocusTrap` complete: first-focus, wrap, restore). ✓ `useFocusTrap.ts:13-55`
- Onboarding now reporter-only; staff get a dismissible banner (recently fixed). ✓ `ProfileOnboarding.tsx`, `StaffDataNotice.tsx`
- `/new` wizard compresses images client-side (~1200px q0.7) before upload. ✓
- Receipt PDF (pdfmake) with SLA + requirements + timeline. ✓ `receiptPdf.ts`
- Eager prefetch of per-role queue feeds. ✓ `AppShell.tsx ROLE_FEEDS`

### Cons / risks
| Sevr | # | Finding | Fix |
|---|---|---|---|
| HIGH | U‑1 | Read-scope drives UI too — dashboard/board rely on role-scoped queues, so the D‑1/A‑10 detail leak also shows `trackingToken`-aware links to any logged-in user. | Server-scoped detail (see A‑10/D‑1) is the fix; UI then can't over-render. |
| MED | U‑2 | `IssueBoard` (home + `/board`) uses fixed card heights (`h-[600px]`, JS-computed row height). Fixed-height lists clip on very small screens; board limit logic returns <10 under width limits. ✓ `IssueBoard.tsx` | Auto-height or safe-area min; show count + "load more". |
| MED | U‑3 | Events easter-egg components (`src/components/events/*`: onam, holi, christmas…) ship in the production bundle/pages with no auth; also the source of the 2 lingering lint warnings (unused import, raw `<img>`). ✓ `onam.tsx:4,182`; `tech-fest.tsx:69` | Gate behind a route/flag or move out of default build; fix lint. |
| LOW | U‑4 | `useIssues` cache-listener only reacts to `/api/issues*` prefix events — detail-path revalidations don't refresh list counters until TTL. `useIssues.ts:39-43` | Also listen to `/api/issues/[id]` → same-collection invalidate. |
| LOW | U‑5 | No test/E2E suite beyond CLI smoke scripts; no visual regression checks for the many responsive fixes. | Add Playwright smoke; screenshot diffs for the queues. |
| LOW | U‑6 | Analytics memoization is per-instance (`Map` cache) — cold instances re-run ~3k reads; `stats/{YYYY-MM-DD}` docs written on create are never read; `bumpDailyStat` is dead code. ✓ `analytics/summary/route.ts:34-38` | Use `stats/*` docs / `serverCache`; delete or wire `bumpDailyStat`. |

---

## 08 — Admin panel

### Pros
- Role/college/department/category provisioning with server-side validation; head wiring (`headUid`) on provision. ✓
- User delete cleanup (doc + notification feed; self-delete blocked). ✓ `admin/users/route.ts:64-89`
- Team/category/config management all `requireAdmin`. ✓

### Cons / risks
| Sevr | # | Finding | Fix |
|---|---|---|---|
| MED | AD‑1 | Admin UI exposes `config.ai.*` toggles (enable/models/threshold) that the server never reads — misleads admins. ✓ `admin/page.tsx:769-770,793,866` | Wire them (AI‑4) or remove. |
| MED | AD‑2 | Admin can create a user with **no college** (college select defaults but isn't required) — staff without college get cross-college notifications and unscoped edge behavior (R‑1/E‑7/D‑10). ✓ (form) | Require college for scoped roles; block save otherwise. |
| LOW | AD‑3 | Team/category **rename** has no backfill → historical issues + analytics keep the old name (D‑5). | Backfill script on rename. |
| LOW | AD‑4 | Delete-guard for categories/teams: switching an issue's team/category after deletion leaves dangling `routing.teamId`. | Check linked issues or keep tombstone. |

---

## 09 — Build, tests & docs

### Pros
- `npx tsc --noEmit` clean; `eslint` 0 errors (2 pre-existing warnings in `onam.tsx`); `next build` succeeds (Turbopack). ✓ re-verified 2026-09-12
- Smoke scripts drive the full lifecycle over the live API (`scripts/smoke-lifecycle.mjs`). ✓
- `jose` pinned via overrides; `server-only` guards secret-adjacent libs. ✓

### Cons / risks
| Sevr | # | Finding | Fix |
|---|---|---|---|
| MED | B‑1 | `CONTEXT.md` / `docs/app_status.md` describe the old 8-state, 7-role machine; the code is 14-state with `ROUTED/PENDING_ASSIGN/INSPECTED` and `maintenance_head`/`category_head`. Anyone (agent or human) following the docs will build against the wrong state table. ✓ | Rewrite the status lifecycle + roles sections. |
| LOW | B‑2 | No unit tests for `issueMachine` transitions (the app's most critical logic). | Vitest suite for `TRANSITION_RULES`. |
| LOW | B‑3 | No lint rule preventing the two recurring warning classes (unused vars, `<img>`). | Enable `@typescript-eslint/no-unused-vars` as error; switch `<img>` to next/image. |
| LOW | B‑4 | `.env.example` carries real config; no CI running tsc/eslint/build on PRs. | Placeholder example; add a CI job. |

---

## Fix list — prioritized todo

### P0 — close the critical hole (do before anything else)
- [ ] **A‑1** Lock down `/api/auth/provision`: `requireAdmin` for role-bearing POST/PATCH; add authenticated `/api/auth/self-provision` that only creates `reporter` on the caller's own uid. Add a rollout step: verify no account can change its own role via any endpoint.

### P1 — authorization & defense-in-depth (HIGH)
- [ ] **W‑1/A‑4** Add college/department/category scoping predicates inside `applyTransition` + `firestore.rules` (mirror lists and transitions).
- [ ] **W‑2** `VERIFIED→CLOSED` requires `issue.reporter.uid === actor.uid`.
- [ ] **W‑3** Assigned-staff check on `→ PENDING` (mirror ONGOING/COMPLETED).
- [ ] **A‑10/D‑1** Role-scope `GET /api/issues/[id]`; strip `trackingToken` outside admin/principal.
- [ ] **A‑5** Harden `firestore.rules`: notification create `uid == uid`; issue create reporter-ownership; scope users/issues reads; update field allowlists.
- [ ] **A‑6** Apply `isRateLimited` (uid+IP) to all mutation routes (issues, comments, requirements, AI POSTs — AI‑2).
- [ ] **A‑7** Add security headers/CSP in `next.config.ts`.
- [ ] **A‑2** `verifyIdToken(token, true)` + revocation handling; **A‑3** cross-check `users/{uid}` `isActive` in `requireAuth`.
- [ ] **R‑1** Add hod/principal branches to `GET /api/issues`; **R‑2** `slice(0,10)` safety on maintenance teamIds.

### P2 — correctness & scale (MED)
- [ ] **D‑2** Add the three missing indexes (`status+createdAt`, `maintenanceHeadUid+status+createdAt`, `college+location.name`).
- [ ] **AI‑1** Transactional `aiProcessed` guard.
- [ ] **AI‑3** `maxOutputTokens` on all calls; clamp `description`; truncate root-cause/predictive/punch-list inputs.
- [ ] **W‑9** CLOSED guard on requirement approve/reject/senior routes.
- [ ] **W‑15** `allocateIssueNo` → `tx.update`/increment (don't clobber the counter doc).
- [ ] **W‑14** Fix timeline-count consistency; audit row for board-hides.
- [ ] **W‑6/W‑7** SLA: don't extend response deadline on pause; pause P1‑2 clock through routing states.
- [ ] **W‑5** Staff/team membership validation on assign + ONGOING consistency.
- [ ] **D‑4** Bound cron scans (auto-close, stale-critical) with limit+cursor.
- [ ] **E‑2/E‑3** SLA-scan starvation filter; transactional `pushTimeline`.
- [ ] **AI‑4** Wire `config.ai.*` to the gate/flows or remove the admin controls.
- [ ] **W‑12** Fix or delete `allowedTransitions`.

### P3 — hygiene & debt (LOW)
- [ ] **D‑3** Board: real `priority ≤ 3` + `createdAt desc` query.
- [ ] **E‑1** Batch SLA-reminder reads; persist cooldown before sending.
- [ ] **W‑11/W‑10** Comment 404; transactional like toggle.
- [ ] **AI‑8** Split `duplicatesProcessed` flag; backfill duplicates.
- [ ] **AI‑9** Duplicates: status-query first, drop dead guard, wire threshold.
- [ ] **AI‑10** `defaultTeamId` isActive check; fix/relabel `done` scoring; chunk member queries.
- [ ] **AI‑12** Transactional `applyTriagePriority` with `status==NEW` precondition.
- [ ] **AI‑13** Draft-requirements review modal before "Add all".
- [ ] **W‑18** `INSPECTED` repair rule / remove from step order.
- [ ] **B‑1** Rewrite `CONTEXT.md`/`docs/app_status.md` state machine + roles to the current 14-state model.
- [ ] **A‑15/B‑4** Placeholder-only `.env.example`; CI job (tsc/eslint/build).
- [ ] **B‑2** Unit tests for `TRANSITION_RULES`.
- [ ] **D‑11** Surface dropped offline writes; conflict-friendly replay.
- [ ] **E‑7/W-notes** Timezone-consistent day keys in stats/analytics.
- [ ] **AD‑2** Require college in admin user form for scoped roles.

---

## Verified claims
Re-verified against source during this audit (not merely read-level): A‑1, A‑2, A‑3, A‑4, A‑5, A‑6, A‑7, A‑10, R‑1, R‑2, R‑3, W‑1, W‑2, W‑3, W‑4, W‑12, W‑13, W‑14, W‑15, W‑18, AI‑1, AI‑2, AI‑3, AI‑4, AI‑9, D‑1, D‑2, D‑3, E‑1, U‑3, B‑1. Everything else is a read-level finding to confirm while fixing.
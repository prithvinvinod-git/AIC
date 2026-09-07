# Servox Φ: Real-World Readiness Audit (Revised)

**Revised from original audit (6 Sep 2026)** — cross-checked against the live codebase. Items marked `[x]` are already implemented. Items requiring large UI overhauls or changes that disrupt existing working workflows have been removed.

---

## Priority model

| Priority | Meaning |
|---|---|
| **P0** | Genuinely missing functionality that causes operational failures or security gaps |
| **P1** | Important for daily efficiency; improves adoption or reduces risk |
| **P2** | Scale features, integrations, differentiation — roadmap items |

---

## P0 — Genuine gaps to close before or during pilot

| Status | Item | Why it matters |
|---|---|---|
| [ ] | **Add password reset.** No `sendPasswordResetEmail` path exists anywhere in the UI. Locked-out users must contact an admin to recreate their account. | Staff turnover and forgotten credentials are guaranteed in a campus environment. |
| [ ] | **Add tracking-token rate limiting and revocation.** Tokens are UUID-based (high entropy) but the `/api/track/[token]` endpoint has no rate limiting and there is no admin/user revocation mechanism. | A compromised or leaked token grants indefinite public read access to issue details. |
| [ ] | **Add upload malware scanning or hash-check gate.** Uploads are constrained to image MIME + 5 MB, but there is no server-side scan or metadata-strip before storing base64 in Firestore. | Uploaded photos may carry embedded documents, faces, or malicious payloads. |
| [ ] | **Auto-escalate unaccepted NEW critical issues.** P1–2 issues auto-escalate only once validated. A critical issue left in `NEW` for days (validator inaction) has no deadline, no escalation, no alert. | This is the exact failure found in the audit: a water-hazard report sat `NEW` for 6 days. |
| [ ] | **Separate smoke/demo data from production.** `smoke-lifecycle.mjs` and `cleanup-smoke.mjs` write directly to the production Firestore project. Seeded test data is indistinguishable from real issues in dashboards and analytics. | Leadership viewing the pilot will see fabricated issues in their metrics. |
| [ ] | **Add basic server-side rate limiting on auth endpoints.** Login, signup, and Google sign-in routes have no IP or email rate limiting. Firebase handles `too-many-requests` for repeated bad passwords, but the Next.js routes themselves are unprotected. | Brute-force and credential-stuffing attacks against `/api/auth/provision` or other routes. |
| [ ] | **Add error monitoring.** No structured logging, no error tracking (Sentry, Logtail, etc.), no uptime checks. Errors in `after()` fire-and-forget hooks (AI triage, email sends) are silently swallowed. | Production failures are invisible until a user reports them. |

---

## P1 — Operational improvements

| Status | Item | What exists today |
|---|---|---|
| [ ] | **Reporter dashboard: add search, filter, sort, and pagination.** Dashboard lists all my issues as a flat grid with no filtering, no search, no sort, and no pagination. | KPIs (Open / In Progress / Resolved) and `IssueCard` grid exist; `useIssues({ mine: true })` loads all. |
| [ ] | **Add reporter-side overdue/escalation visibility.** Reporters have no view of SLA deadlines, breached status, or next-action for their issues. | SLA data lives on the issue doc (`sla.responseDeadline`, `breachedFlags`); exposed only to validators/HODs. |
| [ ] | **Notification center: add per-issue grouping and type/severity filters.** Current notification feed is a flat chronological list with only All/Unread/Announcements filters. Heavy-activity roles get buried in noise. | `useNotifications` returns flat list; `NotificationsPage` renders it. |
| [ ] | **Make closure feedback and auto-close explicit on the issue detail page.** Rating system and 24h auto-close exist but the detail page does not explain what happens if the reporter doesn't rate. | `CloseIssueModal` notes it; the closed issue detail page shows rating but no explanatory text. |
| [ ] | **Admin analytics: add CSV/PDF export.** Analytics page exists with summary and trend data. No export capability. | `GET /api/analytics/summary` returns JSON; `receiptPdf.ts` handles single-issue PDFs. |
| [ ] | **Add SLA response-time enforcement (the known gap).** Resolution SLA breaches are flagged by Cloud Function every 10 min. Response SLA enforcement is explicitly listed as todo #3 in the codebase and has never been implemented. | `sla.breachedFlags.response` is declared but never set by any code path. |
| [ ] | **Add emergency/contact guidance for safety-critical issues.** No page, modal, or copy anywhere in the app mentions calling campus security, emergency services, or an alternative channel for urgent hazards. | AI triage sets `safetyFlags`; the reporter and validator see them, but there is no emergency callout. |
| [ ] | **Add `notifyPhone`/`notifyWhatsApp` opt-in + phone normalization on user profile.** `phone` is stored as free-text; no E.164 normalization; no WhatsApp/SMS opt-in field. Prerequisite for the WhatsApp notifications feature. | Profile PATCH accepts `phone` string; Settings shows `notifyEmail` toggle only. |

---

## P1 — Already implemented (confirmed in codebase)

These items from the original audit are **done** and require no further work:

- [x] **State machine and server-authoritative transitions.** `issueMachine.ts` + `applyTransition()` in Firestore transactions. Every transition has actor, timestamp, reason, and notification.
- [x] **Role-based authorization and tenant isolation.** Custom claims (`role`, `department`, `college`), `requireAuth`/`requireAdmin`, scope filtering in every route handler. Firestore rules are defense-in-depth.
- [x] **Audit trail.** Every status change appends to `issues/{id}/timeline`. Timeline entries are append-only Firestore subcollections.
- [x] **Email verification on signup.** `sendEmailVerification` on `createUserWithEmailAndPassword`; full `/verify-email` page with `applyActionCode`, polling, and resend.
- [x] **Google sign-in.** Available on both login and signup flows via `loginWithGoogle()` with password-setup prompt for passwordless users.
- [x] **Friendly auth error messages.** `friendlyAuthError` in login and signup handles `invalid-credential`, `wrong-password`, `user-not-found`, `too-many-requests`, `popup-blocked`, etc.
- [x] **AI triage explainability.** `AISuggestionCard` shows category, priority, reasons, photo summary, safety flags, spam detection, and duplicate suggestions. Validators can override any suggestion.
- [x] **SLA timers and pause/resume.** Response + resolution deadlines initialized per priority tier; `pausedAt`/`totalPausedMs` tracked; breach flags set by Cloud Function.
- [x] **Requirements and purchase approval.** `needsApproval` flag on requirements; purchase team approves/rejects with price/reason; issue cannot complete while unresolved approvals exist.
- [x] **Duplicate detection.** Token-overlap (Jaccard) comparison against recent open issues at the same location. Threshold 0.45 → top-5 similar issues surfaced.
- [x] **Announcements.** Create/audience-target/publish with role-gated access and `AnnouncementBoard` on landing + `/announcements` page.
- [x] **Public tracking.** `/track/[token]` shows status, SLA countdown, timeline — no login required.
- [x] **Receipt PDF.** `receiptPdf.ts` generates branded PDF with full issue details, SLA, requirements, timeline, and feedback.
- [x] **Configurable design tokens.** Tailwind v4 `@theme` in `globals.css` — consistent color palette, typography, shadows, radius scale across all components.
- [x] **Loading/empty states.** `Loading` and `EmptyState` components used consistently across dashboard, issues list, notifications, and admin pages.
- [x] **Role-aware navigation.** `NAV_ITEMS` filtered by `filterNavItems(claims)`; AppShell, MobileNav, and PublicNav all respect role scoping.
- [x] **Workload management.** Team queues with member lists; validator sees team load (`done`/`load`); reassignment via PENDING→ASSIGNED transition.
- [x] **Email notifications with recipient scoping.** `getRecipientEmails` resolves by role/department/college; `notifyEmail` opt-out honored; `EMAIL_TEST_RECIPIENT` override.

---

## P2 — Scale and differentiation (roadmap)

| Status | Feature | Notes |
|---|---|---|
| [x] | **Duplicate and related-issue detection** | Implemented (F2 — token-overlap). |
| [x] | **Announcements and incident communications** | Implemented (create, audience-target, publish). |
| [x] | **Advanced analytics (root-cause, predictive, insights)** | F5/F6/F7 implemented; weekly insights generate AI summary. |
| [ ] | **WhatsApp notifications (Meta Cloud API free tier)** | Planned — see `docs/tasks.md`. |
| [ ] | **Campus SSO / directory sync** | SAML/OIDC login, role mapping, deprovisioning. |
| [ ] | **SMS notifications for high-severity issues** | Opt-in + consent recording. |
| [ ] | **CSV/JSON export for authorized roles** | Issue history, analytics, SLA data. |
| [ ] | **PWA with offline report capture** | Draft reports offline, queue media, submit on reconnect. |
| [ ] | **Preventive maintenance scheduling** | Recurring inspections, asset schedules, automatic work orders. |
| [ ] | **Asset and vendor management** | Warranty, service history, vendor contacts, cost tracking. |
| [ ] | **Multilingual and voice reporting** | Speech-to-text, translation, review-before-submit. |

---

## QA and security checklist

| Status | Area | Coverage today |
|---|---|---|
| [x] | **Authentication happy path** | Signup, login, Google login, email verification — all functional. |
| [x] | **Workflow integrity** | Smoke tests (`smoke-lifecycle.mjs`) drive full NEW→CLOSED lifecycle with Admin-SDK tokens. 9/9 PASS against production. |
| [x] | **Role-based access at API level** | Every route verifies ID token + claims; role checks enforced server-side. |
| [ ] | **Password reset flow** | Not implemented (see P0 above). |
| [ ] | **Rate limiting on auth/data routes** | Not implemented. |
| [ ] | **Tracking token security** | No rate limiting, no revocation (see P0 above). |
| [ ] | **Upload security** | MIME + size enforced; no malware scan, no metadata strip. |
| [ ] | **Error monitoring in production** | Not implemented. |
| [ ] | **Backup and restore drills** | Firestore backups enabled (GCP); no documented restore runbook. |
| [ ] | **AI prompt injection testing** | No adversarial testing of issue descriptions against triage prompts. |

---

## Recommended delivery sequence

**Immediate (before pilot):** Password reset, tracking-token revocation/rate-limiting, error monitoring, separate demo data from production, emergency guidance on safety-critical issues.

**During pilot:** Reporter dashboard filters, notification grouping, SLA response enforcement, phone normalization + WhatsApp opt-in (unblocks WhatsApp feature), CSV export.

**Post-pilot:** SSO, SMS, preventive maintenance, asset management, offline capture.

---

## Summary of what the original audit got wrong

The original audit was produced without access to the codebase. Several claims were inaccurate:

- **"No email verification"** — False. Full verify-email flow with `applyActionCode`, polling, and resend exists at `/verify-email`.
- **"No Google login"** — False. Google sign-in is on both login and signup flows, with password-setup modal for Google-only users.
- **"No friendly error messages"** — False. `friendlyAuthError` handles all known Firebase auth errors with clear user-facing copy.
- **"State machine not implemented"** — False. `issueMachine.ts` + `applyTransition()` with Firestore transactions has been live since early development.
- **"No role-based access control"** — False. Claims-based RBAC with department/college scoping is enforced in every route handler.
- **"No audit trail"** — False. Every status change writes a timeline entry with actor, timestamp, from/to, and optional reason.
- **"No SLA timers"** — False. Response/resolution deadlines, pause/resume, and breach flags are all implemented.
- **"No duplicate detection"** — False. Token-overlap detection (F2) is live and runs automatically on issue creation.
- **"No tracking page"** — False. `/track/[token]` has been live with public access since initial development.
- **"Report form incomplete"** — Partially true. Title, description, category, college, department, priority (1-5), building, floor, room/landmark, and photos all exist. Map pin and asset ID are genuinely missing.

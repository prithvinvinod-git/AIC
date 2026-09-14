# servox-phi — Feature Backlog

Working list of the 10 tasks agreed in session. Status updated as each task completes; after each completion we review for enhancements before moving on.

- [x] **1. Public tracking link for email recipients** — `trackingToken` per issue; email CTAs point to a public `/track/[token]` page (status rail, SLA countdown, timeline) so non-logged-in recipients aren't stuck at the login wall. Pattern mirrors the unguessable `/api/images/[id]`. *(Done — `src/app/api/track/[token]/route.ts` + `src/app/track/[token]/page.tsx`, reported/approved email CTAs now use it, `scripts/backfill-tracking-tokens.mjs` ran, verified live.)*
- [x] **2. Wire the auto-close job** — scheduled scan (Vercel cron like `/api/cron/sla-reminders`) turning `VERIFIED` past `feedbackGraceHours` → `CLOSED (isAuto)`. *(Done — `src/lib/autoClose.ts` + `src/app/api/cron/auto-close/route.ts` + `vercel.json` daily 10:00 UTC cron, bearer-guarded; runs `applyTransition(..., { to: "CLOSED", isAuto: true })`, notifies the reporter; e2e-verified against production.)*
- [ ] **3. Enforce the response SLA** — flag `sla.breachedFlags.response` and remind/email for `ASSIGNED` jobs past `responseDeadline` (breach function currently only flags resolution). *(Deferred — skipped for now by session decision; revisit later.)*
- [x] **4. Honor the `notifyEmail` toggle in email recipients** — `getRecipientEmails` currently ignores the `/settings` opt-out persisted on the user doc. *(Done — `src/lib/email/recipients.ts` now excludes `notifyEmail === false` users from role + team/staff emails; unset defaults to ON; settings toggle displays the default honestly; deployed.)*
- [ ] **5. Real weekly governance email** — reuse `weeklyInsights` AI flow + SMTP + dark template; send narrative + stats table to HOD/principal every Monday.
- [x] **6. Client-side image compression** — resize/compress photos in the browser (canvas ~1200px, q≈0.7) before upload to cut Firestore base64 blob cost (~10–20x). *(Done — `src/app/(app)/new/page.tsx` downscales to 1200px, re-encodes JPEG q0.7 with white fill for transparent PNGs; verified as the only client upload path.)*
- [ ] **7. "Where's my complaint?" status bot** — Genkit flow + endpoint answering status/SLA/next-step from Firestore.
- [ ] **8. CSV export** — server route streaming Issue History / analytics as CSV.
- [ ] **9. FCM push notifications** — biggest lift; service-worker + token management.
- [x] **10. Closed-issue receipt PDF** — reporter gets a "Download receipt (PDF)" button on `CLOSED` issues; professional receipt with all details in an orange Claude-style light theme. *(Done — `src/lib/receiptPdf.ts` + button on issue detail page, deployed to https://servox-phi.vercel.app.)*

---

## PWA Roadmap — Prioritized

### 🔴 Priority 1

- [ ] **P1. Real push notifications** — FCM push + service worker. Admin publishes announcement → Firebase → FCM → student notification. Types: new announcement, timetable change, new event, assignment/deadline reminder, important college notice, HOD announcement. Must work when PWA isn't open. Deep-link taps to the specific resource (`/announcements/[id]`, `/timetable`, etc.).
- [ ] **P2. Offline caching + IndexedDB** — Cache user profile, department/college info, timetable, viewed announcements, events, important notices, static UI assets. Flow: internet available → fetch latest → save to IndexedDB → internet disappears → show cached data + "Offline" indicator. Don't cache sensitive Firebase data blindly.

### 🔴 Priority 2

- [ ] **P3. Firebase security hardening** — Audit Firestore rules, Storage rules, Auth config, role claims, server-side authorization on every API route, rate limiting, env vars, no secrets in localStorage or committed to GitHub. Especially critical given privileged roles.
- [ ] **P4. Fast mobile UI** — Image optimization, lazy loading, dynamic imports, Server Components where possible, smaller JS bundles, skeleton loading, prefetching frequent pages. Goal: tap → immediate UI → data fills in.

### 🟠 Priority 3

- [ ] **P5. PWA update mechanism** — Detect new service worker version → prompt "Update now / Later" → safe reload. Prevents stale UI on users' phones after deploys.
- [ ] **P6. Deep-link notifications** — Notification taps navigate to the specific resource, not just home. e.g. `/announcements/[id]`, `/timetable`, `/events/[id]`.
- [ ] **P7. Install experience + shortcuts** — Proper manifest.json, maskable icon, splash screen, theme color, standalone display, app shortcuts (long-press: Announcements, Timetable, Events, Profile).

### 🟡 Priority 4

- [ ] **P8. Background data sync** — On app open: show cached data immediately → fetch latest → compare → update local cache → UI refreshes. Keeps the app fast on poor network.
- [ ] **P9. Offline UI** — Don't just show "Network Error". Show: "You're offline — showing your latest saved information. Last updated: 10:42 AM" with a "Back online — data updated" toast when reconnected.
- [ ] **P10. Mobile-native interactions** — Bottom navigation, swipe-friendly cards, pull-to-refresh, haptic feedback where supported, touch-friendly buttons, bottom sheets, proper safe-area padding, keyboard-aware layouts. Don't just narrow the desktop site.

---

## Cleanup & Fixes (from audit 2026-09-02)

- [x] **C1. Remove HEAD_APPROVED from state machine** — INSPECTED now auto-cascades to VERIFIED (category_head inspects → reporter can close directly). Removed maintenance_head approval + validator verification steps. *(Done.)*
- [x] **C2. Delete empty `head-approve` route directory** — `src/app/api/issues/[id]/head-approve/` was an empty dir after removing the HEAD_APPROVED status. *(Done.)*
- [x] **C3. Remove dead `/verify` route** — `POST /api/issues/[id]/verify` is unreachable now (no role can trigger COMPLETED → VERIFIED). Delete the route file and its `VerifyCard` in HeadCards.tsx. *(Done.)*
- [x] **C4. Remove unused `AssignCard` and `VerifyCard` from HeadCards.tsx** — Both are dead exports (never imported). Only `RouteToHeadCard` is used. *(Done.)*
- [x] **C5. Add validator to issue history nav** — Validator role is missing from `issue-history` nav item. Should be `["admin", "principal", "validator"]` so validators can search/filter all issues in their department scope. *(Done.)*
- [x] **C6. Fix maintenance_head direct-assign bug** — `ROUTED → ASSIGNED` transition is allowed for `maintenance_head`, letting them assign workers directly instead of forwarding to a category head via `PENDING_ASSIGN`. Remove that transition; maintenance_head should only forward, not assign. *(Done.)*
- [x] **C7. Update Firestore rules** — Rules are stale: missing `maintenance_head`, `category_head` roles and `ROUTED`, `PENDING_ASSIGN`, `INSPECTED`, `VERIFIED` statuses. Defense-in-depth is broken. *(Done.)*
- [x] **C8. Update smoke test** — `scripts/smoke-lifecycle.mjs` drives `COMPLETED → VERIFIED` (validator verify) which no longer exists. Must use the new flow: `COMPLETED → INSPECTED` (category_head) which auto-cascades to VERIFIED. *(Done.)*

---

## Doc Drift — B-1: CONTEXT.md / app_status.md → 14-state model

Context refresh (session 2026-09-14). The docs still describe the stale 8-state chain
(`VALIDATED → ASSIGNED`, validator verifies) and the removed `head` role. Ground truth:
`TRANSITION_RULES` (`src/lib/issueMachine.ts`) + `ROLES` (`src/lib/types.ts`).

- [x] **B-1a. Rewrite CONTEXT.md status lifecycle (§4)** — 14-state chain `NEW → VALIDATED → ESCALATED → APPROVED → ROUTED → PENDING_ASSIGN → ASSIGNED → ONGOING → COMPLETED → INSPECTED → VERIFIED → CLOSED` (+ PENDING rebound, REJECTED terminal); full transition matrix incl. ROUTED→PENDING_ASSIGN (maintenance_head forwards), PENDING_ASSIGN→ASSIGNED (category_head assigns team), COMPLETED→INSPECTED→auto-VERIFIED (W-18), INSPECTED→VERIFIED repair rule, PENDING→PENDING_ASSIGN; SLA clock starts at ASSIGNED (W-7). *(Done — CONTEXT.md §1/§3/§4/§5/§6/§7 rewritten.)*
- [ ] **B-1b. CONTEXT.md §7 scoping line** — add the two heads' issue-list scoping: `maintenance_head → routing.maintenanceHeadUid`, `category_head → routing.categoryId in (categories where headUid=me)` (`src/app/api/issues/route.ts:226-233`).
- [ ] **B-1c. CONTEXT.md §9 notification matrix** — recipients now: ROUTED → maintenance_head; PENDING_ASSIGN → category_head + maintenance_head; COMPLETED → category_head (on-site verification); PENDING → category_head + maintenance_head + validator; send-back → "Work revised" to reporter (`src/lib/notifications.ts` `notifyRecipientsForIssue`).
- [ ] **B-1d. CONTEXT.md §13 flip resolved items** — stale `head` refs are now clean (only `maintenance_head`/`category_head` remain); `config.ai.enabled` is now a real kill-switch (task 42), no longer display-only.
- [ ] **B-1e. Rewrite app_status.md to the 14-state/9-role model** — same treatment as CONTEXT.md; also fix stale §8 "dark ChatGPT email theme" claim (actual: warm terracotta `#d97757`, `src/lib/email/templates.ts:10-11`) and §15 demo accounts (`mainten@gmail.com` is plain maintenance, not "Maintenance Head-style").
- [ ] **B-1f. Verify batch** — `npx tsc --noEmit`, `npx eslint src` (2 pre-existing onam.tsx warnings), `next build` clean.
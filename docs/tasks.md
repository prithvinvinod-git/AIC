# tasks.md - UI & Settings Polish Pass

Working list of tasks from the session. Each is checked off as it completes; the final two tasks verify everything and log the results.

- [x] **1. Create this `tasks.md` and append the task list.**
- [x] **2. Issue detail page - back button border.** Give the back button on `/issues/[id]` a 1px light border (use `btn-secondary`, which reliably renders the silver border over the `.btn` transparent default).
- [x] **3. Issue detail page - move action buttons up.** Nudge the "Close issue" and "Download receipt (PDF)" buttons up by 40px (`-mt-10`).
- [x] **4. Issue detail page - timeline alignment.** Align the timeline connector line/dots to their relative list items (line starts at the dot's vertical centre).
- [x] **5. Navbar - hide the mobile hamburger on desktop.** Confirm/ensure the menu button only appears below the `md` breakpoint.
- [x] **6. Profile & Settings fully functional.** Both already persist via `PATCH /api/profile`; add clear "Role & department are managed by the admin" notes and surface the role on the profile page. Self-service fields stay editable; role/department/email stay read-only.
- [x] **7. Reduce navbar height a bit.** Slim the app header (`h-[54px] sm:h-[86px]` -> `h-[48px] sm:h-[70px]`).
- [x] **8. Replace the text logo with `/servoxlogo.png`** in the app header, auth header, landing header and tracking header.
- [x] **9. Verify for errors.** Run lint + typecheck + build across every touched feature and record results in `docs/verification-log.md`.
- [x] **10. Log anything that couldn't be done well** in `docs/limitations-log.md`.

---

# UX Audit — Confusion-Prone Areas (Session 2)

Findings from the UX audit of all role pages, issue components, the state machine and API routes. Each is fixed in priority order.

- [x] **11. Completion dead-end for approval-flagged requirements (bug).** `issueMachine.ts` ONGOING→COMPLETED only waives unresolved `needsApproval` items via `input.verdict`, but `/api/issues/[id]/complete` accepts only `note` and the UI only sends `note`. Staff cannot complete, despite the copy saying a waiver note works. Fix: accept the closure report note as the waiver (`!input.verdict && !input.note`).
- [x] **12. Blocked without a reason on the issue detail page.** `IssueActions` ASSIGNED branch posts a hardcoded `note: "Blocked"`; the jobs board requires a reason. Fix: inline blocker-reason input, matching the board.
- [x] **13. Completion report optional on the detail page.** `MaintenanceComplete` defaults to "Work completed." when empty. Fix: make the report required (≥5 chars), matching the board.
- [x] **14. Track-page stepper shows 8 steps.** VALIDATED/ESCALATED/APPROVED render even for P3–5 issues that never escalate; the active step can jump NEW→ASSIGNED; PENDING shows nothing active. Fix: build a per-issue step list (escalation steps only when the issue escalated) and map PENDING onto the ONGOING step.
- [x] **15. Landing page overpromises AI.** "AI instantly classifies category and priority" but the form makes the user pick manually and AI runs post-submit for the validator only. Fix: soften copy to match reality.
- [x] **16. Reporter's priority choice is silently overwritten.** The validator sets priority at validation with no explanation. Fix: show "Priority set by {name}" on the detail page when it differs from the reporter's own choice.
- [x] **17. Feedback grace / auto-close not explained.** Fix: note in the CloseIssueModal that unrated issues auto-close after the grace period.
- [x] **18. No SLA info before acceptance.** Fix: on the detail page, show "SLA timer starts once the issue is accepted" for pre-acceptance statuses.
- [x] **19. "Validate & auto-route" hides the escalation branch.** Fix: add a hint that P1–2 escalate to HOD/Principal while P3–5 auto-assign to a team.
- [x] **20. AssignCard auto-selects the first team and allows zero-staff assignment.** Fix: no auto-select; require ≥1 staff member to assign; warn on empty teams.
- [x] **21. "AI suggest" discards its reasoning.** Fix: surface the returned `reason` so users can see why a team/staff was suggested.
- [x] **22. HOD/Principal escalation has no reject path.** Fix: allow ESCALATED→REJECTED (with reason) for hod/principal/admin and add a reject control to EscalationCard.
- [x] **23. Jobs board has no "All" tab.** Fix: add an All tab showing total count.
- [x] **24. Silent-failure dropdowns.** `/api/categories` (new page) and `/api/teams` (AssignCard/Panel) errors are swallowed, leaving empty selects. Fix: inline error + retry.
- [x] **25. `/new` submit bar `-mt-[40px]` hack can overlap the form.** Fix: use normal spacing.

---

# WhatsApp Notifications — Meta Cloud API Free Tier

Zero-cost WhatsApp alerts for maintenance staff, purchase team, and HODs/validators who ignore email/app. Uses Meta WhatsApp Business Cloud API (1,000 free service conversations/month; Utility templates + within-24h-window replies stay free).

## Prerequisites (user setup, no code)

- [ ] **26. Create Meta Business Manager + WhatsApp Business Account.** Connect a phone number not already on WhatsApp. Create a System User with `whatsapp_business_messaging` + `whatsapp_business_management` permissions. Generate a permanent access token. Note `phone_number_id` and `business_account_id`.
- [ ] **27. Submit and approve Utility-category message templates.** Must be Utility (not Marketing) to stay inside the free service-conversation tier. Submit: `new_job_assigned` (issueNo, title, link), `issue_approved` (issueNo, title, link), `issue_reported` (issueNo, title, severity, link), `sla_reminder` (issueNo, title, deadline, link), `purchase_approval_required` (issueNo, title, link), `feedback_received` (issueNo, title, rating, link), `whatsapp_optin_confirm` (name). Copy the approved template names into env.
- [ ] **28. Configure webhook.** Point `https://servox-phi.vercel.app/api/whatsapp/webhook` at WABA API setup. Subscribe to `messages` with a verify token.

## Code implementation

- [ ] **29. Data + env.** `users/{uid}` adds `notifyWhatsApp` (false), `whatsappOptedInAt`, `phoneE164`, `phoneCountry` (default `+91`). `src/lib/phone.ts` normalizes to E.164. `.env.example` adds `WHATSAPP_ENABLED`, `WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_TEST_RECIPIENT`, template name constants.
- [ ] **30. `src/lib/wa/client.ts`** — Graph API template sender (`/{phone_number_id}/messages`, `type=template`). Best-effort, never throws into the flow (same contract as `src/lib/email/client.ts`).
- [ ] **31. `src/lib/wa/recipients.ts`** — `getWaRecipients(roles, dept, college)` + `getTeamWaNumbers(teamId, staffUids)`. Same scoping as `src/lib/email/recipients.ts` but filters `notifyWhatsApp && phoneE164 && optedIn`. Honors `WHATSAPP_TEST_RECIPIENT` override.
- [ ] **32. `src/lib/wa/send.ts`** — Per-event senders (`sendIssueReportedWa`, `sendIssueApprovedWa`, `sendJobAssignmentWa`, `sendSlaReminderWa`, `sendPurchaseApprovalWa`, `sendFeedbackWa`). Template registry mapping event to template name + param layout. SLA cooldown reuses the existing `sla.emailReminderAt` timestamp.
- [ ] **33. `src/lib/wa/webhook.ts`** — Incoming message responder. `START` (opt-in, record consent), `STOP` (opt-out), `STATUS <issueNo>`, `HELP`. Sender matched to `users/{uid}` via `phoneE164`. Replies are free-form inside the 24h customer-service window (counts as free service conversation).
- [ ] **34. `app/api/whatsapp/webhook/route.ts`** — GET = Meta verification handshake (hub.mode/verify_token/challenge). POST = signature check (`x-hub-signature-256`) + dispatch to responder.
- [ ] **35. `PATCH /api/profile` update.** Add `notifyWhatsApp`, normalize `phone` to `phoneE164`, set `whatsappOptedInAt`.
- [ ] **36. Settings page toggle.** "WhatsApp notifications" toggle (disabled until phone is saved). Profile page phone field already exists.
- [ ] **37. Admin user manager.** Add phone + WhatsApp opt-in fields when provisioning staff accounts.
- [ ] **38. Hook into issue lifecycle.** Extend `after()` in `src/lib/transition.ts`, `src/app/api/issues/route.ts`, purchase approve route, and cron SLA reminders to fire WA sends alongside email. WhatsApp never touches `status`.
- [ ] **39. Verify.** `npx tsc --noEmit`, `npx eslint src`. Smoke with `WHATSAPP_TEST_RECIPIENT`. Keep WA off in automated smokes until templates approved.

---

# Remaining Work — Real-World Readiness audit (P0 done, P1/P2 outstanding) + session leftovers

Appended after completing all 7 P0 items from `docs/Servox_Φ__Real-World_Readiness_Todo_List.md` (password reset, tracking-token rate limiting/revocation, upload gate, stale-critical auto-escalation, smoke/prod separation, auth rate limiting, error monitoring). Everything below is still open.

## Housekeeping
- [ ] **40. Merge `feature/offline-pwa-cache` into `main`.** The offline PWA work (IndexedDB cache, write queue, merged SW, server cache TTLs) and the rewritten project README live on that branch and are not yet on `main`.
- [ ] **41. Clean stale `head` role references.** `firestore.rules` and `functions/src/index.ts` still mention the removed `head` role (harmless, but confusing to new readers). Also clear any legacy `head` claims in demo accounts.
- [ ] **42. Make `config.ai.enabled` effectively gate AI.** The admin toggle is display-only; the real gate is the env-key check in `aiEnabled()`. Either wire the toggle in, or relabel it in the admin UI.

## P1 — During pilot (from audit "Recommended delivery sequence")
- [ ] **43. Reporter dashboard: search, filter, sort, pagination.** `useIssues({ mine: true })` loads a flat grid; add filtering (status/priority/date), search, sort, and paging.
- [ ] **44. Reporter-side overdue/escalation visibility.** Surface `sla.responseDeadline`, `sla.breachedFlags`, and "next action" on the reporter's own issue cards/detail (today it's only exposed to validators/HODs).
- [ ] **45. Notification center: per-issue grouping + type/severity filters.** Feed is flat (All/Unread/Announcements only); add per-issue threads and type filters so heavy-activity roles stay unburied.
- [ ] **46. Auto-close behaviour explained on the issue detail page.** `CloseIssueModal` already notes it (UX task 17); add the same explanatory copy to the closed-issue detail view ("unrated issues auto-close after the feedback grace period").
- [ ] **47. SLA response-time enforcement (deferred todo #3).** `sla.breachedFlags.response` is declared but never set. Extend the Cloud Function / cron scan (the 10-min resolution-breach scanner) to also flag unresolved `responseDeadline` breaches without changing the existing resolution logic.
- [ ] **48. Emergency/contact guidance for safety-critical issues.** When `aiSuggestion.safetyFlags` is set (or P1), show a callout on the issue detail + track pages with campus security / emergency contact guidance and an alternative reporting channel.
- [ ] **49. Analytics + issue-history export (CSV/PDF).** `receiptPdf.ts` covers single issues; add a range export for `/api/analytics/summary`, `stats/{YYYY-MM-DD}`, and `/api/issue-history` for admin/principal.

## P1/P2 — Phone & WhatsApp opt-in (folded in with the WhatsApp group)
- [ ] **50. Phone normalization + WhatsApp opt-in.** E.164 normalization + `notifyWhatsApp`/`whatsappOptedInAt` on profile (tasks 29, 35, 36). Prerequisite for items 26–39.

## QA & security (audit checklist gaps)
- [ ] **51. Backup/restore drill runbook.** GCP Firestore backups are enabled, but no documented restore runbook exists — write one and rehearse it.
- [ ] **52. AI prompt-injection testing.** Adversarial issue descriptions/requirements against the triage, requirements-extraction, and closure-draft prompts; verify nothing escapes into a state change or leaks data.

## P2 — Scale / differentiation roadmap
- [ ] **53. Campus SSO / directory sync.** SAML/OIDC login, role mapping, deprovisioning.
- [ ] **54. SMS notifications for high-severity issues.** Opt-in + consent recording.
- [ ] **55. Full offline report capture.** Cache + write-queue ship in the offline branch; extend it so a NEW issue (with images queued as blobs) can be drafted and submitted on reconnect.
- [ ] **56. Preventive maintenance scheduling.** Recurring inspections, asset schedules, automatic work orders.
- [ ] **57. Asset and vendor management.** Warranty, service history, vendor contacts, cost tracking.
- [ ] **58. Multilingual and voice reporting.** Speech-to-text, translation, review-before-submit.
- [ ] **59. Real weekly governance email (todo #5).** The weekly digest is in-app only (Cloud Function); ship the actual HTML email to admin/HOD/principal.
- [ ] **60. "Where's my complaint?" status bot (todo #7).** Natural-language status lookup.
- [ ] **61. FCM push delivery (todo #9).** SW + `fcm.ts` scaffold exists; verify device-token persistence, lifecycle, and opt-in end to end.
- [ ] **62. Reporter re-submit from REJECTED issues.** Edit + re-file a rejected issue instead of creating a fresh one.
- [ ] **63. QR-per-room/asset scanning.** Report from a scanned QR instead of a location picker.
- [ ] **64. Status chatbot (WhatsApp/voice).** Reuse the WhatsApp webhook (tasks 33–34) for a conversational status flow.

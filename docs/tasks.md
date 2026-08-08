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

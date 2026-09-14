# Next Session — Start Here

Compaction for the session after commit `c768939 "Hygiene batch"` (pushed to `origin/main`).

## Where we are
Picked up `/docs` hygiene batch: 41 (stale head refs — already clean, nothing to do), A-15 (`.env.example` placeholders), 42 (`config.ai.enabled` wired as real kill-switch), B-1 (doc drift → 14-state model). Committed + pushed. **Stop happened here intentionally — remaining B-1b..f deferred to this session.**

## Objective this session
Finish the doc-drift batch (all tracked as appended checklist `## Doc Drift — B-1` in `docs/todo.md`), verify, commit + push. Then optionally retry the Firebase upgrade + prod verify (real, from previous session).

## Important details
- Repo `D:\Downloads\cloneserver\AIC` (win32). Next.js 16.3 give Turbopack; prod `https://servox-phi.vercel.app`. Verify: `npx tsc --noEmit`, `npx eslint src` (2 pre-existing warnings in `src/components/events/onam.tsx`: unused `Sparkles`, `<img>`), `npm run build`.
- B-1 done already: CONTEXT.md §1/§3/§4/§5/§6/§7 rewritten to 9 roles (`reporter|validator|hod|principal|maintenance_head|category_head|maintenance|purchase|admin`) + 14 states (`NEW→VALIDATED→ESCALATED→APPROVED→ROUTED→PENDING_ASSIGN→ASSIGNED→ONGOING→(PENDING)→COMPLETED→INSPECTED→VERIFIED→CLOSED`, `REJECTED` terminal). SLA clock starts at ASSIGNED (W-7). COMPLETED→INSPECTED→auto-VERIFIED in one tx (W-18).
- Remaining (B-1b … f, in todo.md):
  - **B-1b** CONTEXT.md §7 scoping: add the two heads — `maintenance_head → routing.maintenanceHeadUid`, `category_head → routing.categoryId in (categories where headUid=me)` (`src/app/api/issues/route.ts:226-233`).
  - **B-1c** CONTEXT.md §9 notification matrix: ROUTED→maintenance_head; PENDING_ASSIGN→category_head+maintenance_head; COMPLETED→category_head on-site verification; PENDING→category_head+maintenance_head+validator; send-back→"Work revised" to reporter (`src/lib/notifications.ts` `notifyRecipientsForIssue`).
  - **B-1d** CONTEXT.md §13: flip resolved items — stale `head` refs clean; `config.ai.enabled` is now a real kill-switch (not display-only).
  - **B-1e** Rewrite `docs/app_status.md` to 14-state/9-role model; fix stale §8 "dark ChatGPT email theme" claim (actual: warm terracotta `#d97757`, `src/lib/email/templates.ts:10-11`); fix §15 (`mainten@gmail.com` is plain maintenance, not "Maintenance Head-style"). Also §16 had "automatically wire auto-close" already-shipped item + `VERIFIED` by validator — both stale.
  - **B-1f** Verify: tsc, eslint, next build.
- Firebase white-screen root cause: `firebase@12.17.1` / `@firebase/auth@1.13.4` IndexedDB "closing/hidden" bug; fixed in `firebase@12.19.0`. Two prior `npm install firebase@^12.19.0 --no-audit --no-fund` attempts aborted (300s/600s timeouts). **Retry only with user's go-ahead.**
- Machine `src/lib/issueMachine.ts`: authoritative `TRANSITION_RULES`; single door `applyTransition`. Role-scoped lists: reporter `/dashboard`, validator Board `/board`, hod+principal Approvals `/approvals`, heads Dispatch `/dispatch` (`HEAD_ROLES`), purchase `/purchase`, admin `/admin`, analytics see `ANALYTICS_ROLES`, issue-history `[admin,principal,validator]`, announcements `[admin,principal,hod]`. `ROLE_HOME` = `/` for all.
- Docs/tasks backlog NOT chosen (deferred): todo #3 response-SLA, #5 weekly email, #7 status bot, #8 CSV, #9 FCM; tasks 43-49+26-39+50+53-64+10+31; PWA P1-P10; correctness W-10, AI-10, E-7, AD-2, D-11, B-2.
- Last session also re-verified: task 41 done (no stale `'head'` role refs anywhere in `src/`, `firestore.rules`, `functions/src`; only `maintenance_head`/`category_head`).

## Next move
1. Edit CONTEXT.md: §7 scoping line, §9 matrix, §13 flips (B-1b/d/c).
2. Rewrite `docs/app_status.md` (B-1e) to the 14-state/9-role model.
3. Run `npx tsc --noEmit`, `npx eslint src`, `next build` (B-1f).
4. Mark B-1b..f `[x]` in `docs/todo.md`; commit + push.
5. Ask user re: Firebase `^12.19.0` upgrade retry + prod verify.
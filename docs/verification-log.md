# Verification Log

Result of the "verify for errors in every feature built" pass. Date: 2026-08-08.

## Scope

- UI polish: issue detail page (back button, action buttons, timeline), navbar (height, mobile menu, logo), profile & settings pages, landing/auth/track headers.
- Previous session features re-verified: weekly insights enrichment + `WeeklyInsightsCard` (HOD page).

## Checks run

| Check | Command | Result |
|---|---|---|
| ESLint (changed files) | `npx eslint <changed files>` | ✅ Pass (0 problems) |
| TypeScript | `npx tsc --noEmit` | ✅ Pass |
| Production build | `npm run build` (Next 16.3, Turbopack) | ✅ Compiled successfully, 40/40 static pages generated, TypeScript pass |
| Route registry | build output | ✅ All `api/*`, `issues/[id]`, `track/[token]`, `(app)/*` pages compiled |

## Repo-wide lint

`npm run lint` reports **4 pre-existing errors** in `functions/lib/index.js`
(`@typescript-eslint/no-require-imports`) — this is the **compiled output** of the
Firebase Functions build, not source. Unrelated to and untouched by this session's
changes; flagged here for awareness.

## Files touched this session (verified clean)

- `src/app/(app)/issues/[id]/page.tsx` — back button border, action buttons `-mt-10`, timeline line alignment
- `src/components/AppShell.tsx` — navbar height, logo image
- `src/app/(app)/profile/page.tsx` — role/college display + admin-managed note
- `src/app/(app)/settings/page.tsx` — admin-managed note
- `src/app/(auth)/layout.tsx`, `src/app/page.tsx`, `src/app/track/[token]/page.tsx` — logo image
- `src/lib/ai/insights.ts`, `src/components/ai/WeeklyInsightsCard.tsx`, `src/app/(app)/hod/page.tsx` — weekly insights (prior task, re-verified)
- `tasks.md` — task list

## Conclusions

No errors found in any feature built during this pass. The only repo-wide lint
failure is a pre-existing compiled-artifact issue in `functions/lib/index.js`.

---

# Session 2 — UX Audit (Confusion-Prone Areas)

Date: 2026-08-08.

## Scope

UX audit fixes for tasks 11–25 in `tasks.md`: completion waiver dead-end,
block/complete consistency, per-issue track stepper, landing copy, priority
explanation, auto-close grace note, SLA-before-acceptance note, escalation hint,
assign gating + AI reason, escalation reject path, jobs "All" tab, retry UI for
silent-failure dropdowns, and the `/new` negative-margin hack.

## Checks run

| Check | Command | Result |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | ✅ Pass (0 errors) |
| ESLint (source) | `npm run lint` | ✅ Source passes; same 4 pre-existing `functions/lib/index.js` artifact errors remain |
| Production build | `npm run build` (Next 16.3, Turbopack) | ✅ Compiled successfully, 40/40 static pages, TypeScript pass |

## Files touched this session (verified clean)

- `src/lib/issueMachine.ts` — completion waiver via report note; `ESCALATED → REJECTED` for hod/principal/admin
- `src/components/issues/IssueActions.tsx` — block reason form, required closure report, assign gating, AI reason, teams retry, escalation hint
- `src/components/issues/HeadCards.tsx` — assign gating, AI reason, teams retry
- `src/components/issues/EscalationCard.tsx` — reject-escalation control
- `src/components/issues/CloseIssueModal.tsx` — auto-close grace note
- `src/app/track/[token]/page.tsx` — per-issue stepper (escalation steps only when escalated; PENDING maps to ONGOING step)
- `src/app/(app)/issues/[id]/page.tsx` — "Priority set by …", SLA "starts once accepted"
- `src/app/(app)/new/page.tsx` — categories retry, removed `-mt-[40px]`
- `src/app/(app)/validate/page.tsx` — P1–2 escalation hint
- `src/app/(app)/jobs/page.tsx` — "All" tab
- `src/app/page.tsx` — landing copy aligns with actual AI behaviour
- `tasks.md` — task list

---

# Session 3 — Multi-college identity, onboarding, password change, network errors

Commit `8e26422`.

## Scope

- **Onboarding bypass fix.** `ProfileOnboarding.confirm()` never called
  `setDismissed` and used an unforced `refreshClaims()`, so the newly written
  `college` claim was never read back and the dialog re-appeared on every visit.
  `refreshClaims` is now typed `(force?: boolean)` and the confirm path forces a
  server round-trip before dismissing.
- **Mandatory reporter onboarding.** A reporter missing college **or** department
  can no longer dismiss (no Skip / X / Escape); Confirm stays disabled until both
  are picked; no silent `COLLEGES[0]` default; department list gated on college.
  `/new` gate and the inline renderer now use the same two-field rule.
- **College identity hardening.** `isValidCollege` / `isValidDepartment` added
  and applied in `/api/profile`, `/api/auth/self-provision` and `adminUserSchema`.
  Claims are now rewritten when college/department change (previously only on
  role/category edits, leaving the token's scoping stale). `POST /api/issues`
  takes `college` from the ID token, not the request body.
- **Admin.** College is mandatory — the "—" clear option was removed, and
  re-homing a department-scoped user sends college + department atomically.
- **Email verification.** Claims are force-refreshed after signup, Google
  sign-in and on `/verify-email` so the `requiresEmailVerification` claim lands
  immediately instead of surfacing as unexplained 403s. Google signups no longer
  get a silent "Computer Science" default department.
- **Password change.** New Settings → Security card (re-authenticate →
  `updatePassword` → PATCH `hasPassword`); Google-only accounts reuse
  `PasswordSetupModal`.
- **`Failed to fetch`.** `clientApi.request()` now converts a transport failure
  into a typed `NetworkError` instead of leaking a bare `TypeError`; mutations
  still queue as `QueuedOfflineError`. The unguarded `registerServiceWorker` /
  `requestFcmToken` chains in `ServiceWorkerRegistrar` were rejecting unhandled.

## Checks run

| Check | Command | Result |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | ✅ Pass (0 errors) |
| ESLint (source) | `npx eslint src` | ✅ Pass — only 2 pre-existing `onam.tsx` warnings (unused `Sparkles`, `<img>`) |
| Production build | `npm run build` (Next 16.3, Turbopack) | ✅ Compiled successfully |

## Not verified in this session

- Firebase `firebase@^12.19.0` upgrade — two installs timed out. Left pinned;
  no source change.
- No runtime/manual pass on a live account. The onboarding, verification and
  password flows above are covered by typecheck/lint/build only; the end-to-end
  `scripts/smoke-lifecycle.mjs` was not re-run for this batch.

## Files touched

- `src/components/auth/ProfileOnboarding.tsx` — mandatory two-field onboarding,
  forced claims refresh, local dismiss
- `src/components/auth/AuthProvider.tsx` — `refreshClaims(force?)` type
- `src/components/auth/provisionReporter.ts` — no synthetic department default
- `src/components/auth/PasswordChangeCard.tsx` — new (Settings → Security)
- `src/app/(app)/settings/page.tsx` — mounts the new card
- `src/app/(app)/new/page.tsx` — two-field gate, `inline` onboarding
- `src/app/(auth)/signup/page.tsx` — explicit college/department, forced refresh
- `src/app/(auth)/verify-email/page.tsx` — forced refresh on completion
- `src/app/api/profile/route.ts` — college + department-under-college validation
- `src/app/api/auth/self-provision/route.ts` — college/college-department validation
- `src/app/api/auth/provision/route.ts` — department validation, claim rewrite on college/department change
- `src/app/api/issues/route.ts` — college from ID token
- `src/app/(app)/admin/page.tsx` — mandatory college, atomic college+department re-home
- `src/lib/constants.ts` — `isValidCollege`, `isValidDepartment`
- `src/lib/schemas.ts` — admin college enum validation
- `src/lib/clientApi.ts` — `NetworkError`, exported `isNetworkError`
- `src/hooks/useIssues.ts` — surfaces the network message
- `src/components/ServiceWorkerRegistrar.tsx` — guarded async chains

---

# Session 4 — I-10 / I-11 close-out + runtime verification

Commits `a8206f7`, `0759f19`.

## Scope

- **I-11 — college required server-side on admin POST.** `adminUserSchema.college`
  is `.optional()` so PATCH can omit it on a role-only edit, which also meant
  POST accepted a missing college: the admin UI required one, the API did not.
  Added `adminUserCreateSchema` (POST variant) and switched the POST branch to
  it, then dropped the dead `body.college || ""` / `|| null` fallbacks.
- **I-11 follow-on bug found by the runtime check.** A *missing* college produced
  Zod's generic `Invalid input: expected string, received undefined`. The admin
  toast prints `details[].message` verbatim (`formatError` in
  `src/components/ui/Toast.tsx`), so the admin would have seen that instead of a
  useful message. Fixed with `z.string({ error: "College is required" })`.
- **I-10 — firebase 12.17.1 → 12.19.0.** The two earlier installs that appeared to
  time out were transient; this one completed in 1m.

## Checks run

| Check | Command | Result |
|---|---|---|
| Schema runtime behaviour | esbuild bundle of the real `src/lib/schemas.ts` + `constants.ts`, run in Node (no Firestore) | ✅ 15/15 pass |
| Firebase SDK loads | `require("firebase/app\|auth\|firestore")` | ✅ all resolve, `firebase@12.19.0` |
| Page routes | `GET / /login /signup /new /settings /verify-email` on the running dev server | ✅ all 200 |
| API auth doors | `POST /api/auth/provision`, `POST /api/auth/self-provision`, `POST /api/issues`, `GET /api/profile` with no token | ✅ all 401 — nothing written |
| TypeScript | `npx tsc --noEmit` | ✅ Pass (0 errors) |
| ESLint (source) | `npx eslint src` | ✅ 0 errors — only the 2 pre-existing `onam.tsx` warnings |
| Production build | `npm run build` (Next 16.3, Turbopack) | ✅ Compiled successfully |

The schema runtime check covered `isValidCollege` / `isValidDepartment`, POST
rejecting a missing / whitespace-only / unknown / wrong-case college, and PATCH
accepting an omitted college while never accepting a blank one.

## Not verified

- **In-browser pass** of the onboarding, password-change and offline-message UIs.
  These are client components; the build only prerenders the shell, and there is
  no browser automation in this repo. Needs a human.
- **`scripts/smoke-lifecycle.mjs`** was not run. It is deliberately gated behind
  `SMOKE_ALLOW_PROD=1` because `.env.local` points at the live
  `campus-maintenance-2820d` project and the run creates + auto-deletes real rows.
  Awaiting explicit sign-off.
- The `allow-scripts` postinstall warnings (esbuild, re2, protobufjs,
  `@firebase/util`) are pre-existing npm policy on this machine, not a
  consequence of the firebase bump; `re2` in particular never ran `node-gyp`.

## Files touched

- `src/lib/schemas.ts` — `adminUserCreateSchema`, friendlier missing-college error
- `src/app/api/auth/provision/route.ts` — POST uses the create schema
- `package.json`, `package-lock.json` — firebase `^12.19.0`
- `changes.md` — plain-language summary of the session



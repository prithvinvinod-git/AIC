# UI/UX Audit — Servox (Campus Maintenance Collaboration)

**Auditor:** senior UI/UX tester (external, blunt)
**Scope:** public marketing site + authenticated portal, desktop + mobile, all roles
**Method:** static review of the shipped code (`src/**`, `public/**`), trace of every user flow, bundle/cost analysis of API + Firestore access paths. Not a pixel-perfect device lab pass — several layout findings are flagged from class inspection and must be confirmed on a real device before release.
**Build:** verified against the current source tree.

---

## 1. Executive verdict

**Verdict: NOT SHIPPABLE in this state — and the problems aren't small.**

The styling is genuinely strong in places — the badge system, cards, tokens, and the public hero are above average. The token system in `src/app/globals.css` is coherent and disciplined; the badge and card components are consistent and legible. That is the entire list of wins, and it ends there.

Below the surface, the product reads like it was assembled by three different teams who never talked:

1. **The marketing site is designed, the portal is built.** A polished hero, a DotGrid animation, and a giant `servoxlogo.png` on one side; on the other side arbitrary pixel-hacked margins, stale empty-states pretending failures are successes, and a `router.replace()` that destroys the URL you were on.
2. **Errors are treated as "no data".** Every hook that fails to load data silently renders an empty state. On the principal portal, a failed network request looks identical to "nothing to approve". That is not a UX bug, it is a **trust bug** — a maintenance management system that lies to its users when the network hiccups.
3. **Nothing is fast, and every screen pays for features it doesn't use.** gsap is shipped to the public page for a mouse-follow dot grid; recharts is shipped to portal users who never see a chart; pdfmake is downloaded on every issue detail page so one user can press one button. ~3,000 Firestore reads per analytics load. Then the code polls silently for 28 seconds, polls forever with no timeout in the queue page, and caps the notification unread badge at 50.
4. **Animation runs on hardware that never asked for it.** A `requestAnimationFrame` loop draws hundreds of dots forever, on every pointer-capable page, with zero `prefers-reduced-motion` handling, zero pause on tab-hidden, and a global `mousemove` listener. On a modest laptop this is measurable jank and wasted battery on a page whose entire job is to convert a visitor.

The fixes below are mostly small. The discipline gap is not.

---

## 2. Severity legend

| Severity | Meaning |
| --- | --- |
| **CRITICAL** | Wrong or actively harmful to the user — data lies, flows destroy context, or the page becomes unusable. Fix before anything else. |
| **MAJOR** | Real friction or breakage that most users will hit; costs them time or trust every session. |
| **MINOR** | Polish, consistency, accessibility nits, or cost that compounds over time. |

**Effort:** S = under a day · M = a few days · L = a week+.

---

## 3. Findings

### 3.1 Design tokens & style consistency

**3.1.1 — Two font worlds, three counting systems — CRITICAL.**
`src/app/globals.css` registers four typefaces (`TTOctosquaresBlack`, `ValveBd`, `Inter`, `Poppins`) and defines a *custom* `--spacing-*` scale (4, 5, 6, 8, 10, 12, 16, 20, 24, 28, 32, 40, 48, 80) that silently **redefines Tailwind's spacing utilities** (`p-4` is no longer 1rem). Combined with hardcoded arbitrary values everywhere (`ml-[800px]`, `-mt-[200px]`, `left-[26px]`), spacing is effectively three parallel systems:
- the Tailwind scale the rest of the app assumes,
- the overridden custom scale,
- arbitrary magic numbers.

*Why it's wrong:* any developer changing `p-4` expecting the default 1rem breaks the layout elsewhere; reviewers can't tell which system a value belongs to. Spacing is no longer a design decision, it's archaeology.
*Fix:* keep one scale. Either drop the custom `--spacing-*` remap and use standard Tailwind spacing, or migrate all arbitrary values into the scale. Add an ESLint rule banning bare magic numbers in class strings.
*Effort:* M.

**3.1.2 — Brand + raw system reds and greens outnumber tokens — MINOR.**
Hex colors are hardcoded in at least 6 places: deadline over `text-[#c0392b]` / warn `text-[#d97706]` (`src/components/ui/IssueCard.tsx:46,49`), error/success surfaces (`src/app/(app)/settings/page.tsx:127-128`), and status colors via `PRIORITY_COLOR` in `src/lib/constants.ts`. A design system with tokens (`--color-*`) exists, but components bypass it.
*Why it's wrong:* the moment dark mode or a rebrand lands, these six copies drift. They already have (see 3.1.3).
*Fix:* promote the status/danger/success colors into `--color-*` tokens and reference them everywhere.
*Effort:* S.

**3.1.3 — "Pending" means two different things — MAJOR.**
`STATUS_LABEL.PENDING = "Pending"` (`src/lib/constants.ts`) but the jobs portal renders the same status as **"Blocked"** (`src/app/(app)/jobs/page.tsx:13`, tab label). A student's report is "Pending", a maintenance worker's same-status job is "Blocked". Same status, two words, opposite vibes.
*Why it's wrong:* users on the two sides of the same workflow are shown contradictory vocabulary; a "blocked" job with no explanation of who's blocked or why is a support ticket generator.
*Fix:* pick one label for one status, everywhere. If "Blocked" is intended to mean something different (awaiting a part, waiting on someone), it's a *different status* and needs its own value, not a renamed tab.
*Effort:* S.
*Status:* **FIXED** — jobs portal tab renamed `Blocked` → `Pending` (`src/app/(app)/jobs/page.tsx:13`), so both sides now say "Pending". The 3.10.1 reporter-facing blocker note is still open.

**3.1.4 — Buttons overflow their labels — MINOR.**
`.btn` classes have no `white-space: nowrap`/`overflow` policy and no min-width, so long labels (e.g. approve/route buttons, multi-word actions) can wrap to two lines or clip. Verify on a real phone; at minimum audit every `btn` with a long label.
*Fix:* audit long-button labels (see 3.10 for the offenders); add a consistent `whitespace-nowrap` and a sensible min-width to `.btn`.
*Effort:* S.

---

### 3.2 Layout hacks & responsiveness

**3.2.1 — The public nav is held together with magic negative margins — CRITICAL.**
`src/components/home/PublicNav.tsx`:
- `-ml-30` on the logo (line 8),
- `ml-[800px]` to push content right on desktop (line 14),
- `mr-[-100px]` to bleed past the container (line 26).

This is not responsive design, it's a specific screenshot recreated in CSS. Any viewport width other than the one the author's browser had will break — and it *will* break on every phone, tablet, and zoom level.
*Why it's wrong:* the nav is the first thing every visitor and every logged-out maintenance reporter sees. One breakpoint of off-by-one and the logo overlaps the links or the CTA wraps onto a second row.
*Fix:* delete the magic margins; lay the nav out with `flex` + `justify-between` + real `gap`s and a proper `md:`/`lg:` breakpoint stack.
*Effort:* S.

**3.2.2 — Hero content pulled over the grid with `-mt-[200px]` — MAJOR.**
`src/components/home/PublicHero.tsx:21` overlaps the section above by 200px. It renders correctly in exactly one viewport height. Taller/older devices, text reflow, or font-size boost (many users run one) shift the anchor and the overlap collapses or collides with the nav.
*Fix:* compose the hero with normal flow (grid/flex alignment), not negative margins; if the overlap is deliberate, do it with a positioned overlay that survives content growth.
*Effort:* S.

**3.2.3 — The "trusted by colleges" row uses raw `<img>` logos at fixed sizes — MINOR.**
`src/components/home/PublicHero.tsx` (and `SiteFooter.tsx:34`) load `<img src="/servoxlogo.png">` — 12 raw `<img>` tags across the app, zero `next/image`. Fixed sizes + no responsive density means blurry on HiDPI and layout shift on load.
*Fix:* migrate to `next/image` (or at minimum `srcSet` + explicit `width/height` + `loading="lazy"` for below-fold images).
*Effort:* S–M.

**3.2.4 — Lightbox and drawer overflow risk — MINOR.**
`src/components/ui/IssuePhotos.tsx` and `CloseIssueModal.tsx` lock `body` scroll but position content with assumptions that can overflow short viewports (landscape phones). Confirmed the scroll-lock pattern; the overflow needs a device pass.
*Fix:* give modals/lightbox `max-h-screen` + `overflow-auto` internally; test in landscape.
*Effort:* S.

---

### 3.3 Navigation & wayfinding

**3.3.1 — Login destroys the destination — CRITICAL.**
`src/app/(auth)/login/page.tsx` calls `router.replace(homeFor(session))`. The footer's "Track an issue" link (`src/components/home/SiteFooter.tsx:6`) and every portal link route a logged-out user to `/login`; after login the app dumps them on the role home page instead of returning them to the page they were trying to reach. A reporter clicking "Track my issue" is never taken to their tracking page.
*Why it's wrong:* broken continuation is one of the highest-friction UX failures there is. The user told you where they want to go; you discarded it.
*Fix:* capture the intended destination (`?next=/track/...` or via `router.push` + history) and navigate there after auth. Same for signup.
*Effort:* S.
*Status:* **FIXED** — `AppShell` redirects to `/login?next=<pathname>`; `login/page.tsx` reads `next` (open-redirect-guarded, rejects `//…`) and lands there instead of `homeFor(session)`.

**3.3.2 — Footer links that take you behind a login wall with no promise — MAJOR.**
`SiteFooter.tsx` exposes portal links (`Dashboard`, `Analytics`, …) and "Track an issue" to anonymous visitors, all of which 302 to `/login`. Visitors don't know these are member-only; the "Track" promise is especially misleading since tracking is a first-party anonymous flow (see 3.10.4).
*Fix:* either split footer links into "Explore" vs "Sign in" with clear member labels, or make tracking work without login as the copy implies.
*Effort:* S.

**3.3.3 — Unread badge is silently wrong past 50 — MAJOR.**
`src/hooks/useNotifications.ts` subscribes with `limit(50)` (lines 35–39) and computes `unreadCount` from the capped set (line ~49). A user with 60 unread sees "49+"? No — they see whatever the capped count is, with no "+50" indicator. The number actively lies.
*Why it's wrong:* the badge is the single most-trusted UI element on a dashboard. It being wrong trains users to ignore it.
*Fix:* keep a lightweight unread-count listener (`where("read", "==", false)` + `count()` query or a `/api/notifications/unread` endpoint) instead of computing from a capped feed.
*Effort:* S.

**3.3.4 — Back button is reinvented as a chip — MINOR.**
`src/app/(app)/settings/page.tsx:77` uses a "Back" button with `router.back()`; several other pages do the same. Back-stack navigation with `router.back()` breaks if the user deep-links (nothing to go back to → dead button).
*Fix:* use explicit links where the destination is known (`/settings`, `/dashboard`), keep `router.back()` only as a secondary affordance with a fallback.
*Effort:* S.

---

### 3.4 Loading, empty & error states

**3.4.1 — Errors render as "nothing to show" — CRITICAL.**
`src/hooks/useIssues.ts` on fetch failure calls `setIssues([])` (line 23) — the same list it uses for a legitimately-empty queue. Consequences:
- `src/app/(app)/principal/page.tsx` shows "Approval queue is clear" when the network just failed.
- `src/app/(app)/hod/page.tsx` shows "No escalations pending".
- `src/app/(app)/validate/page.tsx` shows an empty validation queue.

A maintenance management tool whose failure states are indistinguishable from "you're all caught up" is dangerous. A validator who sees "queue is clear" when the queue actually failed will go home. This is the single worst bug in the app.
*Fix:* keep error separate from data. `useIssues` must expose `{ issues, loading, error }` with error only as error; every consumer renders an error card + Retry. Remove the `setIssues([])` line.
*Effort:* S.
*Status:* **FIXED** — added `BoardErrorState` (message + Retry) in `src/components/ui/States.tsx`; wired into `hod`, `principal` (both lists), `validate` (all queue sections hidden on error), and `jobs`. `useIssues` already returns `error`; consumers now render it instead of empty states.

**3.4.2 — `useIssue` polls silently for ~28s with no progress — MAJOR.**
`src/hooks/useIssue.ts` polls AI triage up to 8 times × 3500ms (≈28 s) and, on the issue detail page, shows nothing but a spinner (or nothing) for half a minute. There's no indication that AI is thinking, no elapsed time, no cancel.
*Fix:* surface "AI is analysing this issue" with elapsed time and a cancel/retry; cap at a sane timeout and always show a fallback "review manually" path.
*Effort:* S.

**3.4.3 — The queue page only refreshes on a manual button — MINOR.**
`src/app/(app)/jobs/page.tsx` fetches once via `useIssues({})` and refreshes only when the user clicks "Refresh board". There is **no** polling loop (verified — no `setInterval`/`useEffect` loop anywhere in the file). The gap is that a board the user leaves open never catches up by itself.
*Fix:* refresh on window focus (and keep the manual button as the fallback); optionally pause that refresh when the tab is hidden.
*Effort:* S.

**3.4.4 — The board uses `window.location.reload()` as a refresh strategy — MAJOR.**
`src/components/issues/AISuggestionCard.tsx:18` performs `window.location.reload()` after triage. A full page reload to reflect a state change: flashes a spinner, resets scroll, kills the token refresh context, and is the exact pattern that makes an app feel like 2010.
*Fix:* refetch the single resource (`useIssues` refetch / `router.refresh()` for RSC data), keep scroll position.
*Effort:* S.

**3.4.5 — "Approval queue is clear" even when there *were* approvals — MAJOR.**
`src/app/(app)/principal/page.tsx` loads `useIssues({ status: "APPROVED" })` once (line 14) and never reloads. After the principal approves a batch, the board still shows the pre-approval list — or worse, the approvals they *just* made disappear from other lists while this one never updates. Combined with 3.4.1, the queue page is the least trustworthy screen in the product.
*Fix:* refetch on window focus + after each approve action (mutation triggers invalidate).
*Effort:* S.
*Status:* **FIXED** — after any EscalationCard action `reloadApproved()` + `reloadEscalated()` both fire (`refreshAll`), and both lists re-fetch on window focus. `principal/page.tsx`.

**3.4.6 — Dashboard hides its error and skips the empty story — MINOR.**
`src/app/(app)/dashboard/page.tsx` does render a proper `EmptyState` on error (good) but the public/home `IssueBoard` and `AnnouncementBoard` show an error string with no retry affordance.
*Fix:* give every error surface a Retry button; treat "empty" as a designed story (icon + next action), never a bare message.
*Effort:* S.

---

### 3.5 Forms & validation

**3.5.1 — Uploads are base64 blobs in Firestore, right at the document-size limit — MAJOR (edge risk).**
`src/app/api/uploads/route.ts` stores each image as a separate document in the `imageBlobs` collection (issue docs keep only image URLs — list queries do **not** drag blobs along), capped at `MAX_BASE64 = 1_000_000` (~750 KB decoded) per image, 3 images max. A ~750 KB binary encodes to ~1,000,000 base64 characters, i.e. the blob document sits **exactly** on Firestore's 1 MiB per-document limit — one slightly-fatter photo (or the base64 of a 740 KB image rounding up) away from a hard `FAILED_PRECONDITION` write error.
*Why it's wrong:* the cap and the platform limit are the same number; the design lives at the edge with zero margin. It also inflates stored size ~33% and costs reads whenever a blob is fetched.
*Fix (in scope):* tighten the server buffer cap to ~700 KB binary (leaving margin under 1 MiB) and validate the same number client-side before upload. A full object-storage migration stays a future structural item.

**3.5.2 — `createObjectURL` is never revoked — MINOR.**
`src/components/announcements/AnnouncementForm.tsx:81` and `src/app/(app)/new/page.tsx:71` call `URL.createObjectURL()` with no matching `revokeObjectURL()` anywhere in the tree. Every image preview leaks a blob URL until the tab dies.
*Fix:* revoke in the cleanup of the effect / on replace.
*Effort:* S.

**3.5.3 — File size limits differ from what the API enforces — MINOR.**
The upload path enforces ~750 KB (buffer cap) while the client prepares images via `fileToCompressedBase64`; the mismatch between client cap and server cap means users can hit a server error for a file the client said was fine.
*Fix:* encode the cap once (client constant), validate the same number server-side, and show the limit *before* the user picks a file.
*Effort:* S.

---

### 3.6 Feedback & confirmation

**3.6.1 — Toasts vanish in 6 s and errors are dropped at the cap — MINOR.**
`src/components/ui/Toast.tsx:70` fires `window.setTimeout(…, 6000)` and caps the stack at 3 (`[...prev.slice(-2), …]`, line 69). On manual dismiss the timer still fires but the callback filters by id (harmless no-op — but the timer is never cleared). The real issue: a burst of 5 errors silently drops two with zero trace, and an error toast that vanishes in 6 s has no way to be reopened. For a tool whose main failure mode is a flaky network, that's a support-nightmare pattern.
*Fix:* persist the latest error until acknowledged; clear timers on manual dismiss; keep the 3-cap but never drop *errors* silently.
*Effort:* S.

**3.6.2 — Destructive/approve actions lack confirm dialogs — MAJOR.**
Approving, routing, closing, and completing are one-click with no confirm step (`EscalationCard.tsx` approve/reject, `CloseIssueModal` confirm, `MaintenanceJobCard` complete). In a system where actions change real-world maintenance work and create audit records, a single misclick is a real incident.
*Fix:* add a confirm step for approve/close/complete (the modal infra already exists — reuse it). Keep reject with a mandatory reason (it already collects one — extend to approve when reasons are needed for audit).
*Effort:* S.

**3.6.3 — "Something went wrong" tells you nothing — MINOR.**
`Toast.tsx` `formatError` (lines 36–56) maps server validation to readable bullet lists — good. But everything else becomes `"Something went wrong"` / `"Something unexpected happened."` with no retry, no correlation id, no what-next.
*Fix:* include a short human action ("Check your connection and try again."), and log a correlation id server-side that support can trace.
*Effort:* S.

---

### 3.7 Modals & accessibility

**3.7.1 — No focus management anywhere in modals/lightbox — MAJOR.**
`CloseIssueModal.tsx` and `IssuePhotos.tsx` handle Escape + body scroll-lock but do **not** trap focus, set an initial focus, or restore focus on close. Keyboard users tab out into the page behind the modal; screen readers can read hidden content; the lightbox is a keyboard trap in reverse.
*Why it's wrong:* WCAG 2.4.3 + 2.1.2 failures. This app's users include a campus with assistive-technology users; right now the modal is unusable by keyboard.
*Fix:* add `aria-modal`, `role="dialog"`, initial focus, focus trap, and focus restore to the shared modal/lightbox (one component, used twice).
*Effort:* S.

**3.7.2 — `aria-hidden` canvas animation runs for everyone — MAJOR.**
`src/components/home/DotGrid.tsx:289` sets `aria-hidden="true"` (correct) but the animation still runs its `requestAnimationFrame` loop and a global `mousemove` listener (`window.addEventListener("mousemove", throttledMove, { passive: true })`, line 279) with **no `prefers-reduced-motion` check anywhere in the app** (grep confirms zero occurrences). For vestibular users this is exactly the motion that reduced-motion exists to kill; for everyone else it burns battery in a background tab (the loop never pauses).
*Fix:* gate init on `matchMedia("(prefers-reduced-motion: reduce)")`, pause the rAF loop when `document.hidden`, and throttle already exists (50 ms, line 278) — keep it.
*Effort:* S.
*Status:* **FIXED** — `DotGrid.tsx` now static-draws (no loop, no listeners) under `prefers-reduced-motion` and pauses its rAF loop on `document.hidden`; a global `@media (prefers-reduced-motion: reduce)` guard in `globals.css` disables the CSS animations. Also now lazy-loaded via `next/dynamic` (3.9.1).

**3.7.3 — Toast container has `role="status"` and no aria-live level — MINOR.**
`Toast.tsx:88` uses `role="status"` (polite). Errors should be assertive; also the toast panel has no `aria-live` and no per-toast role.
*Fix:* set `role="alert"`/`aria-live="assertive"` for error toasts.
*Effort:* S.

**3.7.4 — Toggle knob uses absolute `left` pixel jumps — MINOR.**
`src/app/(app)/settings/page.tsx:121` moves the knob with `left-[26px]` / `left-0.5`. Works now; brittle and not animatable cleanly. (The `role="switch"` + `aria-checked` handling is correct — good.)
*Fix:* animate with `translate-x`; minor.
*Effort:* S.

---

### 3.8 Data freshness & caching

**3.8.1 — Analytics does ~3,000 Firestore reads with no cache — CRITICAL.**
`src/app/api/analytics/summary/route.ts` runs 4 queries — `issues.limit(500)`, `.limit(500)`, `.limit(1000)`, `.limit(1000)` — on every request (lines 25–30). That's up to 3,000 document reads per analytics page load, uncached, at the current scale and unbounded as issues grow.
*Why it's wrong:* Firestore bills per read. Three concurrent principals on a busy day are ~9k reads per minute; this scales to real money and real latency, and it'll slow the whole project down once it exceeds the free tier.
*Fix:* maintain aggregate counters (status counts, weekly counts) in a counter doc updated on mutation, or run an hourly scheduled aggregation into a small doc the route reads (one read). Never scan the whole collection per request.
*Effort:* M.

**3.8.2 — Board loads 10 items but the query scans the whole issue space — MAJOR.**
`src/app/api/issues/route.ts` defines `BOARD_LIMIT = 10` and `BOARD_MAX_PRIORITY = 3` (lines 17–19), but the "board" endpoint filter logic still has to visit/order the wider set to pick the 10. `src/app/api/issue-history/route.ts` caps `MAX = 2000` — a 2,000-doc fetch for a history page that shows 20.
*Fix:* paginate with cursors (`startAfter`), and make history server-paginated (20/page, next token) instead of `MAX = 2000`.
*Effort:* M.

**3.8.3 — Assign-team is fetched per card mount — MINOR.**
`src/components/issues/HeadCards.tsx` (`AssignCard`) calls `/api/teams` on each mount (lines 22–33). Five cards, five identical requests. Also the list of teams/assignees never refreshes.
*Why it's wrong:* N+1 request pattern; also stale if roles change.
*Fix:* fetch teams once at the board level, pass down.
*Effort:* S.

**3.8.4 — Client API has no 401 handling — MAJOR.**
`src/lib/clientApi.ts` keeps `authToken` in memory and throws on non-2xx; when the ID token expires mid-session, every subsequent call 4xxes, `useIssues` swallows it into an empty list (3.4.1), and the user silently loses their session. Meanwhile `AuthProvider` already has `refreshClaims` using `getIdTokenResult(true)` to force-refresh tokens — nothing calls it on 401.
*Why it's wrong:* sessions die invisibly in the middle of a working session. The #1 support complaint for token-auth SPAs.
*Fix:* on 401, refresh the token once and retry the request; only then sign out and redirect.
*Effort:* M.

---

### 3.9 Performance & bundle

**3.9.1 — gsap + InertiaPlugin shipped to the public page for decorative dots — MAJOR.**
`src/components/home/DotGrid.tsx` imports `gsap` and `gsap/InertiaPlugin` (`line 4-5`). The entire gsap runtime is loaded on the landing page — the highest-traffic page — for a cosmetic mouse effect that most visitors never trigger.
*Why it's wrong:* lands on the critical path of the page whose job is converting visitors. It also never pauses (3.7.2).
*Fix:* lazy-load DotGrid via `next/dynamic` with `ssr:false` + `loading="lazy"`, and only after `pointer: fine` + no-reduced-motion.
*Effort:* S.
*Status:* **FIXED** — `PublicHero.tsx` now `next/dynamic`s DotGrid with `ssr:false`; gsap is no longer on the public critical path.

**3.9.2 — recharts is bundled into portal routes that mostly never show a chart — MAJOR.**
`src/app/(app)/analytics/page.tsx` and `src/components/ai/WeeklyInsightsCard.tsx` import recharts. Any route that pulls `WeeklyInsightsCard` (or imports analytics primitives) pays for the charting lib — confirmed present in the dashboard/portal bundle. recharts is one of the heavier chart libs (~100 KB+).
*Fix:* `next/dynamic` the chart components; verify code-splitting removes recharts from non-analytics routes.
*Effort:* S.
*Status:* **FIXED** — the recharts-using charts in `WeeklyInsightsCard` moved to a new lazy child (`WeeklyInsightsCharts.tsx`, `next/dynamic` + `ssr:false`), removing recharts from the HOD/dashboard bundle. `/analytics` keeps recharts static since it is the chart route.

**3.9.3 — pdfmake is already lazy-loaded — CLEARED.**
`src/lib/receiptPdf.ts` imports pdfmake only as a type (`import type { Content, TDocumentDefinitions }`); the runtime `import("pdfmake/...")` happens inside `downloadIssueReceipt`, so the PDF engine is never on the issue-detail-page critical path. Nothing to fix here.

**3.9.4 — Two next/fonts + the two custom display faces = 4 font loads — MINOR.**
`src/app/layout.tsx` loads Inter + Poppins via `next/font/google`; globals.css registers TTOctosquaresBlack + ValveBd locally. Four typefaces for a maintenance app; Inter and Poppins are visually near-identical for UI text. `font-display`/`font-valve` alternate across the public vs portal worlds (3.1.1).
*Fix:* consolidate to one UI family (Inter) + one display family; drop Poppins.
*Effort:* S.

**3.9.5 — Full-page reloads and per-mount refetching block client-side caching — MINOR.**
Beyond 3.4.4, the `AnnouncementBoard`, `RecentIssuesPanel`, and every `useIssues` consumer refetch on mount with no staleness window, so navigating portal pages re-runs all queries. Combined with 3.8.x this is a lot of wasted reads.
*Fix:* adopt `useSWR`/TanStack Query with `staleWhileRevalidate` and a 30 s stale window; shared cache kills the N+1 pattern in one move.
*Effort:* M.

---

### 3.10 Confusing flows & terminology

**3.10.1 — "Blocked" vs "Pending" again, but as a *flow* — MAJOR.**
Beyond the label (3.1.3): when a maintenance worker blocks a job, the reporter on the other side sees… a pending status with no explanation. There is no note shown to the reporter, no "what happens next" message, no SLA impact disclosure. The two sides of the same workflow have incompatible mental models.
*Fix:* when a job is blocked, show the reporter a human note ("Blocked — awaiting part", with the maintenance comment), and define the label once (3.1.3).
*Effort:* S–M.

**3.10.2 — Validate page hides its logic behind defaults — MINOR.**
`src/app/(app)/validate/page.tsx` defaults the priority to `"3"` and bundles reject-reason + priority into one panel; a validator can approve without consciously choosing a priority, so "3" becomes the accidental answer.
*Fix:* require an explicit priority selection (no default) on validate; show what the AI suggested vs what they chose.
*Effort:* S.

**3.10.3 — "Back" button as primary nav on settings — MINOR.**
Covered in 3.3.4. `settings/page.tsx:77` — the settings page's only nav is a back-chip. Users can't tell where "Back" goes until they click.
*Fix:* explicit breadcrumb/links.
*Effort:* S.

**3.10.4 — Track-an-issue is copy-pasted but not actually an anonymous flow — MAJOR.**
The marketing site sells "Track an issue" (`SiteFooter.tsx:6`) and the public copy implies anyone with a token can check status. The implementation routes anonymous visitors to `/login` (3.3.1), and while `src/app/track/[token]/page.tsx` exists as a token page, the navigation path never gets a logged-out user there.
*Fix:* wire the footer to `/track` with a token-input screen (no login), or change the copy to "Sign in to track". Pick one; right now both are broken promises.
*Effort:* S.
*Status:* **FIXED** — new anonymous `/track` token-entry page (`src/app/track/page.tsx`) wired from the footer; it navigates to the existing `/track/[token]` page + `/api/track/[token]`. Also benefits from the 3.3.1 `?next=` fix for member links.

**3.10.5 — Settings "notifications" is a single boolean with optimistic text — MINOR.**
`src/app/(app)/settings/page.tsx:54` — the only notification preference is `notifyEmail` (on/off), shown as a plain text notice ("Email notifications turned on."). No granularity, no test-send, and the switch's default (`?? true`) means "on" until the server disagrees.
*Fix:* at minimum a "Send test email" and a correct initial value from the profile fetch; long term, per-event toggles.
*Effort:* S.

**3.10.6 — AI feature copy overpromises what ships — MINOR.**
`src/components/home/AiSection.tsx` (lines 11–42) claims six shipped features ("Smart routing", "Spam & photo safety", "Insights & forecasting"). Some exist; the copy ("Every step that can be automated is") is written as marketing while parts are still stubbed or thin. Auditors of a demo app don't care, but this is a public marketing page on the product.
*Fix:* align claims with what actually runs; the tone should be "shipping today", not "eventually".
*Effort:* S.

---

## 4. Priority roadmap

### Fix-first (ship-blocking — do these before anything else)
1. **3.4.1** — errors-as-empty-states (the trust bug) · S — **DONE**
2. **3.2.1** — public nav magic margins · S — **in progress** (approved rebuild)
3. **3.5.1** — base64 blobs at the Firestore 1 MiB edge · M
4. **3.3.1** — login destroys destination · S — **DONE**
5. **3.8.1** — ~3k reads per analytics load · M — **in progress** (TTL cache)
6. **3.8.4** — no 401 handling → silent session death · M
7. **3.7.1** — modal/lightbox focus management · S
8. **3.7.2** — reduced-motion + never-pausing animation · S — **DONE**
9. **3.1.3 / 3.10.1** — "Blocked"/"Pending" contradiction · S — **3.1.3 DONE** (3.10.1 reporter note open)
10. **3.4.4** — `window.location.reload()` refresh · S

### Quick wins (one sitting each)
- **DONE:** 3.3.1 (next=) · 3.4.1 (error states) · 3.4.5 (approvals refresh) · 3.7.2 (reduced-motion) · 3.9.1 (gsap lazy) · 3.9.2 (recharts lazy) · 3.10.4 (track-an-issue) · 3.1.3 (Blocked→Pending)
- **OPEN:** 3.3.3 unread badge cap · 3.4.2 polling progress · 3.4.3 refresh-on-focus · 3.5.2/3.5.3 blob URLs + caps · 3.6.2 confirm dialogs · 3.6.3 better error copy · 3.8.3 fetch teams once · 3.10.2/3.10.6 copy & flow fixes · 3.3.4/3.10.3 back-button nav.

### Structural (worth doing, budget a week)
- 3.1.1/3.1.2 unify the spacing/color/type systems into one set of tokens · 3.8.2 cursor pagination everywhere · 3.9.5 adopt SWR/TanStack Query with shared cache · 3.1.4 button overflow sweep + a full device-lab pass.

---

### Auditor's note on the marketing site vs. the portal
The public page and the portal are the same product and should be designed by the same system. Today the marketing page gets a bespoke hero, custom display fonts, and a physics animation, while the portal — the thing people use every day to run a campus — gets pixel-hacked nav, fake empty states, and a badge that lies. Invert the priority. Polish the tool; the marketing page is already the good part.

**Stop shipping empty states that mean "the network is down." That one change is worth more than every other fix on this list combined.**

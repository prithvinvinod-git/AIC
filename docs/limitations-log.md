# Limitations Log

Things that could not be performed (or could not be verified/confirmed) well during the UI & Settings polish pass, and the reasoning / workaround applied.

| # | Item | Status | Details & workaround |
|---|---|---|---|
| 1 | Visual verification of `public/servoxlogo.png` | ⚠️ Not verified visually | The active model cannot process image input, so the logo's appearance (transparency, colours, whether it is an icon or a full wordmark) could not be confirmed. Rendered as a square asset at `h-8 w-auto`. **Manual check recommended:** open `public/servoxlogo.png` and confirm it looks right at 32px in the app header; adjust `h-8` (e.g. `h-9`/`h-10`) or add `object-contain` if it renders too small/large. |
| 2 | "Set the timeline div aligned to its relative div" | ⚠️ Ambiguous instruction | The phrase could mean the timeline card position vs the left column, or the connector line vs each `relative` list item. Interpreted as the latter: the connector line now starts at the dot's vertical centre (`top-[11px]`, left centred at `left-[5px]`). If you meant the whole Timeline card's vertical position, say so and I'll restructure the sidebar. |
| 3 | Back button border | ✅ Fixed with a caveat | The button already carried `border border-silver`, but the un-layered `.btn { border: 1px solid transparent }` rule in `globals.css` **beats** Tailwind's layered utilities, so the border never rendered. Fixed by switching to `btn btn-secondary`, which sets the silver border in the same un-layered stylesheet. |
| 4 | Hide the menu button on desktop | ✅ Already satisfied | The hamburger already had `md:hidden` and the desktop nav is `md:flex`, so it never renders at ≥768px. Verified; no code change needed. |
| 5 | "Make profile/settings fully functional" | ⚠️ Partially a confirmation | Name/phone/notify-email saving was already functional via `PATCH /api/profile`. Added the admin-managed note + role/college display. No code path was broken; nothing else was missing for self-service. |
| 6 | Repo-wide lint | ⚠️ 4 pre-existing errors | `npm run lint` fails on `functions/lib/index.js` — a **tracked compiled artifact** of the Firebase Functions build (`require()` style). Not from this session. Fix would require editing generated output or excluding `functions/**` from the lint script. |
| 7 | Moving action buttons up 40px | ✅ Fixed (root cause) | Originally `-mt-10`, which compiled to **-10px** (the project's `@theme` redefines `--spacing-10: 10px`, overriding Tailwind's default spacing scale). Switched to `-mt-[40px]` on both sidebar buttons — confirmed in compiled CSS as `margin-top:-40px`. |

---

# Session 2 — UX Audit (Confusion-Prone Areas)

| # | Item | Status | Details & workaround |
|---|---|---|---|
| 8 | Visual confirmation of new/clarified UI copy | ⚠️ Not visually verified | Auto-close grace note, "Priority set by", SLA "starts once accepted", landing copy, assign "AI suggests" reason, escalation hint — all text/render changes; could not render the app to confirm wrapping, truncation, or contrast in the browser. **Manual check recommended** on `CloseIssueModal`, issue detail, validate panel, and landing page. |
| 9 | Track stepper per-issue steps | ⚠️ Live-data path unverified | Steps now depend on `issue.escalation?.required` or an `ESCALATED` timeline event. Escalation steps will only render once a real escalation occurs; could not exercise that path without live data. Fallback mapping (PENDING → ONGOING) is exercised for non-escalated issues. |
| 10 | `ESCALATED → REJECTED` transition | ⚠️ Not exercised end-to-end | The new machine transition (roles hod/principal/admin, `rejectionReason` ≥ 3 chars) and the EscalationCard reject control were compiled/type-checked and the reject API route is state-generic, but the full HOD/Principal reject flow was not clicked through in a running app. |
| 11 | `new/page.tsx` `-mt-[40px]` → `mt-6` | ✅ Fixed | Replaced a negative-margin layout hack with normal spacing; rendering intent preserved but not visually re-confirmed. |

## Session 2b — follow-up verification (2026-08-08)

| # | Item | Status | Details |
|---|---|---|---|
| 12 | `ESCALATED → REJECTED` (#10) | ✅ Verified end-to-end | Smoke script over the live HTTP API: validate P2 → ESCALATED, reject with short reason → 400, HOD reject → REJECTED, `issue.rejection.{reason,by,at}` persisted; detail page renders it. |
| 13 | Track stepper data (#9) | ✅ Verified at API level | `/api/track/[token]` returns issue (`escalation.required=true`) + ordered timeline incl. `VALIDATED->ESCALATED`, satisfying the stepper's escalation condition. Live render still needs a browser. |
| 14 | Visual copy + `/new` spacing (#8, #11) | ⚠️ Needs browser | Landing page copy confirmed via HTTP. Detail-page notes, hints, and `/new` spacing render client-side behind Firebase auth and were not visually confirmed. |

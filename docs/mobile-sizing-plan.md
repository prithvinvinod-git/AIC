# Mobile sizing plan

Goal: make every page compact and touch-friendly on phones + portrait tablets (<768px)
while leaving the desktop (>=768px) version **byte-for-byte unchanged**.

## Rules

- **Breakpoint:** all mobile changes use `max-md:` (= <768px) or live inside one
  `@media (max-width: 767.98px)` block at the end of `globals.css`.
- **Overlap 640-767px:** Tailwind emits `max-*` variants after `min-*` (`sm:`), so
  `max-md:` overrides win there. Relied on — do not reorder variants.
- **Desktop (>=768px):** only NEW `max-md:`/`max-*` classes and the media block are
  added. No existing class values changed. Verify via `git diff` (only additions).
- **Text:** body/paragraph text stays >=14px. We compact structure, not readability.
- **Broken-small items** (10px bell box, 4px icons, 8px chips — from the custom
  tiny spacing tokens) are fixed **mobile-only** per product decision.

## Progress

- [x] Phase 0 — Layer 1 global media block + this doc
- [x] Phase 1 — Typography & rhythm
- [x] Phase 2 — Header/nav
- [x] Phase 3 — Broken-small icon/chip fixes (mobile only)
- [x] Phase 4 — Cards, queues, fixed heights
- [x] Phase 5 — Images/photos
- [x] Phase 6 — Forms & dense rows
- [x] Phase 7 — Landing sections
- [x] Phase 8 — Verify (tsc, eslint, build, desktop unchanged)

## Implementation notes (what changed vs this plan as written)

- **Broken-small fixed at the root:** instead of per-item `max-md:h-[16px]` classes, the
  mobile media block now redefines `:root` `--spacing-4 … --spacing-80` back to the standard
  Tailwind 0.25rem scale inside `@media (max-width: 767.98px)`. Desktop keeps the custom tiny
  tokens; on mobile every spacing utility (buttons, icons, chips, gaps, dropdowns) self-heals.
- **Phase 3/4 compacting dropped where redundant:** with the scale restored, `.card` 16px and
  `card p-4` (16px) already match; the planned `max-md:p-3` compacting of card panels was not
  applied (avoided a 12px/16px inconsistency). Table cells keep `px-4 py-3` (=16/12px mobile).
- **IssuePhotos:** added a `mobileSize` prop; default tiles drop 72px→56px, the two detail
  callers (`/issues/[id]`, `/track/[token]`) pass `mobileSize={100}`. Uses trailing-`!`
  important utilities to beat the inline `style={{width,height}}`.
- **Hero photo-stack item removed** (no such element exists in the heroes — stale research).
- **AppShell:** mobile padding now comes from the restored `py-6` (24px) token; no override.
- **Bell button:** `max-md:h-[40px] max-md:w-[40px]` (fixed px; token `h-11` would only be 11px).

## Phase notes

### Phase 0 — globals.css Layer 1
`@media (max-width: 767.98px)`:
- `.card` padding 24px → 16px; radius 16px → 12px
- `.btn` 10px 20px → 8px 16px
- `.btn-sm` 6px 14px → 6px 12px
- `.btn-lg` 14px 28px → 11px 20px
- `.input` 10px 14px → 9px 12px
- `.label` margin-bottom 6px → 4px
- `.tag` 3px 12px → 2px 10px; font-size 12px → 11px
- `.kpi` 20px 24px → 14px 16px

### Phase 1 — Typography & rhythm
- Page h1 `text-2xl` → `max-md:text-xl`
- Section h2 `text-lg` → `max-md:text-base`
- KPI values `text-3xl` → `max-md:text-2xl`
- Hero display `text-5xl` → `max-md:text-4xl` (PublicHero, DashboardHero)
- Landing section h2 `text-2xl` → `max-md:text-xl`
- AppShell main `py-6` → `max-md:py-8`
- Board root `gap-10` → `max-md:gap-6`; sections `gap-8` → `max-md:gap-5`

### Phase 2 — Header/nav
- ProfileMenu name block hidden `max-md:hidden`
- Bell button `max-md:h-11 max-md:w-11` (fixes 10px box)
- PublicNav brand `text-2xl` → `max-md:text-xl`

### Phase 3 — Broken-small fixes (mobile only)
- `h-4 w-4` icons (chevrons, Brain) → `max-md:h-[16px] max-md:w-[16px]`
- `h-8 w-8` chips → `max-md:h-[32px] max-md:w-[32px]`
- toast icon `h-5 w-5` → `max-md:h-[20px] max-md:w-[20px]`
- spinner `h-6 w-6` → `max-md:h-[24px] max-md:w-[24px]`

### Phase 4 — Cards, queues, fixed heights
- Card panels `p-4` → `max-md:p-3`: IssueActions, DispatchCard, MaintenanceJobCard,
  EscalationCard, HeadCards, AISuggestionCard, CommentsSection, AI cards, AnnouncementForm
- RecentIssuesPanel `min-h-[460px]` → `max-md:min-h-[380px]`
- Boards `min-h-[55svh]` → `max-md:min-h-[42svh]`
- Hero `pt-[112px] pb-14` → `max-md:pt-[96px] max-md:pb-10`
- Toast `py-[22px]` → `max-md:py-4`

### Phase 5 — Images/photos
- IssuePhotos default tile 72px → `max-md:!h-14 max-md:!w-14` (56px; `!` to beat inline style)
- Detail size 148px → `max-md:!h-25 max-md:!w-25` (~100px)
- Lightbox close 50px → `max-md:h-10 max-md:w-10`
- DashboardHero photo stack `h-24 w-24` → `max-md:h-20 max-md:w-20`
- Profile avatar `h-16 w-16` → `max-md:h-12 max-md:w-12`

### Phase 6 — Forms & dense rows
- Auth Google button `max-md:whitespace-normal` + tighter
- Purchase requirement row `max-md:flex-wrap`
- Admin config grid `max-md:grid-cols-1`
- Table cells `px-4 py-3` → `max-md:px-3 max-md:py-2`
- CompactIssueRow `px-5 py-3.5` → `max-md:px-3 max-md:py-2.5`
- PriorityBadge hidden `max-[400px]:hidden`
- Announcements article date column `max-md:hidden`
- Modal outer `p-4` → `max-md:p-3`

### Phase 7 — Landing
- AiSection tiles `h-14 w-14` → `max-md:h-12 max-md:w-12`
- Feature/AI grids `gap-4` → `max-md:gap-3`
- Footer `gap-10` → `max-md:gap-6`

### Phase 8 — Verify
- `npx tsc --noEmit`, `npx eslint src`, `npm run build`
- Screenshots at 360/390/414/430/700 (mobile) and 1280/1440 (desktop identical)
- `git diff` shows only `max-md:`/`max-*` additions + media block

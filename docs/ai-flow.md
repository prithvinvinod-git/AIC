# AI Flow — Campus Maintenance AI

How every AI feature in this app works: triggers, model calls, fallbacks, persistence, and where it surfaces in the UI.

## 1. Overview

```
Issue reported (POST /api/issues)
        │
        ▼
  runAiOnCreate()  ── after() hook, fire-and-forget
        │
        ├── F1 triageFlow ──────────► writeTriage ─► aiSuggestion.*
        │                              └► applyTriagePriority (only while status === NEW)
        └── F2 findDuplicatesFlow ────► writeDuplicates ─► aiSuggestion.*
```

Philosophy, baked into every flow:

- **LLM-first, deterministic fallback.** Each flow tries the model; on any error (quota 429, timeout, invalid JSON) it degrades to a keyword/statistical classifier that works fully offline. The app is demoable with **zero** AI keys.
- **AI never owns `status`.** Every AI path writes only into `issue.aiSuggestion`, except `applyTriagePriority` which may set `priority` while the issue is still `NEW` (spam → P5).
- **One-shot.** `aiSuggestion.aiProcessed` guards re-runs (cost control).

## 2. Providers & enablement — `src/lib/ai/genkit.ts`

Lazily-created Genkit runtime with two plugins:

- **Google AI (Gemini)** — `@genkit-ai/googleai`, always configured.
- **Groq** — `genkitx-groq`, added only when `GROQ_API_KEY` is set.

| Env var | Effect |
|---|---|
| `GOOGLE_GENAI_API_KEY` | Enables Gemini lane. `"demo-key"`/empty disables it. |
| `GROQ_API_KEY` | Adds the Groq lane and the Groq models to the triage chain. |
| `AI_MODEL` | Overrides the model ref used by non-triage flows; defaults to `gemini-3.1-flash-lite`. |

- `aiEnabled()` (genkit.ts:31) — the single runtime gate. All flows check it first.
- `triageModelChain()` (genkit.ts:59) — a fallback chain of full model refs (`gemini-3.1-flash-lite` → `gemini-3-flash-preview` → groq models if present → `AI_MODEL` → legacy 2.5/2.0 flash). Triage walks the chain so one 429 doesn't drop to the classifier.

> Note: the admin `config.ai.enabled` toggle (`DEFAULT_CONFIG.ai`, constants.ts:166) is persisted and shown in settings, but the **actual** gate is the env-var check in `aiEnabled()`. The admin toggle does not currently gate any flow.

## 3. The shared pattern

Every flow follows the same shape:

1. Load inputs (description, optional photo, active categories, recent issues…).
2. If `!aiEnabled()` → deterministic fallback, done.
3. Else `ai.generate({ model, system, prompt, output: { schema, format: "json" }, config: { temperature: low } })` with a **Zod output schema** so bad JSON is rejected by Genkit.
4. On throw or invalid output → fallback. Logged, never crashes the caller.

## 4. The flows (F1–F7)

### F1 — Auto-triage with photo inspection — `src/lib/ai/triage.ts`

- `triageFlow()` (triage.ts:202): maps description + optional photo to one configured category, a P1–P5 priority, reasons, photo summary, and safety flags.
- **Spam defense is deterministic-first**: `spamCheck()` (triage.ts:24) catches keyboard mashing, gibberish (vowel ratio), placeholder/filler words, promotional text, and repetition — *even when the model is down*. The model catches subtler cases and both sources are merged.
- LLM path walks `triageModelChain()`; spam forces `suggestedPriority = 5`.
- Fallback: `fallbackTriage()` (triage.ts:142) — keyword categories (`KEYWORDS`), `SAFETY_WORDS` flags (fire/gas/electrical bump priority), urgency/minor overrides.
- **Persistence**: `writeTriage()` (triage.ts:267) → `aiSuggestion.{category, suggestedPriority, reasons, photoSummary, safetyFlags, isSpam, spamReasons, aiProcessed, aiModel, processedAt}`.
- **Authority**: `applyTriagePriority()` (triage.ts:290) writes `priority` onto the issue only while status is `NEW` (`prioritySetBy: "AI Triage"`); flagged spam notifies that department's validators via `notifyMany` with a "possible spam" alert.

### F2 — Duplicate / similar-issue detection — `src/lib/ai/duplicates.ts`

- `findDuplicatesFlow()` (duplicates.ts:46): compares the description against up to 50 recent **open** issues at the **same location**.
- **No LLM** — token overlap (`overlapScore`, duplicates.ts:29: stopword-filtered Jaccard-like `intersection / min(size)`) as an offline stand-in for embeddings.
- `threshold` 0.45 (default) → sets `duplicateOf` / `duplicateIssueNo` / `matchScore`; top 5 sorted as `similarIssues`.
- `writeDuplicates()` (duplicates.ts:90) → `aiSuggestion.duplicate*`.

### F3 — Smart routing suggestion (hybrid) — `src/lib/ai/routing.ts`

- `rankCandidates()` (routing.ts:19): a **rule engine** — picks the team (issue `routing.teamId` → category default → first active team), scores members by `done*2 - load` (completion record vs current open workload).
- `suggestAssignmentFlow()` (routing.ts:83): takes the top 3 staff, builds a deterministic `reason`; **when AI is enabled** the model rewrites the reason in natural language (workload/experience). The rule output is the floor that always works.
- **Validator confirms before anything is written** to `routing`; until then only `writeRoutingSuggestion()` (routing.ts:141) → `aiSuggestion.routing` exists.

### F4a — Requirements extraction — `src/lib/ai/assist.ts`

- `extractRequirementsFlow()` (assist.ts:39): description → draft `{item, qty, needsApproval}[]` for the maintenance job card.
- Keyword table first (`PART_KEYWORDS`, assist.ts:11 — valves, bulbs, fans, taps…); AI refines and up to 6 items are returned. Staff confirm before saving.

### F4b — Closure report drafting — `src/lib/ai/assist.ts`

- `draftClosureFlow()` (assist.ts:91): staff bullets → a structured closure report (work done / parts / hours / follow-up, <120 words). Fallback expands the bullets verbatim.

### F5 — Weekly governance insights — `src/lib/ai/insights.ts`

- `weeklyInsightsFlow()` (insights.ts:18): aggregates last-7-days stats (created, closed, SLA breaches, avg resolution, per-category counts) → `{executiveSummary, slaBreaches, topConcerns, recommendations}`.
- AI writes the summary + recommendations; the counts/breaches/concerns stay deterministic.
- Powers the HOD panel (GET route) and the pending weekly report email (todo #5).
- `writeWeeklyInsights()` (insights.ts:120) persists to `stats/weekly` or `config/weekly` (exported, not yet wired to a cron).

### F6 — Root cause analysis — `src/lib/ai/rootCause.ts`

- `rootCauseFlow()` (rootCause.ts:103): loads last 30 days of unresolved issues, feeds up to 1000 to the model for `{summary, likelyArea, confidence, recommendation}`.
- Fallback `fallbackRootCause()` (rootCause.ts:56): clusters by location → dominant category → area hint + confidence from count (≥4 High, ≥2 Medium).
- Prompt forces humility ("possible", never a definite diagnosis).

### F7 — Predictive maintenance — `src/lib/ai/predictive.ts`

- `predictiveMaintenanceFlow()` (predictive.ts:60): last 45 days of issues grouped by location → model returns 5–10 at-risk `{location, category, count, pattern, risk, recommendation}`.
- Fallback `fallbackPredictive()` (predictive.ts:27): frequency-based risk tiers, top 10.

## 5. Trigger points

| Trigger | Where | Notes |
|---|---|---|
| **On issue create** | `src/app/api/issues/route.ts:82` — `after()` hook | Runs `runAiOnCreate(ref.id)` (index.ts:41) = F1 + F2, in parallel with notifications/stats. `after()` keeps the promise alive past the response. |
| **Manual triage** | `POST /api/ai/triage` | `AISuggestionCard` "Run triage" button; re-runs blocked by `aiProcessed`. |
| **Validator routing** | `runRoutingSuggestion()` (index.ts:74), called from `IssueActions.tsx` / `HeadCards.tsx` via `POST /api/ai/suggest-assign` | F3. |
| **Maintenance job card** | `MaintenanceJobCard.tsx` via `POST /api/ai/extract-requirements` | F4a. |
| **On demand (panel cards)** | `POST /api/ai/root-cause`, `GET /api/ai/at-risk`, `GET /api/ai/weekly-insights` | F6, F7, F5 — computed live. |

## 6. API routes & permission matrix

| Route | Flow | Allowed roles |
|---|---|---|
| `POST /api/ai/triage` | F1 | Reporter (owner) **or** validator/hod/principal/admin |
| `POST /api/ai/duplicates` | F2 | Any authenticated user |
| `POST /api/ai/suggest-assign` | F3 | validator, admin |
| `POST /api/ai/extract-requirements` | F4a | maintenance, validator, admin |
| `POST /api/ai/draft-closure` | F4b | maintenance, validator, admin |
| `GET /api/ai/weekly-insights` | F5 | admin, validator, hod, principal |
| `POST /api/ai/root-cause` | F6 | admin, validator, hod, principal, maintenance |
| `GET /api/ai/at-risk` | F7 | admin, validator, hod, principal |

All routes use `requireAuth` (ID token + custom claims); checks live in the route handler (Firestore rules are defense-in-depth only, per `docs/agent.md`).

## 7. Persistence model — `issue.aiSuggestion`

```ts
aiSuggestion: {
  category, suggestedPriority, reasons: string[],
  photoSummary, safetyFlags: string[],
  isSpam, spamReasons: string[],
  duplicateOf, duplicateIssueNo, matchScore, similarIssues: [],
  routing: { teamId, staffIds, reason },
  aiModel,          // e.g. "googleai/gemini-3.1-flash-lite" or "fallback-classifier"
  aiProcessed,      // one-shot guard
  processedAt,
}
```

Written only via the `write*` helpers above — never by the client.

## 8. UI surfaces

- **`AISuggestionCard.tsx`** (issue detail) — renders category, priority, photo summary, spam banner, duplicate match, safety tags, reasons; "Run triage" button.
- **`IssueActions.tsx`** — validator confirm-flow for the F3 routing suggestion.
- **`HeadCards.tsx`** (HOD) — requests F3 suggestions.
- **`MaintenanceJobCard.tsx`** — F4a requirements draft.
- **`RootCauseAnalysisCard.tsx` / `AtRiskLocationsCard.tsx`** — F6 / F7 panels.
- **HOD page** — F5 governance narrative.
- **Admin page** — `config.ai.{enabled,threshold}` toggles (display-only, see §2).

## 9. Safety rails & cost control

1. **Role gating** on every route (§6).
2. **AI never writes `status`**; F3 results require validator confirmation.
3. **`applyTriagePriority`** only overrides severity while `NEW` — validator decisions are never clobbered.
4. **Spam** degrades to P5 + validator notification for quick reject.
5. **`aiProcessed`** one-shot guard + route-level cache (`{result, cached:true}`).
6. **Deterministic fallbacks** mean AI failures degrade gracefully, not fatally.
7. **Output schema validation** (Zod) rejects malformed model JSON.

## 10. Related scheduled jobs

Vercel crons (`vercel.json`) — not AI, but part of the pipeline:

- `/api/cron/sla-reminders` — daily 09:00 UTC, SLA reminders.
- `/api/cron/auto-close` — daily 10:00 UTC, auto-close `VERIFIED` past `feedbackGraceHours` (`src/lib/autoClose.ts`).

Both are bearer-guarded with `CRON_SECRET`.

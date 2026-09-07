# Gemini-Powered Feature Roadmap for Servox Φ (Revised)

Cross-checked against the live codebase. Only genuinely useful, zero-added-cost features. Items already implemented are marked `[x]`.

---

## What's already built

7 of 9 original AI flows are live in `src/lib/ai/`. All use the same Genkit pipeline (Gemini → Groq fallback → deterministic fallback) and cost nothing beyond the existing API key.

| # | Flow | File | Status |
|---|---|---|---|
| F1 | Auto-triage + safety flags + spam check | `triage.ts` | [x] Done — category, P1-5, reasons, safety flags, photo summary, spam detection |
| F2 | Duplicate detection | `duplicates.ts` | [x] Done — token-overlap (Jaccard) vs 50 recent open issues at same location |
| F3 | Routing suggestion | `routing.ts` | [x] Done — rule engine + Gemini reason rewrite; validator confirms |
| F4a | Requirements extraction | `assist.ts` | [x] Done — keyword table + AI refinement, ≤6 items |
| F4b | Closure report drafting | `assist.ts` | [x] Done — staff bullets → structured report, <120 words |
| F5 | Weekly governance insights | `insights.ts` | [x] Done — 7-day aggregates + AI executive summary + recommendations |
| F6 | Root cause analysis | `rootCause.ts` | [x] Done — 30-day unresolved issues → pattern analysis |
| F7 | Predictive at-risk locations | `predictive.ts` | [x] Done — 45-day location groups → 5-10 risk rows |

---

## Bugs to fix first

| Status | Issue | File | Impact |
|---|---|---|---|
| [ ] | **Photo analysis is a no-op.** `triageFlow` accepts `imageUrl` but never sends it to the model — only the text description is passed. `photoSummary` is always a hardcoded fallback string or whatever the text-only LLM guesses. | `triage.ts:204,230-240` | Uploaded photos are ignored by AI. Safety flags from images are never detected. |
| [ ] | **Safety flags are display-only.** `safetyFlags` from triage are shown in `AISuggestionCard` but the machine has zero awareness of them. A fire/gas/electric hazard detected by AI does not trigger any escalation or emergency path — it only indirectly causes priority promotion to P1-2 (via the fallback classifier), which then requires a validator to act. | `issueMachine.ts` (absent) | Critical safety hazards can sit in NEW status for days with no automatic escalation. |

---

## New features worth building

These are zero-added-cost extensions to the existing Genkit pipeline. No new APIs, no new services, no paid tiers.

### P0 — Close operational gaps

| Status | Feature | How it works | Why it matters |
|---|---|---|---|
| [ ] | **Emergency escalation for safety-flagged issues.** When `safetyFlags.length > 0` on a NEW issue, skip the normal VALIDATED path and auto-escalate to ESCALATED immediately (inside `applyTransition`). Append a timeline entry "Auto-escalated: safety hazard detected". Notify dept HOD + principal + admin. Show an emergency banner on the issue detail page with campus security contact info. | Machine change in `issueMachine.ts` + UI in issue detail. No AI call needed — acts on existing `aiSuggestion.safetyFlags`. | A water leak near electrical panels should not wait for a validator to notice. Safety-flagged issues must reach leadership within minutes, not days. |
| [ ] | **Fix photo analysis (send imageUrl to the model).** Modify the `ai.generate()` call in `triageFlow` to include the image as a `inlineData` part when `imageUrl` is provided. Update the prompt to instruct Gemini to describe what it sees, compare with the text description, and flag mismatches. Also detect: irrelevant images, screenshots, faces, documents, visible hazards. Store the result in `aiSuggestion.photoSummary` and `aiSuggestion.photoQuality` ("relevant"/"irrelevant"/"low_quality"/"mismatch"). | One code change in `triage.ts:230-240` (add `inlineData` part to the generate call). | Photos are already uploaded and stored. This makes AI actually look at them instead of ignoring them. Zero extra cost — same Gemini call, just with the image included. |

### P1 — Improve daily workflow

| Status | Feature | How it works | Why it matters |
|---|---|---|---|
| [ ] | **SLA breach explanation (new F8).** New Genkit flow `src/lib/ai/slaExplain.ts`. Given an issue's full timeline, SLA data, requirements, and current status, Gemini generates a 1-2 sentence explanation of why the issue is late (e.g., "Waiting for purchase approval on 2 materials", "Pending HOD approval since Tuesday"). Falls back to deterministic rules: if `requirements` has unresolved `needsApproval` → "Waiting for material approval"; if `status === PENDING` → "Blocked by staff report"; if `status === ASSIGNED` → "Not yet started by assigned technician". Displayed in `IssueCard` and `MaintenanceJobCard` as a one-liner when `breachedFlags` is set. | Route: `POST /api/ai/sla-explain`. Permission: validator/hod/principal/admin. No extra cost — same Gemini call pattern as F6/F7. | HODs currently see "3 issues breached SLA" with no context. Knowing *why* helps them unblock instead of just pressuring staff. |
| [ ] | **Technician briefing card.** Extend the existing F4a `extractRequirementsFlow` prompt to also generate: `probableCause`, `safetyPrecautions[]`, `toolsNeeded[]`, `skillType` (plumbing/electrical/general/etc.), `estimatedMinutes`. Store in a new `aiSuggestion.briefing` field. Display in `MaintenanceJobCard` above the requirements section when the issue is ASSIGNED or ONGOING. | Extend `assist.ts` prompt + Zod output schema. Add `briefing` to `AISuggestion` type in `types.ts`. Display in `MaintenanceJobCard.tsx`. | Currently, technicians get an assignment notification with just the issue title and link. A 30-second briefing before they open the full issue saves time and reduces callback questions. |

---

## Features deliberately excluded

These were in the original roadmap but are **not worth building** — they are either too complex, change working UX, or add cost without proportional value:

- **Smart form assistant** — changes the existing form UX that works. Campus staff know what to report; adaptive questioning slows them down.
- **Natural-language search** — complex NL→query translation that breaks the simple filter UI. Fragile, unpredictable, high maintenance.
- **Voice reporting** — needs MediaRecorder API + speech-to-text. Privacy concerns with campus audio. Not zero-cost (speech API charges per minute).
- **Multilingual reporting** — translation adds API cost per report and introduces accuracy risk for safety-critical content.
- **Knowledge assistant** — requires a curated knowledge base (SOPs, manuals) that doesn't exist. Building the knowledge base is the hard part, not the search.
- **Resolution verification assistant** — needs before/after photo comparison infrastructure and a new data model. Large scope.
- **Preventive-maintenance suggestions** — already partially covered by F5 (weekly insights) and F7 (predictive at-risk). Overlaps without adding new value.
- **Announcement generator** — announcements are manually authored and work fine. Auto-generation from events is a nice-to-have, not a need.
- **Accessible issue summaries** — large UI change for a niche use case.
- **Procurement assistant** — already covered by F4a (requirements extraction) + the purchase approval workflow.

---

## Recommended build order

1. **Fix photo analysis** (1-2 hours) — send imageUrl to the model, update prompt, add photoQuality field. Highest ROI: makes 2+ existing features actually work.
2. **Emergency escalation for safety flags** (2-3 hours) — machine change + UI banner. Closes the most serious operational gap.
3. **SLA breach explanation** (half day) — new flow, display in issue cards. Immediately useful for HODs/principals.
4. **Technician briefing card** (half day) — extend F4a prompt + display. Improves technician handoff quality.

Total: ~2 days of work for 4 genuinely useful improvements, all zero-added-cost, none touching the core state machine or data model in risky ways.

---

## Metrics

| Feature | How to measure |
|---|---|
| Photo analysis fix | % of new issues where `photoQuality !== "low_quality"`; validator override rate on AI photo assessments |
| Emergency escalation | Time from safety-flag detection to first human action; critical issues that were never escalated |
| SLA breach explanation | HOD/principal clicks on breach explanation (analytics); reduction in "why is this late?" questions |
| Technician briefing | Technician response time after assignment; closure rate without reassignment |

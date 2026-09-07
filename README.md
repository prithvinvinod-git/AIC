# Servox Φ (servox-phi)

Closed-loop campus maintenance complaint management. **Report → route → execute → verify → close**, with AI assistance and SLA enforcement — built for a multi-college campus (Engineering, Dental, Pharmaceutical, Medical, Nursing).

Reporter raises an issue → a department-scoped **validator** screens it → **HOD/Principal** confirms critical (P1–P2) severities → the right **maintenance** team executes → the **validator** verifies → the **reporter** rates → closed. Every step is audited on a timeline, SLAs are enforced per priority, and in-app notifications + (optional) emails keep everyone informed.

> **Core principle: "AI suggests, the state machine decides."** AI never moves a ticket, never approves, never skips a human. All AI output flows through the same route handlers and requires human confirmation.

- **Live app:** https://servox-phi.vercel.app

---

## Features

- **State-machine-powered lifecycle** — every status change flows through `applyTransition()` in a single Firestore transaction (RBAC + preconditions + timeline audit). No direct status writes.
- **AI assistance (7 Genkit flows)** — auto-triage + photo inspection, duplicate detection, routing suggestions, requirements extraction, closure-report drafting, weekly governance insights, root-cause analysis, predictive at-risk locations. LLM-first with deterministic keyword fallback so everything works with zero API keys.
- **SLA enforcement** — response/resolution deadlines per priority, paused while pending, breach flags via scheduled Cloud Functions.
- **Offline PWA** — app-shell caching + per-user IndexedDB read-through cache with background revalidation, offline write queue that syncs on reconnect.
- **Role-based portals** — reporter, validator, HOD, principal, maintenance, purchase, admin; role-scoped navigation with 404 guards.
- **Public tracking** — recipients without a session can follow an issue via its unguessable `trackingToken`.
- **Receipt PDF** — branded closed-issue receipt via pdfmake.
- **Notifications + email** — in-app feeds and best-effort Gmail SMTP (reported/approved/assigned/SLA reminders).

## Tech stack

Next.js 16.3.0 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4 · Firebase 12 (client) + firebase-admin 14 (server) · Firestore · Genkit 1.40 + @genkit-ai/googleai · genkitx-groq · Nodemailer · pdfmake · Recharts · zod 4 · date-fns.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables (`.env.local`)

Mirrors Vercel production. See `src/lib/firebaseAdmin.ts` / `src/lib/email` for how each is read.

```env
# Firebase client (Next.js app)
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_FIREBASE_VAPID_KEY

# Firebase Admin SDK (server)
FIREBASE_CLIENT_EMAIL
FIREBASE_PROJECT_ID
FIREBASE_PRIVATE_KEY

# AI (Genkit) — optional; unset → keyword fallback paths
GOOGLE_GENAI_API_KEY
GROQ_API_KEY
AI_MODEL

# Email (Nodemailer / Gmail SMTP) — optional
SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS
EMAIL_ENABLED
EMAIL_FROM / EMAIL_FROM_NAME
EMAIL_TEST_RECIPIENT   # when set, ALL mail goes to this inbox

APP_URL=https://servox-phi.vercel.app
CRON_SECRET            # guards Vercel cron endpoints
```

> The admin `config.ai.enabled` toggle is display-only — the real gate is whether a real Genkit API key is present (`aiEnabled()` in `src/lib/ai/genkit.ts`).

## Scripts

```bash
npm run dev        # dev server (Turbopack)
npm run build      # production build
npm run start      # serve the production build
npm run lint       # eslint .
```

Verify before pushing: `npx tsc --noEmit` and `npm run build` should be clean. The repo also ships firebase Cloud Functions under `functions/` (scheduled SLA scans, reminders, weekly digest in-app notifications) and smoke scripts under `scripts/`.

```bash
node scripts/smoke-lifecycle.mjs        # drives NEW → … → CLOSED over the live HTTP API
node scripts/cleanup-smoke.mjs          # removes smoke-test artifacts
```

## How it works

- **Auth:** Firebase Auth (email/password + Google popup), `browserLocalPersistence`. Roles/claims are read server-side from the ID token in every route handler via `requireAuth` / `requireAdmin`; the browser extracts claims from the token in `AuthProvider`.
- **Data flow:** `src/lib/clientApi.ts` (`api<T>()`) is the only client HTTP layer. Every short-lived GET goes through a per-user server TTL cache; every GET is cached in IndexedDB (`src/lib/offlineStore.ts` + `src/lib/jsonCache.ts`) with stale-while-revalidate. Every status change still flows through the issue-state machine (`src/lib/issueMachine.ts`).
- **Firestore:** denormalized display data (routing, reporter, SLA, counters) on the issue doc — no JOIN reads. Composite indexes live in `firestore.indexes.json`. Photos are base64 blobs in `imageBlobs` (no Cloud Storage), served via `GET /api/images/[id]` (unguessable UUID, immutable cache).
- **State machine:** authoritative transition table in `src/lib/issueMachine.ts` (`TRANSITION_RULES`). Cascades (auto-escalate P1–2, auto-route P3–5) happen inside the same transaction. `NEW → VALIDATED → ESCALATED → APPROVED → ASSIGNED → ONGOING → COMPLETED → VERIFIED → CLOSED`, plus REJECTED / PENDING / send-back branches.

## Offline mode (PWA)

Registered service worker (merged into `public/firebase-messaging-sw.js`) precaches the app shell; the client keeps a per-user IndexedDB cache filled by `api()`.

- While **online**, responses are served from the cache when fresh, revalidated in the background, and prefetched for the role's common feeds when stale.
- While **offline**, cached data is shown with an offline banner; mutations are queued and replayed in order on reconnect (server remains authoritative). Account switch/sign-out clears the store.

## Project structure

```
src/app/            routes + API handlers (App Router)
src/components/     UI (shell, screens, auth, AI cards, notifications, offline)
src/lib/            server + client logic (machine, AI flows, email, schemas, cache, constants)
src/lib/ai/         the 7 Genkit flows
src/hooks/          useIssues, useIssue, useNotifications, useOffline*, usePrefetch
src/app/api/        all server endpoints (Firestore writes happen ONLY here)
functions/          scheduled Cloud Functions
scripts/            smoke tests + helpers
docs/               spec/status/AI-flow/UX logs + agent rules
public/             static assets + firebase-messaging-sw.js (offline shell + push)
```

## Documentation

- `docs/app_status.md` — current implementation reference (v4.0); **read before implementing anything**
- `docs/ai-flow.md` — AI flows, models, fallbacks
- `docs/ui-ux.md` — UX conventions and screen guide
- `docs/agent.md` — non-negotiable coding rules
- `CONTEXT.md` — living deep-context summary of how the app works
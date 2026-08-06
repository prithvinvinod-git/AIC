# AGENTS.md — Project Conventions

## Stack
- Next.js App Router, TypeScript, Tailwind CSS
- Firebase: Auth (email/password + Google), Firestore, Cloud Functions (all against the real project; service account in `.env.local`)
- State management: server components + React Query for mutations; `onSnapshot` for real-time boards

## Non-negotiable rules
1. All data writes go through Next.js Route Handlers → `src/lib/issueMachine.ts`.
2. Clients NEVER write `status` directly — only `POST /api/issues/[id]/status` with a valid transition.
3. Role checks happen in route handlers (Admin SDK verifies ID token + custom claims); Firestore rules are defense-in-depth only.
4. Denormalize display data (`location`, `categoryName`, `reporter.name`) onto the issue document — no JOIN reads.
5. Every status change writes a `timeline` entry. Every mutation uses a Firestore transaction where a precondition must hold.
6. Validate all inputs with Zod. Never return `passwordHash` or raw ID tokens.
7. Reference `docs/SPEC.md` for the state machine, permission matrix, SLA table, and data model before implementing any feature.

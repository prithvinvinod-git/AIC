# servox-phi — Feature Backlog

Working list of the 10 tasks agreed in session. Status updated as each task completes; after each completion we review for enhancements before moving on.

- [x] **1. Public tracking link for email recipients** — `trackingToken` per issue; email CTAs point to a public `/track/[token]` page (status rail, SLA countdown, timeline) so non-logged-in recipients aren't stuck at the login wall. Pattern mirrors the unguessable `/api/images/[id]`. *(Done — `src/app/api/track/[token]/route.ts` + `src/app/track/[token]/page.tsx`, reported/approved email CTAs now use it, `scripts/backfill-tracking-tokens.mjs` ran, verified live.)*
- [ ] **2. Wire the auto-close job** — scheduled scan (Vercel cron like `/api/cron/sla-reminders`) turning `VERIFIED` past `feedbackGraceHours` → `CLOSED (isAuto)`. Machine + config + UI already support it.
- [ ] **3. Enforce the response SLA** — flag `sla.breachedFlags.response` and remind/email for `ASSIGNED` jobs past `responseDeadline` (breach function currently only flags resolution).
- [x] **4. Honor the `notifyEmail` toggle in email recipients** — `getRecipientEmails` currently ignores the `/settings` opt-out persisted on the user doc. *(Done — `src/lib/email/recipients.ts` now excludes `notifyEmail === false` users from role + team/staff emails; unset defaults to ON; settings toggle displays the default honestly; deployed.)*
- [ ] **5. Real weekly governance email** — reuse `weeklyInsights` AI flow + SMTP + dark template; send narrative + stats table to HOD/principal every Monday.
- [x] **6. Client-side image compression** — resize/compress photos in the browser (canvas ~1200px, q≈0.7) before upload to cut Firestore base64 blob cost (~10–20x). *(Done — `src/app/(app)/new/page.tsx` downscales to 1200px, re-encodes JPEG q0.7 with white fill for transparent PNGs; verified as the only client upload path.)*
- [ ] **7. "Where's my complaint?" status bot** — Genkit flow + endpoint answering status/SLA/next-step from Firestore.
- [ ] **8. CSV export** — server route streaming Issue History / analytics as CSV.
- [ ] **9. FCM push notifications** — biggest lift; service-worker + token management.
- [x] **10. Closed-issue receipt PDF** — reporter gets a "Download receipt (PDF)" button on `CLOSED` issues; professional receipt with all details in an orange Claude-style light theme. *(Done — `src/lib/receiptPdf.ts` + button on issue detail page, deployed to https://servox-phi.vercel.app.)*
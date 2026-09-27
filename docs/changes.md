# Changes — 27 Sep 2026

Multi-college identity, onboarding, password management and error handling.
Commits: `8e26422`, `47c8f24`, `a8206f7`.

## Fixed

- Reporter onboarding could not be completed. The confirm handler never dismissed the dialog and re-read a cached auth token, so the college it had just saved was never seen and the popup came back on every visit.
- The college claim stayed stale after an admin edited a user's college or department. Claims were only rewritten on role or category changes.
- A reporter could file an issue into another college's board by putting their own college in the request body.
- A brand new reporter could be created with no college at all — the admin form required one, the API did not.
- The admin form silently pre-selected the first college instead of making a real choice.
- Google sign-ups were quietly given a "Computer Science" department they never picked.
- After email verification the app kept using the old token, so users landed on unexplained permission errors.
- The app showed a raw `TypeError: Failed to fetch` when offline.
- The push-notification setup could fail silently in the background and throw unhandled errors.

## Added

- College and department are now both required before a reporter can continue. No Skip, no close button, no Escape, and Confirm stays disabled until both are chosen.
- A change-password card in Settings → Security, with a re-authentication step first.
- A "Set a password" option for people who signed in with Google and have no password yet.
- A single `NetworkError` type so a dropped connection shows one clear message instead of leaking a browser error.
- Validation helpers for colleges and departments, reused by the profile, sign-up and admin endpoints.

## Changed

- College and department values are now checked against the real campus lists instead of being accepted as free text.
- The admin user editor no longer offers a "clear college" option — every account belongs to exactly one college.
- Re-homing a department-scoped user now saves the college and department together so the pair can never disagree.
- Firebase upgraded from 12.17.1 to 12.19.0.
- Documentation updated: `context.md`, `docs/verification-log.md`, `docs/todo.md`.

## Verification

- Type check clean, lint clean (2 pre-existing warnings in an unrelated file), production build succeeds.
- 15/15 runtime checks pass on the new validation rules, run against the real code.
- All touched pages return 200; every touched endpoint still returns 401 without a sign-in, so no data was written.

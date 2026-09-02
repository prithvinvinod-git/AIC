// Backfill a `college` on every non-admin user whose `users/{uid}` doc and/or
// custom claims are missing it, so the new college-scoped lists/analytics/emails
// isolate data per college instead of leaking across campuses.
//
// Every non-admin role (reporter, validator, hod, principal, maintenance_head,
// category_head, maintenance, purchase) must carry a college. Admins are
// exempt (they see the whole campus).
//
// Colleges are Engineering | Dental | Pharmaceutical | Medical | Nursing.
// A user's college is inferred by this precedence:
//   1. an explicit override:  node backfill-college.mjs --college URL-ENCODED
//   2. the user's existing doc/claim college (just normalizes missing claims)
//   3. --default (default "Engineering") when no override and none is set
//
// Reads .env.local for the Admin SDK (mirrors provision-heads.mjs).
// Usage:
//   node scripts/backfill-college.mjs
//   node scripts/backfill-college.mjs --default Nursing
//   node scripts/backfill-college.mjs --college Engineering
//
// Use --dry-run to list users that would change without writing.
import { readFileSync } from "node:fs";
import { cert, initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const args = process.argv.slice(2);
const readFlag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined;
};
const OVERRIDE = readFlag("--college");
const DEFAULT_COLLEGE = readFlag("--default") || "Engineering";
const VALID = ["Engineering", "Dental", "Pharmaceutical", "Medical", "Nursing"];
const DRY_RUN = args.includes("--dry-run");

if (OVERRIDE && !VALID.includes(OVERRIDE)) {
  console.error(`--college must be one of: ${VALID.join(", ")}`);
  process.exit(1);
}

const envRaw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = {};
for (const line of envRaw.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}

const projectId = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || env.FIREBASE_PROJECT_ID;

const app =
  getApps()[0] ||
  initializeApp({
    credential: cert({
      projectId,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
const adminAuth = getAuth(app);
const db = getFirestore(app);

const EXEMPT_ROLES = new Set(["admin"]);
const KNOWN_ROLES = new Set([
  "reporter",
  "validator",
  "hod",
  "principal",
  "maintenance_head",
  "category_head",
  "maintenance",
  "purchase",
]);

async function main() {
  const snap = await db.collection("users").get();
  let changed = 0;
  let skipped = 0;

  for (const doc of snap.docs) {
    const u = doc.data() || {};
    const role = u.role;
    if (EXEMPT_ROLES.has(role)) continue; // admins are campus-wide, no college
    if (!role || !KNOWN_ROLES.has(role)) {
      console.warn(`skip  unknown role "${role}" for ${doc.id}`);
      skipped++;
      continue;
    }

    const college = OVERRIDE || u.college || DEFAULT_COLLEGE;

    // Read current claims to see whether they already carry the college.
    let claimsCollege;
    try {
      const rec = await adminAuth.getUser(doc.id);
      claimsCollege = rec.customClaims?.college;
    } catch (e) {
      console.error(`ERR  could not read auth user ${doc.id}: ${e.message}`);
      skipped++;
      continue;
    }

    const docNeeds = u.college !== college;
    const claimsNeed = claimsCollege !== college;

    if (!docNeeds && !claimsNeed) {
      skipped++;
      continue;
    }

    console.log(
      `--   ${DRY_RUN ? "[dry] " : ""}${String(role).padEnd(16)} ${(u.email || doc.id).padEnd(34)} doc=${u.college || "—"} claims=${claimsCollege || "—"} -> ${college}`
    );
    changed++;

    if (DRY_RUN) continue;

    if (docNeeds) {
      await db.collection("users").doc(doc.id).update({ college });
    }
    if (claimsNeed) {
      await adminAuth.setCustomUserClaims(doc.id, {
        ...(await adminAuth.getUser(doc.id)).customClaims,
        college,
      });
    }
  }

  console.log(`\nDone. ${DRY_RUN ? "Would update" : "Updated"}: ${changed} user(s); skipped: ${skipped}.`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

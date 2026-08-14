// Backfill routing.maintenanceHeadUid on issues in the dispatch chain that
// were routed before head resolution was fixed (department -> college -> any).
// Usage: node scripts/backfill-heads.mjs
import { readFileSync } from "node:fs";
import { cert, initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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
const db = getFirestore(app);

const CHAIN = ["ROUTED", "PENDING_ASSIGN", "ASSIGNED", "ONGOING", "PENDING"];

async function resolveHead(issue) {
  const base = () =>
    db
      .collection("users")
      .where("role", "==", "maintenance_head")
      .where("isActive", "==", true);
  const attempts = [];
  if (issue.department) attempts.push(["department", issue.department]);
  if (issue.college) attempts.push(["college", issue.college]);
  for (const [field, value] of attempts) {
    const snap = await base().where(field, "==", value).limit(1).get();
    if (!snap.empty) return snap.docs[0].id;
  }
  const any = await base().limit(1).get();
  return any.empty ? null : any.docs[0].id;
}

const snap = await db
  .collection("issues")
  .where("status", "in", CHAIN)
  .get();
console.log(`Found ${snap.size} issues in the dispatch chain.`);

let updated = 0;
let unresolved = 0;
for (const doc of snap.docs) {
  const issue = doc.data();
  if (issue.routing?.maintenanceHeadUid) continue;
  const headId = await resolveHead(issue);
  if (!headId) {
    unresolved++;
    console.log(`SKIP  ${issue.issueNo || doc.id}  (no active maintenance head found)`);
    continue;
  }
  await db.collection("issues").doc(doc.id).update({
    "routing.maintenanceHeadUid": headId,
    updatedAt: new Date().toISOString(),
  });
  updated++;
  console.log(`OK    ${issue.issueNo || doc.id}  -> head ${headId}  (${issue.department} / ${issue.college})`);
}
console.log(`\nUpdated ${updated} issue(s). Unresolved: ${unresolved}.`);

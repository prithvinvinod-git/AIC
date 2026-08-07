// One-off backfill: assign an unguessable `trackingToken` to every existing
// issue that doesn't have one, so legacy issues also get public tracking links.
// Usage: node scripts/backfill-tracking-tokens.mjs
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { cert, initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const envRaw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = {};
for (const line of envRaw.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}

const projectId = env.FIREBASE_PROJECT_ID || env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
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

const snap = await db.collection("issues").select("trackingToken").get();

let updated = 0;
let batch = db.batch();
let count = 0;
const commits = [];
for (const doc of snap.docs) {
  if (doc.data().trackingToken) continue;
  batch.update(doc.ref, { trackingToken: randomUUID() });
  updated++;
  count++;
  if (count === 400) {
    commits.push(batch.commit());
    batch = db.batch();
    count = 0;
  }
}
if (count > 0) commits.push(batch.commit());
await Promise.all(commits);

console.log(`Backfilled trackingToken on ${updated} issue(s).`);

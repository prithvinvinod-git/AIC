// One-off: delete any leftover "[SMOKE]" issues (from failed smoke runs).
import { readFileSync } from "node:fs";
import { cert, initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const envRaw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = {};
for (const line of envRaw.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}

const app =
  getApps()[0] ||
  initializeApp({
    credential: cert({
      projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
const db = getFirestore(app);

const snap = await db.collection("issues").where("title", "==", "[SMOKE] Automated lifecycle test").get();
console.log("found", snap.size, "smoke issue(s)");
for (const d of snap.docs) {
  for (const sub of ["timeline", "comments", "attachments"]) {
    const subSnap = await db.collection(`issues/${d.id}/${sub}`).get();
    for (const s of subSnap.docs) await s.ref.delete();
  }
  await d.ref.delete();
  console.log("deleted", d.id, d.data().issueNo);
}
process.exit(0);

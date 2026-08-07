// One-off data-hygiene fix: give ISS-2026-0001 a proper routing (IT team).
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

const TEAM_ID = "K79JRW6LmeFigacv7ksE";

const issueSnap = await db.collection("issues").where("issueNo", "==", "ISS-2026-0001").get();
if (issueSnap.empty) throw new Error("ISS-2026-0001 not found");
const issueDoc = issueSnap.docs[0];
const issue = issueDoc.data();
console.log("issue:", issueDoc.id, "status:", issue.status);
console.log("categoryId:", issue.categoryId);
console.log("current routing:", JSON.stringify(issue.routing));

const teamSnap = await db.doc(`teams/${TEAM_ID}`).get();
const team = teamSnap.data();
console.log("\nIT team members:", JSON.stringify(team?.members));

const names = {};
const memberUids = (team?.members || []);
for (const uid of memberUids) {
  const u = await db.doc(`users/${uid}`).get();
  names[uid] = u.exists ? u.data()?.name || "" : "";
}
const staff = memberUids.map((uid) => ({ uid, name: names[uid] }));
console.log("resolved staff:", JSON.stringify(staff));

const routing = {
  categoryId: "caGTep51vKtU3SEUX0X6",
  categoryName: issue.routing?.categoryName || "IT",
  teamId: TEAM_ID,
  staff,
};

await issueDoc.ref.update({ routing });
console.log("\nupdated routing:", JSON.stringify(routing));

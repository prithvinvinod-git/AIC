// Delete leftover smoke-test artifacts from the live Firestore + Auth.
// Matches by explicit `smoke: true` tag (preferred) and the legacy
// "[SMOKE]" title so issues from older failed runs are still caught.
import { readFileSync } from "node:fs";
import { cert, initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const envRaw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = {};
for (const line of envRaw.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}

const projectId = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || env.FIREBASE_PROJECT_ID;

// Safety: never delete data from the live project unless explicitly overridden.
const PROD_PROJECT = "campus-maintenance-2820d";
if (projectId === PROD_PROJECT && process.env.SMOKE_ALLOW_PROD !== "1") {
  console.error(
    `Refusing to run cleanup against production project "${projectId}".\n` +
      "Set SMOKE_ALLOW_PROD=1 to override."
  );
  process.exit(1);
}

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
const adminAuth = getAuth(app);

// Union of tagged issues and legacy-title issues (dedup by doc id).
const byId = new Map();
const tagged = await db.collection("issues").where("smoke", "==", true).get();
const titled = await db
  .collection("issues")
  .where("title", "==", "[SMOKE] Automated lifecycle test")
  .get();
for (const d of [...tagged.docs, ...titled.docs]) byId.set(d.id, d);

console.log("found", byId.size, "smoke issue(s)");
for (const [id, d] of byId) {
  for (const sub of ["timeline", "comments", "attachments"]) {
    const subSnap = await db.collection(`issues/${id}/${sub}`).get();
    for (const s of subSnap.docs) await s.ref.delete();
  }
  await d.ref.delete();
  console.log("deleted", id, d.data().issueNo);
}

// Smoke reporter accounts (tagged before creation, cleaned either way).
const reporterSnap = await db.collection("users").where("smoke", "==", true).get();
for (const u of reporterSnap.docs) {
  try {
    await adminAuth.deleteUser(u.id);
  } catch {}
  await u.ref.delete();
  console.log("deleted smoke account", u.id);
}

process.exit(0);
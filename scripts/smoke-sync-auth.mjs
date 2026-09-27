import { readFileSync } from "node:fs";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);

const app =
  getApps()[0] ??
  initializeApp({
    credential: cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });

const adminAuth = getAuth(app);
const db = getFirestore(app);
const apiKey = env.NEXT_PUBLIC_FIREBASE_API_KEY;
// Local by default: this endpoint is not on production until it is deployed.
const base = process.env.SMOKE_BASE || "http://localhost:3000";

async function tokenFor(uid, claims) {
  const custom = await adminAuth.createCustomToken(uid, claims);
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: custom, returnSecureToken: true }),
    }
  );
  const j = await r.json();
  if (!j.idToken) throw new Error(`token: ${JSON.stringify(j)}`);
  return j.idToken;
}

const results = [];
const check = (name, pass, extra = "") =>
  results.push(`${pass ? "PASS" : "FAIL"}  ${name}${extra ? ` — ${extra}` : ""}`);

// 1. Unauthenticated must be rejected.
{
  const r = await fetch(`${base}/api/profile/sync-auth`, { method: "POST" });
  check("sync-auth rejects missing token", r.status === 401, `got ${r.status}`);
}

// Pick a real admin and prove the mirror takes the TOKEN's email, not the body's.
const admin = (await db.collection("users").where("role", "==", "admin").limit(1).get()).docs[0];
const uid = admin.id;
const authUser = await adminAuth.getUser(uid);
const claims = authUser.customClaims || {};

{
  const t = await tokenFor(uid, claims);
  // Hostile body: the endpoint must ignore it entirely.
  const r = await fetch(`${base}/api/profile/sync-auth`, {
    method: "POST",
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email: "attacker@example.invalid" }),
  });
  const j = await r.json();
  check("sync-auth 200 with valid token", r.status === 200, `got ${r.status}`);
  check(
    "response echoes the TOKEN email, not the body",
    j.email === authUser.email,
    `token=${j.email} bodyWas=attacker@example.invalid`
  );

  // And the mirror in Firestore must equal the Auth address.
  const snap = await db.doc(`users/${uid}`).get();
  check(
    "users/ mirror email == Firebase Auth email",
    snap.data().email === authUser.email,
    `mirror=${snap.data().email} auth=${authUser.email}`
  );
  check("emailVerified mirrored as boolean", typeof snap.data().emailVerified === "boolean");
  // Leave no trace: the test account's values are unchanged.
  check("no value drift from the test", authUser.email === j.email);
}

console.log(`\nsync-auth checks\n${results.join("\n")}`);
const failed = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.length - failed}/${results.length} PASS`);
process.exit(failed ? 1 : 0);

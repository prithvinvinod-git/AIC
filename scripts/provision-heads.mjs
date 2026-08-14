// Provision demo accounts for the new head roles (maintenance_head,
// category_head) against the live cloud project, mirroring the pattern used
// by the app's provisioning flow: Firebase Auth user + custom claims + a
// `users/{uid}` Firestore doc.
// Usage: node scripts/provision-heads.mjs  (reads .env.local for Admin SDK)
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

const DEMOS = [
  {
    email: "mhead@gmail.com",
    password: "123456",
    name: "Maintenance Head",
    role: "maintenance_head",
    department: "Engineering",
  },
  {
    email: "cathead@gmail.com",
    password: "123456",
    name: "Category Head",
    role: "category_head",
    department: "Engineering",
  },
];

for (const demo of DEMOS) {
  const { email, password, name, role, department } = demo;
  try {
    let uid;
    try {
      const existing = await adminAuth.getUserByEmail(email);
      uid = existing.uid;
      console.log(`found existing user ${email} (${uid}) — updating`);
    } catch {
      const created = await adminAuth.createUser({ email, password, displayName: name });
      uid = created.uid;
      console.log(`created user ${email} (${uid})`);
    }
    await adminAuth.setCustomUserClaims(uid, { role, name, department });
    await db.collection("users").doc(uid).set(
      {
        name,
        email,
        role,
        department,
        college: "Engineering",
        isActive: true,
        notifyEmail: true,
        createdAt: new Date().toISOString(),
      },
      { merge: true }
    );
    console.log(`ok  ${role.padEnd(16)} ${email}  (${uid})  claims + users doc written`);
  } catch (e) {
    console.error(`ERR ${email}:`, e.message);
    process.exitCode = 1;
  }
}

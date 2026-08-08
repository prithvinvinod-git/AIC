// Smoke test: announcement publishing over the real HTTP API against the live
// cloud project. Exercises:
//   - HOD publishes an announcement to the `reporter` role
//   - the target reporter receives an `announcement`-type notification
//   - a reporter is forbidden from publishing / editing / deleting (403)
//   - PATCH edits the announcement and only notifies newly added recipients
//   - DELETE removes the announcement via the API
//   - mark-all-read round-trip through POST /api/notifications
// Usage: node scripts/smoke-announcements.mjs  (requires `npm run dev` on :3000)
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

const apiKey = env.NEXT_PUBLIC_FIREBASE_API_KEY;
const projectId = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || env.FIREBASE_PROJECT_ID;
const BASE = process.env.SMOKE_BASE || "http://localhost:3000";

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

async function getIdToken(uid, claims) {
  const custom = await adminAuth.createCustomToken(uid, claims);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: custom, returnSecureToken: true }),
    }
  );
  const body = await res.json();
  if (!body.idToken) throw new Error("Token exchange failed: " + JSON.stringify(body));
  return body.idToken;
}

async function api(token, method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json };
}

const report = (label, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? "  " + extra : ""}`);
  if (!ok) process.exitCode = 1;
};

let reporterUid = null;
let maintenanceUid = null;
let announcementId = null;
let hod = null;

try {
  // Real HOD so the author role gate passes with a genuine uid.
  hod = await adminAuth.getUserByEmail("hod@gmail.com");

  // Throwaway reporter (real uid + users doc) so audience resolution finds it.
  const reporterEmail = `smoke.ann.${Date.now()}@campuscare.local`;
  const created = await adminAuth.createUser({
    email: reporterEmail,
    password: "TestPass123!",
    displayName: "Smoke Reporter",
  });
  reporterUid = created.uid;
  await adminAuth.setCustomUserClaims(reporterUid, { role: "reporter", name: "Smoke Reporter" });
  await db.collection("users").doc(reporterUid).set({
    name: "Smoke Reporter",
    email: reporterEmail,
    role: "reporter",
    department: "Engineering",
    isActive: true,
    createdAt: new Date().toISOString(),
  });

  // Throwaway maintenance user so the PATCH audience-delta is observable.
  const maintenanceEmail = `smoke.maint.${Date.now()}@campuscare.local`;
  const maint = await adminAuth.createUser({
    email: maintenanceEmail,
    password: "TestPass123!",
    displayName: "Smoke Maintainer",
  });
  maintenanceUid = maint.uid;
  await adminAuth.setCustomUserClaims(maintenanceUid, { role: "maintenance", name: "Smoke Maintainer" });
  await db.collection("users").doc(maintenanceUid).set({
    name: "Smoke Maintainer",
    email: maintenanceEmail,
    role: "maintenance",
    department: "Engineering",
    isActive: true,
    createdAt: new Date().toISOString(),
  });

  const reporterToken = await getIdToken(reporterUid, {
    role: "reporter", name: "Smoke Reporter", department: "Engineering",
  });
  const hodToken = await getIdToken(hod.uid, {
    role: "hod", name: "Smoke HOD", department: "Engineering",
  });

  // 1. HOD publishes an announcement to the reporter role.
  const pub = await api(hodToken, "POST", "/api/announcements", {
    title: "[SMOKE] Campus maintenance schedule",
    body: "Smoke test broadcast — generators will be serviced Sunday 6 AM.",
    audience: { kind: "roles", roles: ["reporter"] },
  });
  report("HOD publish -> 201", pub.status === 201, `(status ${pub.status})`);
  announcementId = pub.json?.announcement?.id || null;
  if (!announcementId) throw new Error("No announcement id returned");

  // 2. The reporter received an announcement-type notification.
  const notifSnap = await db
    .collection(`notifications/${reporterUid}/items`)
    .orderBy("at", "desc")
    .limit(50)
    .get();
  const notifDoc = notifSnap.docs.find((d) => d.data().type === "announcement");
  report(
    "reporter got announcement notification",
    Boolean(notifDoc),
    notifDoc ? `(title "${notifDoc.data().title}")` : ""
  );
  const notifId = notifDoc ? notifDoc.id : null;
  const reporterAnnCount = notifSnap.docs.filter((d) => d.data().type === "announcement").length;

  // 3. A reporter is forbidden from publishing.
  const denied = await api(reporterToken, "POST", "/api/announcements", {
    title: "[SMOKE] Should fail",
    body: "Reporters must not broadcast.",
    audience: { kind: "all" },
  });
  report("reporter publish -> 403", denied.status === 403, `(status ${denied.status})`);

  // 4. GET returns the announcement for the authoring UI.
  const list = await api(hodToken, "GET", "/api/announcements");
  report(
    "GET /api/announcements lists it",
    list.status === 200 && list.json?.announcements?.some((a) => a.id === announcementId),
    `(status ${list.status})`
  );

  // 5. HOD edits the announcement — audience grows to include maintenance.
  const patch = await api(hodToken, "PATCH", `/api/announcements/${announcementId}`, {
    title: "[SMOKE] Campus maintenance schedule (updated)",
    audience: { kind: "roles", roles: ["reporter", "maintenance"] },
  });
  report("HOD patch -> 200", patch.status === 200, `(status ${patch.status})`);
  report(
    "patch reflected in response",
    patch.json?.announcement?.title === "[SMOKE] Campus maintenance schedule (updated)",
    `(title "${patch.json?.announcement?.title}")`
  );

  // 6. Only the newly added maintenance recipient is notified (audience delta).
  const maintNotif = await db
    .collection(`notifications/${maintenanceUid}/items`)
    .orderBy("at", "desc")
    .limit(20)
    .get();
  report(
    "newly added recipient got notification",
    maintNotif.docs.some((d) => d.data().type === "announcement")
  );
  const afterPatchSnap = await db
    .collection(`notifications/${reporterUid}/items`)
    .orderBy("at", "desc")
    .limit(50)
    .get();
  const reporterAnnAfter = afterPatchSnap.docs.filter((d) => d.data().type === "announcement").length;
  report(
    "existing recipient not re-notified",
    reporterAnnAfter === reporterAnnCount,
    `(announcement notifs ${reporterAnnCount} -> ${reporterAnnAfter})`
  );

  // 7. A reporter is forbidden from editing or deleting.
  const patchDenied = await api(reporterToken, "PATCH", `/api/announcements/${announcementId}`, {
    title: "[SMOKE] Should fail",
  });
  report("reporter patch -> 403", patchDenied.status === 403, `(status ${patchDenied.status})`);
  const delDenied = await api(reporterToken, "DELETE", `/api/announcements/${announcementId}`);
  report("reporter delete -> 403", delDenied.status === 403, `(status ${delDenied.status})`);

  // 8. HOD deletes via the API; the list no longer contains it.
  const del = await api(hodToken, "DELETE", `/api/announcements/${announcementId}`);
  report("HOD delete -> 200", del.status === 200, `(status ${del.status})`);
  const afterDel = await api(hodToken, "GET", "/api/announcements");
  report(
    "list no longer contains it",
    afterDel.status === 200 && !afterDel.json?.announcements?.some((a) => a.id === announcementId),
    `(status ${afterDel.status})`
  );

  // 9. Mark-all-read round-trip.
  if (notifId) {
    const mark = await api(reporterToken, "POST", "/api/notifications", {});
    const after = await db.doc(`notifications/${reporterUid}/items/${notifId}`).get();
    report(
      "mark-all-read round trip",
      mark.status === 200 && after.exists && after.data()?.isRead === true,
      `(status ${mark.status})`
    );
  }

  console.log("\nSmoke announcement id:", announcementId, "reporter:", reporterEmail);
} catch (e) {
  console.error("ERROR:", e.message);
  process.exitCode = 1;
} finally {
  for (const uid of [reporterUid, maintenanceUid]) {
    if (uid) {
      try {
        const snap = await db.collection(`notifications/${uid}/items`).get();
        for (const d of snap.docs) await d.ref.delete();
      } catch {}
      try { await adminAuth.deleteUser(uid); } catch {}
    }
  }
  // On a clean pass, remove the smoke announcement.
  if (announcementId && process.exitCode !== 1) {
    try {
      await db.doc(`announcements/${announcementId}`).delete();
      console.log("cleaned up smoke announcement", announcementId);
    } catch {}
  }
}

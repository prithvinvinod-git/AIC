// Smoke test: full lifecycle over the real HTTP API against the live cloud
// project. Minted ID tokens (via admin SDK) drive each role through:
//   NEW -> VALIDATED(auto-ESCALATED P2) -> APPROVED -> ROUTED -> PENDING_ASSIGN
//      -> ASSIGNED -> ONGOING -> COMPLETED -> INSPECTED(auto-VERIFIED) -> CLOSED
// Usage: node scripts/smoke-lifecycle.mjs  (requires `npm run dev` on :3000)
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

// Safety: never touch the live project unless explicitly overridden. The
// smoke run creates real-looking issues that land in dashboards/analytics.
const PROD_PROJECT = "campus-maintenance-2820d";
if (projectId === PROD_PROJECT && process.env.SMOKE_ALLOW_PROD !== "1") {
  console.error(
    `Refusing to run smoke tests against production project "${projectId}".\n` +
      "This creates and auto-deletes real-looking data in the live Firestore.\n" +
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
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}: ${text}`);
  }
  return json;
}

const report = (label, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? "  " + extra : ""}`);
  if (!ok) process.exitCode = 1;
};

let reporterToken, validatorToken, hodToken, maintToken, catHeadToken;
let reporterUid;
let issueId = null;

try {
  // Resolve real users by email so the roles carry genuine uids.
  const validator = await adminAuth.getUserByEmail("validator@gmail.com");
  const hod = await adminAuth.getUserByEmail("hod@gmail.com");
  const maint = await adminAuth.getUserByEmail("mainten@gmail.com");
  const catHead = await adminAuth.getUserByEmail("cathead@gmail.com");

  // Throwaway reporter (real uid) so the create route's role gate passes.
  const reporterEmail = `smoke.${Date.now()}@campuscare.local`;
  const created = await adminAuth.createUser({
    email: reporterEmail,
    password: "TestPass123!",
    displayName: "Smoke Tester",
  });
  reporterUid = created.uid;
  await adminAuth.setCustomUserClaims(reporterUid, { role: "reporter", name: "Smoke Tester" });
  await db.collection("users").doc(reporterUid).set({
    name: "Smoke Tester",
    email: reporterEmail,
    role: "reporter",
    department: "Engineering",
    isActive: true,
    smoke: true,
    createdAt: new Date().toISOString(),
  });

  reporterToken = await getIdToken(reporterUid, {
    role: "reporter", name: "Smoke Tester", department: "Engineering",
  });
  validatorToken = await getIdToken(validator.uid, {
    role: "validator", name: "Smoke Validator", department: "Engineering",
  });
  hodToken = await getIdToken(hod.uid, {
    role: "hod", name: "Smoke HOD", department: "Engineering",
  });
  maintToken = await getIdToken(maint.uid, {
    role: "maintenance", name: "Smoke Maint", department: "Engineering",
  });
  catHeadToken = await getIdToken(catHead.uid, {
    role: "category_head", name: "Smoke CatHead", department: "Engineering",
  });

  // 1. Reporter creates issue (P2 electrical so it auto-escalates).
  const catSnap = await db
    .collection("categories").where("name", "==", "Electrical").limit(1).get();
  if (catSnap.empty) throw new Error("No 'Electrical' category in live DB");
  const cat = catSnap.docs[0];

  const createdResp = await api(reporterToken, "POST", "/api/issues", {
    title: "[SMOKE] Automated lifecycle test",
    description: "Smoke test issue exercising the full status lifecycle end to end.",
    categoryId: cat.id,
    department: "Engineering",
    location: { name: "Block A", building: "Main", floor: "1" },
    images: [],
  });
  issueId = createdResp.issue.id;
  // Tag directly (admin SDK) so leftover cleanup is exact, not title-based.
  await db.doc(`issues/${issueId}`).update({ smoke: true });
  report("create issue -> NEW", createdResp.issue.status === "NEW", `(${createdResp.issue.issueNo})`);

  // 2. Validator validates P2 -> auto ESCALATED.
  const val = await api(validatorToken, "POST", `/api/issues/${issueId}/validate`, {
    priority: 2,
    note: "Valid smoke complaint.",
  });
  report("validate P2 -> ESCALATED", val.issue.status === "ESCALATED", `(got ${val.issue.status})`);

  // 3. HOD approves.
  const appr = await api(hodToken, "POST", `/api/issues/${issueId}/approve`, {
    note: "Confirmed.",
  });
  report("approve -> APPROVED", appr.issue.status === "APPROVED", `(got ${appr.issue.status})`);

  // 4. Validator routes to maintenance head -> ROUTED.
  const fwd = await api(validatorToken, "POST", `/api/issues/${issueId}/forward`, {
    to: "ROUTED",
    categoryId: cat.id,
    note: "Routed for smoke test.",
  });
  report("route -> ROUTED", fwd.issue.status === "ROUTED", `(got ${fwd.issue.status})`);

  // 5. Maintenance head forwards to category head -> PENDING_ASSIGN.
  const fwd2 = await api(hodToken, "POST", `/api/issues/${issueId}/forward`, {
    to: "PENDING_ASSIGN",
    categoryId: cat.id,
    note: "Forwarded to category.",
  });
  report("forward -> PENDING_ASSIGN", fwd2.issue.status === "PENDING_ASSIGN", `(got ${fwd2.issue.status})`);

  // 6. Category head assigns team -> ASSIGNED.
  const teamSnap = await db
    .collection("teams").where("categoryId", "==", cat.id).where("isActive", "==", true).limit(1).get();
  if (teamSnap.empty) throw new Error("No active Electrical team in live DB");
  const team = teamSnap.docs[0];
  const ass = await api(catHeadToken, "POST", `/api/issues/${issueId}/assign`, {
    teamId: team.id,
    staff: [maint.uid],
    note: "Assigned for smoke test.",
  });
  report("assign -> ASSIGNED", ass.issue.status === "ASSIGNED", `(team ${team.id})`);

  // 7. Maintenance starts -> ONGOING.
  const ong = await api(maintToken, "POST", `/api/issues/${issueId}/status`, {
    to: "ONGOING",
    note: "Work started.",
  });
  report("start -> ONGOING", ong.issue.status === "ONGOING", `(got ${ong.issue.status})`);

  // 8. Maintenance completes -> COMPLETED.
  const comp = await api(maintToken, "POST", `/api/issues/${issueId}/complete`, {
    note: "Replaced faulty switch, verified all outputs.",
  });
  report("complete -> COMPLETED", comp.issue.status === "COMPLETED", `(got ${comp.issue.status})`);

  // 9. Category head inspects -> INSPECTED (auto-cascades to VERIFIED).
  const insp = await api(catHeadToken, "POST", `/api/issues/${issueId}/inspect`, {
    verdict: "Work looks good on site.",
  });
  report("inspect -> VERIFIED (auto)", insp.issue.status === "VERIFIED", `(got ${insp.issue.status})`);

  // 10. Reporter rates -> CLOSED.
  const clo = await api(reporterToken, "POST", `/api/issues/${issueId}/feedback`, {
    rating: 5,
    comment: "Fixed, thanks.",
  });
  report("feedback -> CLOSED", clo.issue.status === "CLOSED", `(got ${clo.issue.status})`);

  // 11. Sanity: timeline captured the whole chain in order.
  const detail = await api(reporterToken, "GET", `/api/issues/${issueId}`);
  const events = ((detail.timeline || [])).map((t) => `${t.from}->${t.to}`);
  const chain = ["->NEW", "NEW->VALIDATED", "VALIDATED->ESCALATED", "ESCALATED->APPROVED",
    "APPROVED->ROUTED", "ROUTED->PENDING_ASSIGN", "PENDING_ASSIGN->ASSIGNED",
    "ASSIGNED->ONGOING", "ONGOING->COMPLETED", "COMPLETED->INSPECTED", "INSPECTED->VERIFIED",
    "VERIFIED->CLOSED"];
  const missing = chain.filter((c) => !events.includes(c));
  const orderOk =
    missing.length === 0 &&
    chain.every((c, idx) => idx === 0 || events.indexOf(c) > events.indexOf(chain[idx - 1]));
  report(
    "timeline has full chain in order",
    orderOk,
    !orderOk
      ? missing.length
        ? `missing ${missing.join(",")}`
        : `out of order (${events.join(", ")})`
      : `(${events.join(", ")})`
  );

  console.log("\nSmoke issue id:", issueId, "reporter:", reporterEmail);
} catch (e) {
  console.error("ERROR:", e.message);
  process.exitCode = 1;
} finally {
  if (reporterUid) {
    try { await adminAuth.deleteUser(reporterUid); } catch {}
  }
  // On a clean pass, remove the smoke issue so the live DB stays tidy.
  if (issueId && process.exitCode !== 1) {
    try {
      for (const sub of ["timeline", "comments", "attachments"]) {
        const snap = await db.collection(`issues/${issueId}/${sub}`).get();
        for (const d of snap.docs) await d.ref.delete();
      }
      await db.doc(`issues/${issueId}`).delete();
      console.log("cleaned up smoke issue", issueId);
    } catch {}
  }
}



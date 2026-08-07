import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { JWT } from "google-auth-library";

const envRaw = readFileSync("D:/Downloads/cloneserver/AIC/.env.local", "utf8");
const env = {};
for (const line of envRaw.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const currentPem = (env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
const clientEmail = env.FIREBASE_CLIENT_EMAIL;
const projectId = env.FIREBASE_PROJECT_ID || "campus-maintenance-2820d";

let leaked = null;
try {
  const out = execSync(
    "git show 9d8cb03:campus-maintenance-2820d-firebase-adminsdk-fbsvc-54128f301d.json",
    { cwd: "D:/Downloads/cloneserver/AIC", encoding: "utf8" }
  );
  leaked = JSON.parse(out);
} catch (e) {
  console.log("LEAKED_KEY_READ_ERROR:", e.message);
}

const sha = (s) =>
  createHash("sha256").update(s.replace(/\r\n/g, "\n").trim() + "\n").digest("hex");
const sameKey = leaked ? sha(leaked.private_key) === sha(currentPem) : null;

console.log("CLIENT_EMAIL:", clientEmail);
console.log("LEAKED_KEY_ID:", leaked?.private_key_id);
console.log("ENV_KEY_IS_LEAKED_KEY:", sameKey);
console.log("ENV_PEM_PREFIX:", currentPem.slice(0, 40));

const scopes = ["https://www.googleapis.com/auth/iam", "https://www.googleapis.com/auth/cloud-platform"];
const auth = new JWT({ email: clientEmail, key: currentPem, scopes });

const resource = `projects/${projectId}/serviceAccounts/${encodeURIComponent(clientEmail)}/keys`;
try {
  const token = await auth.getAccessToken();
  const res = await fetch(
    `https://iam.googleapis.com/v1/${resource}?keyTypes=USER_MANAGED`,
    { headers: { Authorization: `Bearer ${token.token}` } }
  );
  const body = await res.json();
  console.log("LIST_KEYS_STATUS:", res.status);
  if (res.ok) {
    for (const k of body.keys || []) {
      console.log("KEY:", k.name, "disabled:", k.disabled);
    }
  } else {
    console.log("LIST_KEYS_ERROR:", JSON.stringify(body.error || body));
  }
} catch (e) {
  console.log("AUTH_ERROR:", e.message);
}

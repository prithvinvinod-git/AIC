"use client";

import { getClientAuth } from "@/lib/firebase";
import { api } from "@/lib/clientApi";
import { capitalizeName } from "@/lib/format";

/**
 * Claim an already-signed-in Auth user (e.g. a fresh Google sign-in) as a
 * reporter: writes the Firestore user doc + custom claims if no role exists.
 * Also syncs the Google email into Firestore if the user is already provisioned
 * but the doc is missing the email.
 */
export async function ensureReporterProvisioned(opts?: {
  college?: string;
  department?: string;
}): Promise<void> {
  const user = getClientAuth().currentUser;
  if (!user) return;
  const email = user.email || "";
  const token = await user.getIdTokenResult(true);
  if (token.claims.role) {
    // Already provisioned — just make sure Firestore has the email.
    if (email) {
      await api("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ email }),
      }).catch(() => {});
    }
    return;
  }
  await api("/api/auth/self-provision", {
    method: "POST",
    body: JSON.stringify({
      name: capitalizeName(user.displayName || user.email || user.phoneNumber || "User"),
      email,
      college: opts?.college || "",
      department: opts?.department || "Computer Science",
    }),
  });
}

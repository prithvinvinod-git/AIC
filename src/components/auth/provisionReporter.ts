"use client";

import { getClientAuth } from "@/lib/firebase";
import { api } from "@/lib/clientApi";
import { capitalizeName } from "@/lib/format";

/**
 * Claim an already-signed-in Auth user (e.g. a fresh Google sign-in) as a
 * reporter: writes the Firestore user doc + custom claims if no role exists.
 */
export async function ensureReporterProvisioned(opts?: {
  college?: string;
  department?: string;
}): Promise<void> {
  const user = getClientAuth().currentUser;
  if (!user) return;
  const token = await user.getIdTokenResult(true);
  if (token.claims.role) return;
  await api("/api/auth/provision", {
    method: "POST",
    body: JSON.stringify({
      uid: user.uid,
      name: capitalizeName(user.displayName || user.email || user.phoneNumber || "User"),
      email: user.email || "",
      role: "reporter",
      college: opts?.college || "",
      department: opts?.department || "Computer Science",
    }),
  });
}

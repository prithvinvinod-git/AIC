import "server-only";

import { adminDb } from "../firebaseAdmin";
import type { Role } from "../types";

const db = adminDb();

function clean(emails: string[]): string[] {
  return [
    ...new Set(
      emails
        .map((e) => e?.trim().toLowerCase())
        .filter((e): e is string => Boolean(e) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    ),
  ];
}

/** Active users holding one of the roles, optionally scoped to a department. */
export async function getRecipientEmails(roles: Role[], department?: string): Promise<string[]> {
  try {
    const snap = await db
      .collection("users")
      .where("isActive", "==", true)
      .get();
    const emails = snap.docs
      .filter((d) => {
        const u = d.data();
        if (!roles.includes(u.role as Role)) return false;
        if (department && u.department && u.department !== department) return false;
        return true;
      })
      .map((d) => d.data().email as string);
    return clean(emails);
  } catch (e) {
    console.error("getRecipientEmails failed:", e);
    return [];
  }
}

/** Emails for a maintenance team (its members) plus explicitly assigned staff. */
export async function getTeamEmails(teamId: string, staffUids: string[] = []): Promise<string[]> {
  try {
    const uids = new Set<string>(staffUids.filter(Boolean));
    const teamSnap = await db.doc(`teams/${teamId}`).get();
    if (teamSnap.exists) {
      for (const m of (teamSnap.data()?.members as string[]) || []) {
        if (m) uids.add(m);
      }
    }

    const emails: string[] = [];
    for (const uid of uids) {
      const u = await db.doc(`users/${uid}`).get();
      if (u.exists) emails.push((u.data()?.email as string) || "");
    }
    return clean(emails);
  } catch (e) {
    console.error("getTeamEmails failed:", e);
    return [];
  }
}

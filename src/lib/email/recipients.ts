import "server-only";

import { adminDb } from "../firebaseAdmin";
import type { Role } from "../types";

const db = adminDb();

const TEST_RECIPIENT = process.env.EMAIL_TEST_RECIPIENT?.trim().toLowerCase() || "";

const ROLE_PRIORITY: Partial<Record<Role, number>> = {
  principal: 0,
  hod: 1,
  validator: 2,
  maintenance: 3,
};

function byPriority(a: Role, b: Role): number {
  return (ROLE_PRIORITY[a] ?? 9) - (ROLE_PRIORITY[b] ?? 9);
}

function clean(emails: string[]): string[] {
  return [
    ...new Set(
      emails
        .map((e) => e?.trim().toLowerCase())
        .filter((e): e is string => Boolean(e) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    ),
  ];
}

/** Active users holding one of the roles, optionally scoped to a department
 *  and/or a college. While EMAIL_TEST_RECIPIENT is set, every role's mail
 *  routes to that single inbox (ordered principal/HOD > validator >
 *  maintenance). */
export async function getRecipientEmails(
  roles: Role[],
  department?: string,
  college?: string
): Promise<string[]> {
  if (TEST_RECIPIENT) return [...roles].sort(byPriority).length ? [TEST_RECIPIENT] : [];
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
        // Skip only when a college is requested and the user has a (different)
        // college — lets matching or unset accounts receive it.
        if (college && u.college && u.college !== college) return false;
        if (u.notifyEmail === false) return false;
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
  if (TEST_RECIPIENT) return [TEST_RECIPIENT];
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
      if (u.exists) {
        const uData = u.data() as { email?: string; notifyEmail?: boolean } | undefined;
        if (uData?.notifyEmail === false) continue;
        emails.push(uData?.email || "");
      }
    }
    return clean(emails);
  } catch (e) {
    console.error("getTeamEmails failed:", e);
    return [];
  }
}

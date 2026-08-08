import "server-only";

import { adminDb } from "./firebaseAdmin";
import { notifyMany } from "./notifications";
import type { Announcement, AnnouncementAudience, Role } from "./types";

/** Roles allowed to publish campus-wide announcements. */
export const ANNOUNCER_ROLES: Role[] = ["admin", "principal", "hod"];

export interface AnnouncementInput {
  title: string;
  body: string;
  audience: AnnouncementAudience;
}

export interface AnnouncementAuthor {
  uid: string;
  name: string;
  role: Role;
}

/**
 * Write an announcement doc, resolve its audience from the active `users`
 * collection, and push an `announcement`-type notification into each target
 * user's feed. Notification fan-out is best-effort and never throws.
 */
export async function publishAnnouncement(
  input: AnnouncementInput,
  author: AnnouncementAuthor
): Promise<Announcement> {
  const doc: Omit<Announcement, "id"> = {
    title: input.title,
    body: input.body,
    audience: input.audience,
    author,
    createdAt: new Date().toISOString(),
  };

  const ref = await adminDb().collection("announcements").add(doc);

  const snap = await adminDb().collection("users").where("isActive", "==", true).get();
  let uids: string[];
  if (input.audience.kind === "all") {
    uids = snap.docs.map((d) => d.id);
  } else {
    const roles = input.audience.roles;
    uids = snap.docs
      .filter((d) => roles.includes(d.data().role as Role))
      .map((d) => d.id);
  }

  await notifyMany(uids, {
    type: "announcement",
    title: input.title,
    body: input.body,
    link: "/notifications",
  });

  return { id: ref.id, ...doc };
}

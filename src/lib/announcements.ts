import "server-only";

import { adminDb } from "./firebaseAdmin";
import { notifyMany } from "./notifications";
import type { Announcement, AnnouncementAudience, Role } from "./types";

/** Roles allowed to publish and manage campus-wide announcements. */
export const ANNOUNCER_ROLES: Role[] = ["admin", "principal", "hod"];

export interface AnnouncementInput {
  title: string;
  body: string;
  /** `/api/images/{id}` URLs; up to 2, first is the card thumbnail. */
  images?: string[];
  audience: AnnouncementAudience;
}

export interface AnnouncementAuthor {
  uid: string;
  name: string;
  role: Role;
}

export function imageIdFromUrl(url: string): string | null {
  const m = url.match(/^\/api\/images\/([a-f0-9-]+)$/);
  return m ? m[1] : null;
}

async function audienceUids(audience: AnnouncementAudience): Promise<string[]> {
  const snap = await adminDb().collection("users").where("isActive", "==", true).get();
  if (audience.kind === "all") {
    return snap.docs.map((d) => d.id);
  }
  const roles = audience.roles;
  return snap.docs
    .filter((d) => roles.includes(d.data().role as Role))
    .map((d) => d.id);
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
    images: input.images ?? [],
    audience: input.audience,
    author,
    createdAt: new Date().toISOString(),
  };

  const ref = await adminDb().collection("announcements").add(doc);

  const uids = await audienceUids(input.audience);
  await notifyMany(uids, {
    type: "announcement",
    title: input.title,
    body: input.body,
    link: "/notifications",
  });

  return { id: ref.id, ...doc };
}

/**
 * Edit an existing announcement. On audience changes, only the newly added
 * recipients (delta) are notified — existing recipients aren't re-sent.
 */
export async function updateAnnouncement(
  id: string,
  patch: { title?: string; body?: string; images?: string[]; audience?: AnnouncementAudience }
): Promise<Announcement> {
  const ref = adminDb().collection("announcements").doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    const e = new Error("Announcement not found.") as Error & { statusCode: number };
    e.statusCode = 404;
    throw e;
  }
  const existing = snap.data() as Omit<Announcement, "id">;

  const next: Omit<Announcement, "id"> = {
    title: patch.title ?? existing.title,
    body: patch.body ?? existing.body,
    images: patch.images ?? existing.images ?? [],
    audience: patch.audience ?? existing.audience,
    author: existing.author,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  await ref.set(next);

  if (patch.audience) {
    const [before, after] = await Promise.all([
      audienceUids(existing.audience),
      audienceUids(patch.audience),
    ]);
    const beforeSet = new Set(before);
    const delta = after.filter((uid) => !beforeSet.has(uid));
    await notifyMany(delta, {
      type: "announcement",
      title: next.title,
      body: next.body,
      link: "/notifications",
    });
  }

  return { id, ...next };
}

/**
 * Remove an announcement and its uploaded image blobs. Already-fanned-out
 * notifications are left untouched (no reverse index to retract them).
 */
export async function deleteAnnouncement(id: string): Promise<void> {
  const ref = adminDb().collection("announcements").doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    const e = new Error("Announcement not found.") as Error & { statusCode: number };
    e.statusCode = 404;
    throw e;
  }

  const data = snap.data() as Partial<Announcement>;
  const blobIds = (data.images ?? [])
    .map(imageIdFromUrl)
    .filter((x): x is string => Boolean(x));

  await Promise.allSettled([
    ref.delete(),
    ...blobIds.map((bid) => adminDb().collection("imageBlobs").doc(bid).delete()),
  ]);
}

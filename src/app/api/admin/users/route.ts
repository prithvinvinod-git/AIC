import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { requireUserManager } from "@/lib/auth";
import { json, handleError } from "@/lib/api";
import { serverCached, invalidateServerCache } from "@/lib/serverCache";

const db = adminDb();

/** Normalise a createdAt value (ISO string, epoch ms, or Firestore Timestamp) to an ISO string. */
function toIso(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return new Date(v).toISOString();
  if (typeof v === "object") {
    const o = v as { toDate?: () => Date; seconds?: number; _seconds?: number };
    if (typeof o.toDate === "function") return o.toDate().toISOString();
    const secs = o.seconds ?? o._seconds;
    if (typeof secs === "number") return new Date(secs * 1000).toISOString();
  }
  return "";
}

/** Millisecond value for sorting — tolerant of missing/odd createdAt values. */
function createdTimeMs(v: unknown): number {
  const iso = toIso(v);
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

/** GET /api/admin/users — list all users (admin or principal).
 *  Cached briefly per role-filter; invalidated by create/update via
 *  /api/auth/provision and by DELETE below. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireUserManager(req);
    const role = req.nextUrl.searchParams.get("role");
    const key = `api:admin:users:${role || "all"}`;
    const users = await serverCached(key, 15_000, async () => {
      let snap;
      if (role) {
        snap = await db.collection("users").where("role", "==", role).get();
      } else {
        // Sort in JS, not Firestore: legacy docs may store createdAt as a
        // Timestamp rather than an ISO string, which breaks orderBy at runtime.
        snap = await db.collection("users").get();
      }
      return snap.docs
        .map((d) => {
          const data = d.data();
          const { createdAt, ...rest } = data as Record<string, unknown>;
          return { uid: d.id, ...rest, createdAt: toIso(createdAt) };
        })
        .sort((a, b) => createdTimeMs(a.createdAt) - createdTimeMs(b.createdAt));
    });
    return json({ users });
  } catch (e) {
    return handleError(e);
  }
}

/** DELETE /api/admin/users?uid=… — permanently remove a user (admin or principal).
 *  Removes the Auth account, the users/ doc and their notification feed. */
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const admin = await requireUserManager(req);
    const uid = req.nextUrl.searchParams.get("uid");
    if (!uid) return json({ error: "uid is required." }, 400);
    if (uid === admin.uid) return json({ error: "You cannot delete your own account." }, 400);

    const doc = await db.doc(`users/${uid}`).get();
    if (!doc.exists) return json({ error: "User not found." }, 404);

    await Promise.all([
      adminAuth().deleteUser(uid),
      db.doc(`users/${uid}`).delete(),
      db
        .collection(`notifications/${uid}/items`)
        .get()
        .then((snap) =>
          Promise.all(snap.docs.map((d) => d.ref.delete().catch(() => undefined)))
        ),
    ]);

    invalidateServerCache("api:admin:users");
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

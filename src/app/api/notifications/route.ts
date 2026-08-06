import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/auth";
import { json, handleError } from "@/lib/api";

const db = adminDb();

/** GET /api/notifications — current user's notifications, newest first. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth(req);
    const snap = await db
      .collection(`notifications/${user.uid}/items`)
      .orderBy("at", "desc")
      .limit(50)
      .get();
    const notifications = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const unread = notifications.filter((n) => !(n as { isRead?: boolean }).isRead).length;
    return json({ notifications, unread });
  } catch (e) {
    return handleError(e);
  }
}

/** POST /api/notifications/read — mark one ({id}) or all as read. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth(req);
    const body = (await req.json().catch(() => ({}))) as { id?: string };
    const now = new Date().toISOString();

    if (body.id) {
      await db.doc(`notifications/${user.uid}/items/${body.id}`).update({ isRead: true });
    } else {
      const snap = await db
        .collection(`notifications/${user.uid}/items`)
        .where("isRead", "==", false)
        .get();
      const writes = snap.docs.map((d) =>
        db.doc(`notifications/${user.uid}/items/${d.id}`).update({ isRead: true })
      );
      await Promise.all(writes);
    }
    return json({ ok: true, at: now });
  } catch (e) {
    return handleError(e);
  }
}

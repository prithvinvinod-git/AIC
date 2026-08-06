import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/auth";
import { json, handleError } from "@/lib/api";

const db = adminDb();

/** GET /api/issues/[id] — issue + timeline + comments + attachments. */
export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/api/issues/[id]">
): Promise<NextResponse> {
  try {
    await requireAuth(req);
    const { id } = await ctx.params;

    const snap = await db.doc(`issues/${id}`).get();
    if (!snap.exists) return json({ error: "Issue not found." }, 404);

    const [timelineSnap, commentsSnap, attachmentsSnap] = await Promise.all([
      db.collection(`issues/${id}/timeline`).orderBy("at", "asc").get(),
      db.collection(`issues/${id}/comments`).orderBy("at", "asc").limit(100).get(),
      db.collection(`issues/${id}/attachments`).orderBy("at", "asc").get(),
    ]);

    const issue = snap.data() || {};
    if (!Array.isArray(issue.requirements)) issue.requirements = [];

    return json({
      issue: { id, ...issue },
      timeline: timelineSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      comments: commentsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      attachments: attachmentsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    });
  } catch (e) {
    return handleError(e);
  }
}

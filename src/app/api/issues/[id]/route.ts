import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAuth, type AuthUser } from "@/lib/auth";
import { json, handleError } from "@/lib/api";
import type { Issue } from "@/lib/types";

const db = adminDb();

/** Detail-view scope, mirroring machine + list scoping: admins and reporters
 *  (outside the workflow) are unrestricted; college-scoped staff are confined
 *  to their own college; validator/hod additionally to their department. */
function canReadIssue(user: AuthUser, issue: Issue): boolean {
  if (user.role === "admin" || user.role === "reporter") return true;
  if (user.college && issue.college && user.college !== issue.college) return false;
  if (
    (user.role === "validator" || user.role === "hod") &&
    user.department &&
    issue.department &&
    user.department !== issue.department
  )
    return false;
  return true;
}

/** GET /api/issues/[id] — issue + timeline + comments + attachments. */
export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/api/issues/[id]">
): Promise<NextResponse> {
  try {
    const user = await requireAuth(req);
    const { id } = await ctx.params;

    const snap = await db.doc(`issues/${id}`).get();
    if (!snap.exists) return json({ error: "Issue not found." }, 404);

    const issue = snap.data() as Issue;
    if (!canReadIssue(user, issue)) {
      return json({ error: "Not allowed." }, 403);
    }

    const [timelineSnap, commentsSnap, attachmentsSnap] = await Promise.all([
      db.collection(`issues/${id}/timeline`).orderBy("at", "asc").get(),
      db.collection(`issues/${id}/comments`).orderBy("at", "asc").limit(100).get(),
      db.collection(`issues/${id}/attachments`).orderBy("at", "asc").get(),
    ]);

    if (!Array.isArray(issue.requirements)) issue.requirements = [];
    delete issue.trackingToken;

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

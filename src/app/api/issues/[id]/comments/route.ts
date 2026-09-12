import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/auth";
import { json, parseBody, handleError } from "@/lib/api";
import { isRateLimited } from "@/lib/rateLimit";
import { commentSchema } from "@/lib/schemas";

/** POST /api/issues/[id]/comments — any authenticated user comments. */
export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/issues/[id]/comments">
): Promise<NextResponse> {
  try {
    const { id } = await ctx.params;
    const user = await requireAuth(req);
    if (isRateLimited(`comments:${user.uid}`, { limit: 40, windowMs: 60_000 })) {
      return NextResponse.json(
        { error: "Too many comments. Please slow down and try again." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }
    const body = await parseBody(req, commentSchema);

    const db = adminDb();
    const ref = db.collection(`issues/${id}/comments`).doc();
    const now = new Date().toISOString();

    await db.runTransaction(async (tx) => {
      const parent = await tx.get(db.doc(`issues/${id}`));
      if (!parent.exists) throw Object.assign(new Error("Issue not found."), { statusCode: 404 });
      tx.set(ref, {
        author: { uid: user.uid, name: user.name, role: user.role },
        body: body.body,
        at: now,
      });
      tx.update(db.doc(`issues/${id}`), {
        "counters.commentCount": FieldValue.increment(1),
        updatedAt: now,
      });
    });

    return json({ comment: { id: ref.id, body: body.body, at: now } }, 201);
  } catch (e) {
    return handleError(e);
  }
}

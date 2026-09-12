import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/auth";
import { json, handleError } from "@/lib/api";
import { isRateLimited } from "@/lib/rateLimit";

interface Ctx {
  params: Promise<{ id: string; commentId: string }>;
}

/** POST /api/issues/[id]/comments/[commentId]/like — toggle a like for the current user. */
export async function POST(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  try {
    const { id, commentId } = await ctx.params;
    const user = await requireAuth(req);
    if (isRateLimited(`comment-like:${user.uid}`, { limit: 60, windowMs: 60_000 })) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down and try again." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }
    const db = adminDb();

    const ref = db.doc(`issues/${id}/comments/${commentId}`);

    let liked: boolean = false;
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw Object.assign(new Error("Comment not found."), { statusCode: 404 });
      const data = snap.data() ?? {};
      const uids: string[] = Array.isArray(data.likedByUids) ? data.likedByUids : [];
      liked = uids.includes(user.uid);
      tx.update(ref, {
        likedByUids: liked
          ? FieldValue.arrayRemove(user.uid)
          : FieldValue.arrayUnion(user.uid),
        likes: FieldValue.increment(liked ? -1 : 1),
      });
    });

    return json({ liked: !liked });
  } catch (e) {
    return handleError(e);
  }
}

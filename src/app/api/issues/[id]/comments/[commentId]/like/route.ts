import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/auth";
import { json, handleError } from "@/lib/api";

interface Ctx {
  params: Promise<{ id: string; commentId: string }>;
}

/** POST /api/issues/[id]/comments/[commentId]/like — toggle a like for the current user. */
export async function POST(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  try {
    const { id, commentId } = await ctx.params;
    const user = await requireAuth(req);
    const db = adminDb();

    const ref = db.doc(`issues/${id}/comments/${commentId}`);
    const snap = await ref.get();
    if (!snap.exists) return json({ error: "Comment not found." }, 404);

    const data = snap.data() || {};
    const uids: string[] = Array.isArray(data.likedByUids) ? data.likedByUids : [];
    const liked = uids.includes(user.uid);
    const likes = Math.max(0, (typeof data.likes === "number" ? data.likes : 0) + (liked ? -1 : 1));

    await ref.update({
      likedByUids: liked ? FieldValue.arrayRemove(user.uid) : FieldValue.arrayUnion(user.uid),
      likes: FieldValue.increment(liked ? -1 : 1),
    });

    return json({ liked: !liked, likes });
  } catch (e) {
    return handleError(e);
  }
}

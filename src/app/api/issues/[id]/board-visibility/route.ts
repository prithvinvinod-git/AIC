import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/auth";
import { json, parseBody, handleError } from "@/lib/api";

const BOARD_ROLES = ["admin", "principal"];

const schema = z.object({
  hidden: z.boolean(),
});

/** POST /api/issues/[id]/board-visibility — admin/principal curate the shared
 *  cross-user board: `{ hidden: true }` excludes an issue from every role's
 *  board; `{ hidden: false }` restores it. The field is stored presence-based
 *  (deleted when shown) so legacy issues need no migration. */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const user = await requireAuth(req);
    if (!BOARD_ROLES.includes(user.role)) {
      return json({ error: "Only admins and the Principal can curate the issue board." }, 403);
    }

    const { id } = await ctx.params;
    const { hidden } = await parseBody(req, schema);

    const db = adminDb();
    const ref = db.doc(`issues/${id}`);
    const snap = await ref.get();
    if (!snap.exists) return json({ error: "Issue not found." }, 404);

    const now = new Date().toISOString();
    if (hidden) {
      await ref.update({ boardHidden: true, updatedAt: now });
    } else {
      await ref.update({ boardHidden: FieldValue.delete(), updatedAt: now });
    }

    return json({ ok: true, boardHidden: hidden });
  } catch (e) {
    return handleError(e);
  }
}

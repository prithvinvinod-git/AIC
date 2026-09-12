import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/auth";
import { json, parseBody, handleError } from "@/lib/api";
import type { Issue } from "@/lib/types";

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
    await db.runTransaction(async (tx) => {
      const txSnap = await tx.get(ref);
      if (!txSnap.exists) throw Object.assign(new Error("Issue not found."), { statusCode: 404 });
      const data = txSnap.data() as Issue;
      if (hidden) {
        tx.update(ref, {
          boardHidden: true,
          updatedAt: now,
          "counters.timelineCount": FieldValue.increment(1),
        });
      } else {
        tx.update(ref, {
          boardHidden: FieldValue.delete(),
          updatedAt: now,
          "counters.timelineCount": FieldValue.increment(1),
        });
      }
      tx.set(db.collection(`issues/${id}/timeline`).doc(), {
        from: "",
        to: (data.status as string) ?? "",
        by: { uid: user.uid, name: user.name, role: user.role },
        note: hidden
          ? `Hidden from the shared issue board by ${user.name}`
          : `Restored to the shared issue board by ${user.name}`,
        at: now,
        isAuto: false,
      });
    });

    return json({ ok: true, boardHidden: hidden });
  } catch (e) {
    return handleError(e);
  }
}

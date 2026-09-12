import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/auth";
import { json, parseBody, handleError } from "@/lib/api";
import { invalidateServerCache } from "@/lib/serverCache";
import type { Issue } from "@/lib/types";

const TRACKING_ROLES = ["admin", "principal"];

const schema = z.object({
  revoked: z.boolean(),
});

/** POST /api/issues/[id]/tracking-visibility — admin/principal revoke (or
 *  restore) the public `/track/[token]` link for an issue. Revoked links
 *  return 410 Gone immediately; restored links work again. The field is
 *  presence-based (deleted when restored) so legacy issues need no migration.
 *  Every change is audited on the issue timeline. */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const user = await requireAuth(req);
    if (!TRACKING_ROLES.includes(user.role)) {
      return json({ error: "Only admins and the Principal can manage tracking links." }, 403);
    }

    const { id } = await ctx.params;
    const { revoked } = await parseBody(req, schema);

    const db = adminDb();
    const ref = db.doc(`issues/${id}`);
    const snap = await ref.get();
    if (!snap.exists) return json({ error: "Issue not found." }, 404);

    const now = new Date().toISOString();

    const issue = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw Object.assign(new Error("Issue not found."), { statusCode: 404 });
      const data = snap.data() as Issue;
      if (revoked) {
        tx.update(ref, {
          trackingRevoked: true,
          updatedAt: now,
          "counters.timelineCount": FieldValue.increment(1),
        });
      } else {
        tx.update(ref, {
          trackingRevoked: FieldValue.delete(),
          updatedAt: now,
          "counters.timelineCount": FieldValue.increment(1),
        });
      }
      tx.set(db.collection(`issues/${id}/timeline`).doc(), {
        from: "",
        to: (data.status as string) ?? "",
        by: { uid: user.uid, name: user.name, role: user.role },
        note: revoked
          ? `Public tracking link revoked by ${user.name}`
          : `Public tracking link restored by ${user.name}`,
        at: now,
        isAuto: false,
      });
      return data;
    });

    // Drop any cached copy of the tracking payload so the change is visible.
    if (issue.trackingToken) invalidateServerCache(`api:track:${issue.trackingToken}`);

    return json({ ok: true, revoked });
  } catch (e) {
    return handleError(e);
  }
}
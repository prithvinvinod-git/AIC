import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/auth";
import { json, parseBody, handleError } from "@/lib/api";
import { requirementSchema } from "@/lib/schemas";
import { notifyRole } from "@/lib/notifications";
import type { Issue } from "@/lib/types";

const ALLOWED_ROLES = ["maintenance", "admin"];

/** POST /api/issues/[id]/requirements — log a requirements entry. */
export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/issues/[id]/requirements">
): Promise<NextResponse> {
  try {
    const { id } = await ctx.params;
    const user = await requireAuth(req);
    if (!ALLOWED_ROLES.includes(user.role)) {
      return json({ error: "Only maintenance staff can log requirements." }, 403);
    }
    const body = await parseBody(req, requirementSchema);

    const db = adminDb();
    const ref = db.doc(`issues/${id}`);

    let issueCollege: string | undefined;

    const now = new Date().toISOString();
    const requirement: Record<string, unknown> = {
      id: db.collection("ids").doc().id,
      ...body,
      approvalStatus: body.needsApproval ? "pending" : undefined,
      addedBy: { uid: user.uid, name: user.name },
      at: now,
    };
    if (!body.needsApproval) delete requirement.approvalStatus;

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error("issue-missing");
      const data = snap.data() as Issue;
      if (data.status === "CLOSED") throw new Error("issue-closed");
      issueCollege = data.college;
      await tx.update(ref, {
        requirements: [...(data.requirements || []), requirement],
        pendingPurchaseCount:
          body.needsApproval ? (data.pendingPurchaseCount || 0) + 1 : data.pendingPurchaseCount || 0,
        updatedAt: now,
      });
    });

    if (body.needsApproval) {
      void notifyRole(
        ["purchase"],
        {
          type: "purchase",
          title: "Purchase approval needed",
          body: `Approval requested for ${requirement.item} ×${requirement.qty}.`,
          link: `/issues/${id}`,
        },
        issueCollege
      );
    }

    return json({ requirement }, 201);
  } catch (e) {
    if (e instanceof Error && e.message === "issue-missing") {
      return json({ error: "Issue not found." }, 404);
    }
    if (e instanceof Error && e.message === "issue-closed") {
      return json({ error: "This issue is closed — requirements can no longer be added." }, 400);
    }
    return handleError(e);
  }
}

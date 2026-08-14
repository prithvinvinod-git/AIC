import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebaseAdmin";
import { runTransition } from "@/lib/transition";
import { json, parseBody, handleError } from "@/lib/api";

const schema = z.object({
  categoryId: z.string().optional(),
  to: z.enum(["ROUTED", "PENDING_ASSIGN"]).optional().default("PENDING_ASSIGN"),
  note: z.string().optional(),
});

/**
 * POST /api/issues/[id]/forward — Routes an issue toward the maintenance chain.
 *
 * `to: "ROUTED"`        — validator/approver sends an APPROVED issue to the
 *                         department maintenance head for dispatch.
 * `to: "PENDING_ASSIGN"` — maintenance head forwards a ROUTED issue to a
 *                         category's head for worker assignment (also used to
 *                         bounce a PENDING/ASSIGNED issue back to the category
 *                         head for reassignment).
 *
 * Category/head uids are resolved here and passed into the machine so the
 * transition writes the denormalized routing fields transactionally.
 */
export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/issues/[id]/forward">
): Promise<NextResponse> {
  try {
    const { id } = await ctx.params;
    const body = await parseBody(req, schema);
    const preParsed: Record<string, unknown> = { ...body };

    const issueSnap = await adminDb().doc(`issues/${id}`).get();
    if (!issueSnap.exists) return json({ error: "Issue not found." }, 404);
    const issue = issueSnap.data()!;

    if (body.to === "ROUTED") {
      const heads = await adminDb()
        .collection("users")
        .where("role", "==", "maintenance_head")
        .where("department", "==", issue.department)
        .where("isActive", "==", true)
        .limit(1)
        .get();
      if (!heads.empty) preParsed.maintenanceHeadUid = heads.docs[0].id;
    } else {
      const categoryId = body.categoryId || issue.routing?.categoryId;
      if (!categoryId) return json({ error: "Choose a category to forward this issue." }, 400);
      preParsed.categoryId = categoryId;
      const catSnap = await adminDb().doc(`categories/${categoryId}`).get();
      preParsed.categoryName = catSnap.exists ? (catSnap.data()?.name as string) : categoryId;
      if (catSnap.exists && catSnap.data()?.headUid) {
        preParsed.categoryHeadUid = catSnap.data()?.headUid as string;
      }
    }

    return runTransition(req, id, schema, body.to, preParsed);
  } catch (e) {
    return handleError(e);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebaseAdmin";
import { runTransition } from "@/lib/transition";
import { parseBody, handleError } from "@/lib/api";

const schema = z.object({
  priority: z.number().int().min(1).max(5),
  note: z.string().optional(),
});

/**
 * POST /api/issues/[id]/validate — Validator marks valid + sets priority.
 * For P3–5 the machine auto-routes to the department maintenance head; we
 * resolve that head up-front and pass their uid so the ROUTED cascade can
 * denormalize it and notify the right person.
 */
export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/issues/[id]/validate">
): Promise<NextResponse> {
  try {
    const { id } = await ctx.params;
    const body = await parseBody(req, schema);
    const preParsed: Record<string, unknown> = { ...body };

    const issueSnap = await adminDb().doc(`issues/${id}`).get();
    if (issueSnap.exists && (body.priority ?? issueSnap.data()?.priority) > 2) {
      const heads = await adminDb()
        .collection("users")
        .where("role", "==", "maintenance_head")
        .where("department", "==", issueSnap.data()?.department)
        .where("isActive", "==", true)
        .limit(1)
        .get();
      if (!heads.empty) preParsed.maintenanceHeadUid = heads.docs[0].id;
    }

    return runTransition(req, id, schema, "VALIDATED", preParsed);
  } catch (e) {
    return handleError(e);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/auth";
import { json, parseBody, handleError } from "@/lib/api";
import { resolveRequirementSchema } from "@/lib/schemas";

const ALLOWED_ROLES = ["maintenance", "head", "admin"];

/** PATCH /api/issues/[id]/requirements/[reqId] — resolve / un-resolve. */
export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<"/api/issues/[id]/requirements/[reqId]">
): Promise<NextResponse> {
  try {
    const { id, reqId } = await ctx.params;
    const user = await requireAuth(req);
    if (!ALLOWED_ROLES.includes(user.role)) {
      return json({ error: "Not allowed." }, 403);
    }
    const body = await parseBody(req, resolveRequirementSchema);

    const db = adminDb();
    const ref = db.doc(`issues/${id}`);
    const snap = await ref.get();
    if (!snap.exists) return json({ error: "Issue not found." }, 404);

    const issueData = snap.data();
    const rawRequirements = issueData?.requirements;
    const requirements: Array<{ id?: string } & Record<string, unknown>> = Array.isArray(rawRequirements)
      ? [...(rawRequirements as Array<{ id?: string } & Record<string, unknown>>)]
      : [];
    const idx = requirements.findIndex((r) => r.id === reqId);
    if (idx === -1) return json({ error: "Requirement not found." }, 404);

    // Firestore cannot address array elements with dotted paths (it treats
    // `requirements.0.resolved` as a map key, corrupting the array). Write the
    // whole modified array back instead.
    requirements[idx] = { ...requirements[idx], resolved: body.resolved };

    await ref.update({
      requirements,
      updatedAt: new Date().toISOString(),
    });

    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

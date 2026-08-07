import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/auth";
import { json, parseBody, handleError } from "@/lib/api";
import { requirementSchema } from "@/lib/schemas";

const ALLOWED_ROLES = ["maintenance", "validator", "admin"];

/** POST /api/issues/[id]/requirements — log a requirements entry. */
export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/issues/[id]/requirements">
): Promise<NextResponse> {
  try {
    const { id } = await ctx.params;
    const user = await requireAuth(req);
    if (!ALLOWED_ROLES.includes(user.role)) {
      return json({ error: "Only maintenance staff or the department validator can log requirements." }, 403);
    }
    const body = await parseBody(req, requirementSchema);

    const db = adminDb();
    const ref = db.doc(`issues/${id}`);
    const snap = await ref.get();
    if (!snap.exists) return json({ error: "Issue not found." }, 404);

    const now = new Date().toISOString();
    const requirement = {
      id: db.collection("ids").doc().id,
      ...body,
      addedBy: { uid: user.uid, name: user.name },
      at: now,
    };

    await ref.update({
      requirements: [
        ...(snap.data()?.requirements || []),
        requirement,
      ],
      updatedAt: now,
    });

    return json({ requirement }, 201);
  } catch (e) {
    return handleError(e);
  }
}

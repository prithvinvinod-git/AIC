import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAdmin } from "@/lib/auth";
import { json, parseBody, handleError } from "@/lib/api";
import { teamSchema } from "@/lib/schemas";
import { invalidateServerCache } from "@/lib/serverCache";

const db = adminDb();

function invalidateTeamCaches() {
  invalidateServerCache("api:admin:teams");
  invalidateServerCache("api:teams");
}

/** PATCH /api/admin/teams/[id] — update a team. */
export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<"/api/admin/teams/[id]">
): Promise<NextResponse> {
  try {
    await requireAdmin(req);
    const { id } = await ctx.params;
    const body = await parseBody(req, teamSchema.partial());
    await db.doc(`teams/${id}`).update(body);
    invalidateTeamCaches();
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

/** DELETE /api/admin/teams/[id] — soft delete (deactivate). */
export async function DELETE(
  req: NextRequest,
  ctx: RouteContext<"/api/admin/teams/[id]">
): Promise<NextResponse> {
  try {
    await requireAdmin(req);
    const { id } = await ctx.params;
    await db.doc(`teams/${id}`).update({ isActive: false });
    invalidateTeamCaches();
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

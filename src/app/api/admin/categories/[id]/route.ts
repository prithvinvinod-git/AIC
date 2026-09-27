import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireUserManager } from "@/lib/auth";
import { json, parseBody, handleError } from "@/lib/api";
import { categorySchema } from "@/lib/schemas";
import { invalidateServerCache } from "@/lib/serverCache";

const db = adminDb();

function invalidateCategoryCaches() {
  invalidateServerCache("api:admin:categories");
  invalidateServerCache("api:categories");
}

/** PATCH /api/admin/categories/[id] — update a category. */
export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<"/api/admin/categories/[id]">
): Promise<NextResponse> {
  try {
    await requireUserManager(req);
    const { id } = await ctx.params;
    const body = await parseBody(req, categorySchema.partial());
    await db.doc(`categories/${id}`).update(body);
    invalidateCategoryCaches();
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

/** DELETE /api/admin/categories/[id] — soft delete. */
export async function DELETE(
  req: NextRequest,
  ctx: RouteContext<"/api/admin/categories/[id]">
): Promise<NextResponse> {
  try {
    await requireUserManager(req);
    const { id } = await ctx.params;
    await db.doc(`categories/${id}`).update({ isActive: false });
    invalidateCategoryCaches();
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

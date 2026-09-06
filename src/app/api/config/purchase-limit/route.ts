import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/auth";
import { json, parseBody, handleError } from "@/lib/api";
import { purchaseLimitSchema } from "@/lib/schemas";
import { loadPurchaseLimit } from "@/lib/purchase";
import type { Role } from "@/lib/types";

const db = adminDb();

const READ_ROLES: Role[] = ["purchase", "admin", "principal"];
const WRITE_ROLES: Role[] = ["admin", "principal"];

/** GET /api/config/purchase-limit — current over-limit approval threshold (₹).
 *  Readable by the roles that need to render it; writable only by seniors. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth(req);
    if (!READ_ROLES.includes(user.role)) {
      return json({ error: "Not allowed." }, 403);
    }
    const purchaseApprovalLimit = await loadPurchaseLimit(db);
    return json({ purchaseApprovalLimit });
  } catch (e) {
    return handleError(e);
  }
}

/** PATCH /api/config/purchase-limit — update the threshold (admin/principal). */
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth(req);
    if (!WRITE_ROLES.includes(user.role)) {
      return json({ error: "Not allowed." }, 403);
    }
    const body = await parseBody(req, purchaseLimitSchema);
    await db.doc("config/general").set(
      { purchaseApprovalLimit: body.purchaseApprovalLimit },
      { merge: true }
    );
    return json({ ok: true, purchaseApprovalLimit: body.purchaseApprovalLimit });
  } catch (e) {
    return handleError(e);
  }
}
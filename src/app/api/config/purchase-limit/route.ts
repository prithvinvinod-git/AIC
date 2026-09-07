import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/auth";
import { json, parseBody, handleError } from "@/lib/api";
import { purchaseLimitSchema } from "@/lib/schemas";
import { loadPurchaseLimit } from "@/lib/purchase";
import { serverCached, invalidateServerCache } from "@/lib/serverCache";
import type { Role } from "@/lib/types";

const db = adminDb();

const READ_ROLES: Role[] = ["purchase", "admin", "principal"];
const WRITE_ROLES: Role[] = ["admin", "principal"];
const CACHE_KEY = "api:config:purchase-limit";

/** GET /api/config/purchase-limit — current over-limit approval threshold (₹).
 *  Readable by the roles that need to render it; writable only by seniors. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth(req);
    if (!READ_ROLES.includes(user.role)) {
      return json({ error: "Not allowed." }, 403);
    }
    const purchaseApprovalLimit = await serverCached(CACHE_KEY, 30_000, () =>
      loadPurchaseLimit(db)
    );
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
    invalidateServerCache("api:config:purchase-limit");
    invalidateServerCache("api:admin:config");
    invalidateServerCache("api:load-config");
    return json({ ok: true, purchaseApprovalLimit: body.purchaseApprovalLimit });
  } catch (e) {
    return handleError(e);
  }
}
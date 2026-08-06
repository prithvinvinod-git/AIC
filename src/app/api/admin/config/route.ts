import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAdmin } from "@/lib/auth";
import { json, parseBody, handleError } from "@/lib/api";
import { configSchema } from "@/lib/schemas";
import { DEFAULT_CONFIG } from "@/lib/constants";

const db = adminDb();

/** GET /api/admin/config — app config (admin only). */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin(req);
    const snap = await db.doc("config/general").get();
    return json({ config: { ...DEFAULT_CONFIG, ...(snap.exists ? snap.data() : {}) } });
  } catch (e) {
    return handleError(e);
  }
}

/** PATCH /api/admin/config — update config. */
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin(req);
    const body = await parseBody(req, configSchema);
    await db.doc("config/general").set(body, { merge: true });
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

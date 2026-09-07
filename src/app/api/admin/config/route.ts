import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAdmin } from "@/lib/auth";
import { json, parseBody, handleError } from "@/lib/api";
import { configSchema } from "@/lib/schemas";
import { DEFAULT_CONFIG } from "@/lib/constants";
import { serverCached, invalidateServerCache } from "@/lib/serverCache";

const db = adminDb();
const CACHE_KEY = "api:admin:config";

/** GET /api/admin/config — app config (admin only). */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin(req);
    const config = await serverCached(CACHE_KEY, 30_000, async () => {
      const snap = await db.doc("config/general").get();
      return { ...DEFAULT_CONFIG, ...(snap.exists ? snap.data() : {}) };
    });
    return json({ config });
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
    invalidateServerCache("api:admin:config");
    invalidateServerCache("api:config:purchase-limit");
    invalidateServerCache("api:load-config");
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

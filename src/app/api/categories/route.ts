import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/auth";
import { json, handleError } from "@/lib/api";
import { serverCached } from "@/lib/serverCache";

const db = adminDb();

const CACHE_KEY = "api:categories:active";

/** GET /api/categories — active categories for the submit wizard (any signed-in user). */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireAuth(req);
    const categories = await serverCached(CACHE_KEY, 60_000, async () => {
      const snap = await db.collection("categories").where("isActive", "==", true).get();
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    });
    return json({ categories });
  } catch (e) {
    return handleError(e);
  }
}

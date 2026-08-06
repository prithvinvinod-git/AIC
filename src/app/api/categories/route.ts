import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/auth";
import { json, handleError } from "@/lib/api";

const db = adminDb();

/** GET /api/categories — active categories for the submit wizard (any signed-in user). */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireAuth(req);
    const snap = await db.collection("categories").where("isActive", "==", true).get();
    const categories = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return json({ categories });
  } catch (e) {
    return handleError(e);
  }
}

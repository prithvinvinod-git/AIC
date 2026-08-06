import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAdmin } from "@/lib/auth";
import { json, parseBody, handleError } from "@/lib/api";
import { categorySchema } from "@/lib/schemas";

const db = adminDb();

/** GET /api/admin/categories — list categories. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin(req);
    const snap = await db.collection("categories").orderBy("name", "asc").get();
    const categories = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return json({ categories });
  } catch (e) {
    return handleError(e);
  }
}

/** POST /api/admin/categories — create a category. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin(req);
    const body = await parseBody(req, categorySchema);
    const ref = db.collection("categories").doc();
    const data = { ...body, createdAt: new Date().toISOString() };
    await ref.set(data);
    return json({ category: { id: ref.id, ...data } }, 201);
  } catch (e) {
    return handleError(e);
  }
}

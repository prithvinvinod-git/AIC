import { NextRequest, NextResponse } from "next/server";
import type { Query } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/auth";
import { json, handleError } from "@/lib/api";

const db = adminDb();

/** GET /api/purchases/history?year=2026&limit=100 — recent approved purchases.
 *  Purchase team sees its own college only; admins see the whole campus. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth(req);
    if (!["purchase", "admin"].includes(user.role)) {
      return json({ error: "Not allowed." }, 403);
    }

    const params = req.nextUrl.searchParams;
    const college = user.role === "purchase" ? (user.college || "") : "";
    const year = Number(params.get("year") || new Date().getFullYear());
    const limit = Math.min(Math.max(Number(params.get("limit") || 100), 1), 200);
    if (!Number.isFinite(year) || year < 2000 || year > 3000) {
      return json({ error: "Invalid year." }, 400);
    }

    const start = new Date(`${year}-01-01T00:00:00Z`);
    const end = new Date(`${year + 1}-01-01T00:00:00Z`);

    let query: Query = db.collection("purchases");
    if (college) query = query.where("college", "==", college);
    query = query
      .where("approvedAt", ">=", start.toISOString())
      .where("approvedAt", "<", end.toISOString());

    const snap = await query.orderBy("approvedAt", "desc").limit(limit).get();
    const purchases = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    return json({ purchases });
  } catch (e) {
    return handleError(e);
  }
}
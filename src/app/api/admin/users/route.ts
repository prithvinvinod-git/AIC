import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAdmin } from "@/lib/auth";
import { json, handleError } from "@/lib/api";

const db = adminDb();

/** GET /api/admin/users — list all users (admin only). */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin(req);
    const role = req.nextUrl.searchParams.get("role");
    let snap;
    if (role) {
      snap = await db.collection("users").where("role", "==", role).get();
    } else {
      snap = await db.collection("users").orderBy("createdAt", "asc").get();
    }
    const users = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
    return json({ users });
  } catch (e) {
    return handleError(e);
  }
}

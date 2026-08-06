import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAdmin } from "@/lib/auth";
import { json, parseBody, handleError } from "@/lib/api";
import { teamSchema } from "@/lib/schemas";

const db = adminDb();

/** GET /api/admin/teams — list teams. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin(req);
    const snap = await db.collection("teams").orderBy("name", "asc").get();
    const teams = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return json({ teams });
  } catch (e) {
    return handleError(e);
  }
}

/** POST /api/admin/teams — create a team. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin(req);
    const body = await parseBody(req, teamSchema);
    const ref = db.collection("teams").doc();
    const data = { ...body, createdAt: new Date().toISOString() };
    await ref.set(data);
    return json({ team: { id: ref.id, ...data } }, 201);
  } catch (e) {
    return handleError(e);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/auth";
import { json, handleError } from "@/lib/api";

const db = adminDb();

/** GET /api/teams — active teams with member names (validator/admin). */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth(req);
    if (!["validator", "admin"].includes(user.role)) {
      return json({ error: "Not allowed." }, 403);
    }
    const snap = await db.collection("teams").where("isActive", "==", true).get();
    const teams = await Promise.all(
      snap.docs.map(async (d) => {
        const team = d.data();
        const members = await Promise.all(
          (team.members || []).map(async (uid: string) => {
            const u = await db.doc(`users/${uid}`).get();
            return { uid, name: u.exists ? (u.data()?.name ?? uid) : uid };
          })
        );
        return { id: d.id, ...team, members };
      })
    );
    return json({ teams });
  } catch (e) {
    return handleError(e);
  }
}

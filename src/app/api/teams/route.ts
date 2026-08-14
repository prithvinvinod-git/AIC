import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/auth";
import { json, handleError } from "@/lib/api";

const db = adminDb();

const CACHE_TTL_MS = 60_000;
let cacheAt = 0;
let cachedTeams: unknown = null;

/** GET /api/teams — active teams with member names (validator/admin/heads). */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth(req);
    if (!["validator", "admin", "maintenance_head", "category_head", "maintenance"].includes(user.role)) {
      return json({ error: "Not allowed." }, 403);
    }
    if (cachedTeams && Date.now() - cacheAt < CACHE_TTL_MS) {
      return json(cachedTeams);
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
    const payload = { teams };
    cacheAt = Date.now();
    cachedTeams = payload;
    return json(payload);
  } catch (e) {
    return handleError(e);
  }
}

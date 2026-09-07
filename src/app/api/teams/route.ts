import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/auth";
import { json, handleError } from "@/lib/api";
import { serverCached } from "@/lib/serverCache";

const db = adminDb();

const CACHE_KEY = "api:teams:active";
const CACHE_TTL_MS = 60_000;

/** GET /api/teams — active teams with member names (validator/admin/heads). */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth(req);
    if (!["validator", "admin", "maintenance_head", "category_head", "maintenance"].includes(user.role)) {
      return json({ error: "Not allowed." }, 403);
    }
    const teams = await serverCached(CACHE_KEY, CACHE_TTL_MS, async () => {
      const snap = await db.collection("teams").where("isActive", "==", true).get();
      const list = await Promise.all(
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
      return list;
    });
    return json({ teams });
  } catch (e) {
    return handleError(e);
  }
}

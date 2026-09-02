import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { json, handleError } from "@/lib/api";
import { adminDb } from "@/lib/firebaseAdmin";
import { weeklyInsightsFlow } from "@/lib/ai";

const CACHE_PATH = "config/weekly";
const CACHE_TTL_MS = 30 * 60 * 1000;

/** GET /api/ai/weekly-insights — governance narrative for the HOD panel.
 *  Regenerates (AI + full scan) at most once per TTL window; serves the
 *  cached copy for every other request so repeat visits are instant.
 *  Non-admin viewers get a per-college cache so each college's panel is
 *  isolated. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth(req);
    if (!["admin", "validator", "hod", "principal"].includes(user.role)) {
      return json({ error: "Not allowed." }, 403);
    }

    const college = user.role === "admin" ? "" : user.college || "";
    const cachePath = college ? `${CACHE_PATH}/${college}` : CACHE_PATH;

    const cached = await adminDb().doc(cachePath).get();
    const data = cached.data();
    if (data?.totals && data?.generatedAt) {
      const age = Date.now() - new Date(data.generatedAt).getTime();
      if (age >= 0 && age < CACHE_TTL_MS) {
        return json({ insight: data });
      }
    }

    const insight = await weeklyInsightsFlow({ college: college || undefined });
    await adminDb()
      .doc(cachePath)
      .set({ ...insight, generatedAt: new Date().toISOString() });
    return json({ insight });
  } catch (e) {
    return handleError(e);
  }
}

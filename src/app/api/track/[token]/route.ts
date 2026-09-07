import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { json, handleError } from "@/lib/api";
import { serverCached } from "@/lib/serverCache";
import type { Issue, TimelineEntry } from "@/lib/types";

const db = adminDb();

/**
 * GET /api/track/[token] — public lookup by the unguessable `trackingToken`
 * (same pattern as /api/images/[id]). Intentionally auth-free so email
 * recipients without a session aren't stuck at the login wall. Exposes only
 * what a tracking page needs (issue + timeline); comments and attachments are
 * deliberately excluded. Cached per token — tracking status is low-churn.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ token: string }> }
): Promise<NextResponse> {
  try {
    const { token } = await ctx.params;
    const payload = await serverCached(`api:track:${token}`, 60_000, async () => {
      const snap = await db
        .collection("issues")
        .where("trackingToken", "==", token)
        .limit(1)
        .get();
      if (snap.empty) return null;
      const doc = snap.docs[0];
      const timelineSnap = await doc.ref.collection("timeline").orderBy("at", "asc").get();
      const issue = { id: doc.id, ...doc.data() } as Issue;
      const timeline = timelineSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as unknown as TimelineEntry
      );
      return { issue, timeline };
    });
    if (!payload) return json({ error: "Issue not found." }, 404);
    return json(payload);
  } catch (e) {
    return handleError(e);
  }
}

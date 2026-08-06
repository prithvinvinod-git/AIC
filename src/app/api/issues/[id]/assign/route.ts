import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/auth";
import { json, parseBody, handleError } from "@/lib/api";
import { runTransition } from "@/lib/transition";

const schema = z.object({
  teamId: z.string().optional(),
  staff: z.array(z.string()).optional(),
  note: z.string().optional(),
});

/**
 * POST /api/issues/[id]/assign — Head routes to a team (and staff in assign
 * mode). Resolves the default team when none is provided, then runs the
 * machine's ASSIGNED transition transactionally.
 */
export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/issues/[id]/assign">
): Promise<NextResponse> {
  try {
    const { id } = await ctx.params;
    await requireAuth(req);
    const body = await parseBody(req, schema);

    const issueSnap = await adminDb().doc(`issues/${id}`).get();
    if (!issueSnap.exists) return json({ error: "Issue not found." }, 404);
    const issue = issueSnap.data()!;

    let teamId = body.teamId || issue.routing?.teamId;
    const categoryId = issue.routing?.categoryId;

    if (!teamId && categoryId) {
      const catSnap = await adminDb().doc(`categories/${categoryId}`).get();
      if (catSnap.exists && catSnap.data()?.defaultTeamId) {
        teamId = catSnap.data()?.defaultTeamId;
      } else {
        const teams = await adminDb()
          .collection("teams")
          .where("categoryId", "==", categoryId)
          .where("isActive", "==", true)
          .limit(1)
          .get();
        if (!teams.empty) teamId = teams.docs[0].id;
      }
    }

    if (!teamId) return json({ error: "No team available for this category." }, 400);

    const teamSnap = await adminDb().doc(`teams/${teamId}`).get();
    if (!teamSnap.exists) return json({ error: "Team not found." }, 404);

    // Resolve staff names for denormalization on the ticket.
    const staffObjs = await Promise.all(
      (body.staff || []).map(async (uid) => {
        const u = await adminDb().doc(`users/${uid}`).get();
        return { uid, name: u.exists ? (u.data()?.name ?? uid) : uid };
      })
    );

    // Denormalize routing onto the ticket (display data lives on the doc).
    await adminDb().doc(`issues/${id}`).update({
      "routing.teamId": teamId,
      "routing.staff": staffObjs,
    });

    return runTransition(req, id, schema, "ASSIGNED");
  } catch (e) {
    return handleError(e);
  }
}

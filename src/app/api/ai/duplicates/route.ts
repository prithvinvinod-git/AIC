import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/auth";
import { json, handleError } from "@/lib/api";
import { findDuplicatesFlow, writeDuplicates } from "@/lib/ai";

/** POST /api/ai/duplicates — duplicate/similar-issue detection for an issue. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    await requireAuth(req);
    const body = (await req.json().catch(() => ({}))) as { issueId?: string };
    if (!body.issueId) return json({ error: "issueId is required." }, 400);

    const snap = await adminDb().doc(`issues/${body.issueId}`).get();
    if (!snap.exists) return json({ error: "Issue not found." }, 404);
    const issue = snap.data()!;

    const result = await findDuplicatesFlow({
      issueId: body.issueId,
      description: issue.description,
      location: issue.location?.name || "",
      threshold: 0.45,
      college: issue.college || undefined,
    });
    await writeDuplicates(body.issueId, result);
    return json({ result });
  } catch (e) {
    return handleError(e);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/auth";
import { json, handleError } from "@/lib/api";
import { triageFlow, writeTriage, applyTriagePriority, getActiveCategories } from "@/lib/ai";

/** POST /api/ai/triage — run triage for an issue (async-safe, one-shot). */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth(req);
    const body = (await req.json().catch(() => ({}))) as { issueId?: string };
    if (!body.issueId) return json({ error: "issueId is required." }, 400);

    const snap = await adminDb().doc(`issues/${body.issueId}`).get();
    if (!snap.exists) return json({ error: "Issue not found." }, 404);
    const issue = snap.data()!;

    const staffRole = ["validator", "hod", "principal", "admin"].includes(user.role);
    const isOwner = user.uid === issue.reporter?.uid;
    if (!staffRole && !isOwner) {
      return json({ error: "Not allowed." }, 403);
    }
    if (issue.aiSuggestion?.aiProcessed) {
      return json({ result: issue.aiSuggestion, cached: true });
    }

    const categories = await getActiveCategories();
    const result = await triageFlow({
      description: issue.description,
      imageUrl: issue.images?.[0]?.url,
      department: issue.department,
      categories,
    });
    await writeTriage(body.issueId, result);
    await applyTriagePriority(body.issueId, result);
    return json({ result, cached: false });
  } catch (e) {
    return handleError(e);
  }
}

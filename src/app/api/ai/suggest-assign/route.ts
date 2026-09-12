import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/auth";
import { json, handleError } from "@/lib/api";
import { isRateLimited } from "@/lib/rateLimit";
import { loadConfig } from "@/lib/issueMachine";
import { suggestAssignmentFlow, writeRoutingSuggestion } from "@/lib/ai";

/** POST /api/ai/suggest-assign — AI routing suggestion for the Validator to confirm. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth(req);
    if (!["validator", "admin"].includes(user.role)) {
      return json({ error: "Only the department validator can use routing suggestions." }, 403);
    }
    if (isRateLimited(`ai:suggest-assign:${user.uid}`, { limit: 15, windowMs: 60_000 })) {
      return NextResponse.json(
        { error: "Too many AI requests. Please slow down." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }
    const body = (await req.json().catch(() => ({}))) as { issueId?: string };
    if (!body.issueId) return json({ error: "issueId is required." }, 400);

    const snap = await adminDb().doc(`issues/${body.issueId}`).get();
    if (!snap.exists) return json({ error: "Issue not found." }, 404);
    const issue = snap.data()!;
    const categoryId = issue.routing?.categoryId;

    if (!categoryId) return json({ error: "Issue has no category to route by." }, 400);

    const config = await loadConfig(adminDb());
    const result = await suggestAssignmentFlow(
      {
        issueId: body.issueId,
        categoryId,
        description: issue.description,
      },
      { routingModel: config.ai?.routingModel }
    );
    await writeRoutingSuggestion(body.issueId, result);
    return json({ result });
  } catch (e) {
    return handleError(e);
  }
}

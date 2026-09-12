import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/auth";
import { json, handleError } from "@/lib/api";
import { isRateLimited } from "@/lib/rateLimit";
import { loadConfig } from "@/lib/issueMachine";
import { findDuplicatesFlow, writeDuplicates } from "@/lib/ai";

/** POST /api/ai/duplicates — duplicate/similar-issue detection for an issue. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth(req);
    if (isRateLimited(`ai:duplicates:${user.uid}`, { limit: 10, windowMs: 60_000 })) {
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

    // AI-8: if duplicates are already processed, surface the cached result.
    const cached = issue.aiSuggestion?.duplicatesProcessed;
    if (cached) {
      return json({
        result: {
          duplicateOf: issue.aiSuggestion?.duplicateOf ?? null,
          duplicateIssueNo: issue.aiSuggestion?.duplicateIssueNo ?? null,
          matchScore: issue.aiSuggestion?.matchScore ?? 0,
          similarIssues: issue.aiSuggestion?.similarIssues ?? [],
        },
        cached: true,
      });
    }

    const config = await loadConfig(adminDb());
    const result = await findDuplicatesFlow({
      issueId: body.issueId,
      description: issue.description,
      location: issue.location?.name || "",
      threshold: config.ai?.threshold ?? 0.45,
      college: issue.college || undefined,
    });
    const claimed = await writeDuplicates(body.issueId, result);
    return json({ result, cached: !claimed });
  } catch (e) {
    return handleError(e);
  }
}

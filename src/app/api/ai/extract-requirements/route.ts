import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/auth";
import { json, handleError } from "@/lib/api";
import { extractRequirementsFlow } from "@/lib/ai";

/** POST /api/ai/extract-requirements — draft requirements from an issue. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth(req);
    if (!["maintenance", "head", "admin"].includes(user.role)) {
      return json({ error: "Not allowed." }, 403);
    }
    const body = (await req.json().catch(() => ({}))) as { issueId?: string };
    if (!body.issueId) return json({ error: "issueId is required." }, 400);

    const snap = await adminDb().doc(`issues/${body.issueId}`).get();
    if (!snap.exists) return json({ error: "Issue not found." }, 404);
    const issue = snap.data()!;

    const requirements = await extractRequirementsFlow({
      description: issue.description,
      imageUrl: issue.images?.[0]?.url,
    });
    return json({ requirements });
  } catch (e) {
    return handleError(e);
  }
}

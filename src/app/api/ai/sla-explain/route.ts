import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { json, err, parseBody, handleError } from "@/lib/api";
import { slaExplainFlow, writeSlaExplanation } from "@/lib/ai";

const bodySchema = z.object({ issueId: z.string().min(1, "issueId is required") });
const ALLOWED = ["validator", "hod", "principal", "admin"];

/** POST /api/ai/sla-explain — why is this issue late? (F8) */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth(req);
    if (!ALLOWED.includes(user.role)) {
      return err("Not allowed to view SLA explanations.", 403);
    }
    const { issueId } = await parseBody(req, bodySchema);
    const result = await slaExplainFlow(issueId);
    if (!result) return err("Issue not found.", 404);
    await writeSlaExplanation(issueId, result);
    return json(result);
  } catch (e) {
    return handleError(e);
  }
}
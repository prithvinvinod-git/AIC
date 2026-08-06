import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { json, handleError } from "@/lib/api";
import { weeklyInsightsFlow } from "@/lib/ai";

/** GET /api/ai/weekly-insights — governance narrative for the HOD panel. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth(req);
    if (!["admin", "head", "hod", "principal"].includes(user.role)) {
      return json({ error: "Not allowed." }, 403);
    }
    const insight = await weeklyInsightsFlow({});
    return json({ insight });
  } catch (e) {
    return handleError(e);
  }
}

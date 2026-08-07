import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { json, handleError } from "@/lib/api";
import { rootCauseFlow } from "@/lib/ai/rootCause";

/** POST /api/ai/root-cause — analyze historical issues for root causes */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth(req);
    if (!["admin", "validator", "hod", "principal", "maintenance"].includes(user.role)) {
      return json({ error: "Not allowed." }, 403);
    }
    
    const result = await rootCauseFlow();
    return json({ result });
  } catch (e) {
    return handleError(e);
  }
}
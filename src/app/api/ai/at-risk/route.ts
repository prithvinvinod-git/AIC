import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { json, handleError } from "@/lib/api";
import { predictiveMaintenanceFlow } from "@/lib/ai/predictive";

/** GET /api/ai/at-risk — identify locations at risk for future issues */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth(req);
    if (!["admin", "head", "hod", "principal"].includes(user.role)) {
      return json({ error: "Not allowed." }, 403);
    }
    
    const result = await predictiveMaintenanceFlow();
    return json({ result });
  } catch (e) {
    return handleError(e);
  }
}
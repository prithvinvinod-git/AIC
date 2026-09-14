import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { json, handleError } from "@/lib/api";
import { isRateLimited } from "@/lib/rateLimit";
import { adminDb } from "@/lib/firebaseAdmin";
import { loadConfig } from "@/lib/issueMachine";
import { rootCauseFlow } from "@/lib/ai/rootCause";

/** POST /api/ai/root-cause — analyze historical issues for root causes */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth(req);
    if (!["admin", "validator", "hod", "principal", "maintenance"].includes(user.role)) {
      return json({ error: "Not allowed." }, 403);
    }
    if (isRateLimited(`ai:root-cause:${user.uid}`, { limit: 5, windowMs: 60_000 })) {
      return NextResponse.json(
        { error: "Too many AI requests. Please slow down." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }
    const config = await loadConfig(adminDb());
    const result = await rootCauseFlow(
      {
        college: user.role === "admin" ? undefined : user.college,
      },
      { enabled: config.ai?.enabled }
    );
    return json({ result });
  } catch (e) {
    return handleError(e);
  }
}
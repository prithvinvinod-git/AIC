import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { json, handleError } from "@/lib/api";
import { isRateLimited } from "@/lib/rateLimit";
import { serverCached } from "@/lib/serverCache";
import { adminDb } from "@/lib/firebaseAdmin";
import { loadConfig } from "@/lib/issueMachine";
import { predictiveMaintenanceFlow } from "@/lib/ai/predictive";

/** GET /api/ai/at-risk — identify locations at risk for future issues */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth(req);
    if (!["admin", "validator", "hod", "principal"].includes(user.role)) {
      return json({ error: "Not allowed." }, 403);
    }
    if (isRateLimited(`ai:at-risk:${user.uid}`, { limit: 6, windowMs: 10 * 60_000 })) {
      return NextResponse.json(
        { error: "Too many AI requests. Please slow down." },
        { status: 429, headers: { "Retry-After": "600" } }
      );
    }
    const college = user.role === "admin" ? undefined : user.college;
    const config = await loadConfig(adminDb());
    // Regenerate at most every 5 min per college; the scan + model call is
    // expensive and the underlying data moves on the order of hours.
    const result = await serverCached(`api:ai:at-risk:${college || "all"}`, 5 * 60_000, () =>
      predictiveMaintenanceFlow({ college }, { enabled: config.ai?.enabled })
    );
    return json({ result });
  } catch (e) {
    return handleError(e);
  }
}
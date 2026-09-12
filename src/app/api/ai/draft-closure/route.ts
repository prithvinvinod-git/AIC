import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { json, handleError } from "@/lib/api";
import { isRateLimited } from "@/lib/rateLimit";
import { draftClosureFlow } from "@/lib/ai";

/** POST /api/ai/draft-closure — turn staff bullets into a closure report. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth(req);
    if (!["maintenance", "validator", "admin"].includes(user.role)) {
      return json({ error: "Not allowed." }, 403);
    }
    if (isRateLimited(`ai:closure:${user.uid}`, { limit: 20, windowMs: 60_000 })) {
      return NextResponse.json(
        { error: "Too many AI requests. Please slow down." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }
    const body = (await req.json().catch(() => ({}))) as { bullets?: string[] };
    const report = await draftClosureFlow({ bullets: body.bullets || [] });
    return json({ report });
  } catch (e) {
    return handleError(e);
  }
}

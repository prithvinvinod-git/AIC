import { NextRequest, NextResponse } from "next/server";
import { json } from "@/lib/api";

/** GET /api/cron/escalate-stale — Vercel Cron calls this with
 *  `Authorization: Bearer ${CRON_SECRET}`; anything else is rejected.
 *  Auto-escalates P1–2 issues still in NEW past the 24h threshold so a
 *  stalled critical issue always lands in front of HOD/Principal. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return json({ error: "Unauthorized" }, 401);
  }
  const escalated = await import("@/lib/staleCritical").then((m) => m.runStaleCriticalScan());
  return json({ escalated });
}
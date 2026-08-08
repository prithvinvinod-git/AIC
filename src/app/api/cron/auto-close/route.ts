import { NextRequest, NextResponse } from "next/server";
import { json } from "@/lib/api";

/** GET /api/cron/auto-close — Vercel Cron calls this with
 *  `Authorization: Bearer ${CRON_SECRET}`; we reject anything else.
 *  Closes VERIFIED issues past their feedback grace period. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return json({ error: "Unauthorized" }, 401);
  }
  const closed = await import("@/lib/autoClose").then((m) => m.runAutoCloseJob());
  return json({ closed });
}

import { NextRequest, NextResponse } from "next/server";
import { json } from "@/lib/api";

/** GET /api/cron/sla-reminders — Vercel Cron calls this with
 *  `Authorization: Bearer ${CRON_SECRET}`; we reject anything else. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return json({ error: "Unauthorized" }, 401);
  }
  const sent = await import("@/lib/email").then((m) => m.sendSlaReminderEmails());
  return json({ sent });
}

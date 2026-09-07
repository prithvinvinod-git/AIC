import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

/** GET /api/health — lightweight uptime probe for Vercel cron / external
 *  monitors. Confirms the process is up and Firestore is reachable. */
export async function GET() {
  const body = {
    ok: true,
    service: "servox-phi",
    time: new Date().toISOString(),
    env: process.env.VERCEL_ENV || "development",
  };
  try {
    await adminDb().doc("config/general").get();
  } catch {
    return NextResponse.json({ ...body, ok: false, db: "unreachable" }, { status: 503 });
  }
  return NextResponse.json({ ...body, db: "ok" });
}
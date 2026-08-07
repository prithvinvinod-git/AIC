import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/auth";
import { json, handleError } from "@/lib/api";

const db = adminDb();

const OPEN_STATUSES = ["NEW", "VALIDATED", "ESCALATED", "APPROVED", "ASSIGNED", "ONGOING", "PENDING"];

/**
 * GET /api/analytics/summary?range=7|30 — aggregates over the requested window.
 * Computed live from the issues collection (demo-accurate without relying on
 * scheduled Cloud Functions), merged with per-day stats counters when present.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth(req);
    if (!["admin", "validator", "hod", "principal"].includes(user.role)) {
      return json({ error: "Not allowed." }, 403);
    }

    const range = Number(req.nextUrl.searchParams.get("range") || 7);
    const since = new Date(Date.now() - range * 24 * 3600 * 1000).toISOString();

    const [issueSnap, resolvedSnap, openSnap, totalSnap] = await Promise.all([
      db.collection("issues").where("createdAt", ">=", since).limit(500).get(),
      db.collection("issues").where("status", "in", ["VERIFIED", "CLOSED"]).limit(500).get(),
      db.collection("issues").where("status", "in", OPEN_STATUSES).limit(1000).get(),
      db.collection("issues").limit(1000).get(),
    ]);

    const byStatus: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const byDepartment: Record<string, number> = {};
    const byPriority: Record<number, number> = {};
    let sumResolutionMs = 0;
    let resolvedCount = 0;

    for (const doc of issueSnap.docs) {
      const d = doc.data();
      byStatus[d.status] = (byStatus[d.status] || 0) + 1;
      byCategory[d.routing?.categoryName || "Uncategorized"] =
        (byCategory[d.routing?.categoryName || "Uncategorized"] || 0) + 1;
      byDepartment[d.department] = (byDepartment[d.department] || 0) + 1;
      if (d.priority) byPriority[d.priority] = (byPriority[d.priority] || 0) + 1;
    }

    for (const doc of resolvedSnap.docs) {
      const d = doc.data();
      const resolvedAt = d.verification?.verifiedAt || d.updatedAt;
      if (d.createdAt && resolvedAt) {
        const ms = new Date(resolvedAt).getTime() - new Date(d.createdAt).getTime();
        sumResolutionMs += ms;
        resolvedCount++;
      }
    }

    // SLA compliance: count breached resolution deadlines among resolved.
    let slaCompliant = 0;
    let slaTotal = 0;
    for (const doc of resolvedSnap.docs) {
      const d = doc.data();
      if (d.sla?.resolutionDeadline) {
        slaTotal++;
        const resolvedAt = d.verification?.verifiedAt || d.updatedAt;
        const wasBreached =
          d.sla.breachedFlags?.resolution ||
          new Date(resolvedAt) > new Date(d.sla.resolutionDeadline);
        if (!wasBreached) slaCompliant++;
      }
    }

    // Week trend (created / resolved / still-unresolved per day).
    const trend: { day: string; created: number; closed: number; unresolved: number }[] = [];
    for (let i = range - 1; i >= 0; i--) {
      const dayStart = new Date(Date.now() - i * 24 * 3600 * 1000);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
      const day = dayStart.toISOString().slice(0, 10);
      trend.push({
        day,
        created: issueSnap.docs.filter((d) => {
          const t = new Date(d.data().createdAt).getTime();
          return t >= dayStart.getTime() && t < dayEnd.getTime();
        }).length,
        closed: resolvedSnap.docs.filter((d) => {
          const t = new Date(d.data().verification?.verifiedAt || d.data().updatedAt).getTime();
          return t >= dayStart.getTime() && t < dayEnd.getTime();
        }).length,
        unresolved: openSnap.docs.filter((d) => {
          const t = new Date(d.data().createdAt).getTime();
          return t <= dayEnd.getTime();
        }).length,
      });
    }

    return json({
      summary: {
        range,
        totals: {
          issues: issueSnap.size,
          totalAllTime: totalSnap.size,
          open: openSnap.size,
          closed: resolvedCount,
          avgResolutionHours: resolvedCount ? Math.round(sumResolutionMs / resolvedCount / 3600000) : 0,
          slaCompliancePct: slaTotal ? Math.round((slaCompliant / slaTotal) * 100) : 100,
          byStatus,
          byCategory,
          byDepartment,
          byPriority,
        },
        trend,
      },
    });
  } catch (e) {
    return handleError(e);
  }
}

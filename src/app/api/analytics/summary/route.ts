import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/auth";
import { json, handleError } from "@/lib/api";

const db = adminDb();

const OPEN_STATUSES = ["NEW", "VALIDATED", "ESCALATED", "APPROVED", "ASSIGNED", "ONGOING", "PENDING"];

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { at: number; payload: unknown }>();

/**
 * GET /api/analytics/summary?range=7|30 — aggregates over the requested window.
 * Computed live from the issues collection (demo-accurate without relying on
 * scheduled Cloud Functions), merged with per-day stats counters when present.
 * Results are memoized for 60 s per instance to avoid ~3k reads per reload.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth(req);
    if (!["admin", "validator", "hod", "principal"].includes(user.role)) {
      return json({ error: "Not allowed." }, 403);
    }

    const requestedRange = Number(req.nextUrl.searchParams.get("range") || 7);
    if (!Number.isInteger(requestedRange) || ![7, 30].includes(requestedRange)) {
      return json({ error: "Range must be 7 or 30 days." }, 400);
    }
    const range = requestedRange;
    const since = new Date(Date.now() - range * 24 * 3600 * 1000).toISOString();

    // Non-admin (validator/hod/principal) analytics are scoped to their own
    // college; admins see the whole campus. Empty college falls back to all so
    // a misconfigured account doesn't hide everything until it's fixed.
    const college = user.role === "admin" ? "" : user.college || "";

    const cacheKey = `${college || "*"}:${range}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return json(cached.payload);
    }

    const collegeFilter = college ? db.collection("issues").where("college", "==", college) : db.collection("issues");
    const [issueSnap, resolvedSnap, openSnap, totalSnap] = await Promise.all([
      collegeFilter.where("createdAt", ">=", since).limit(500).get(),
      collegeFilter.where("status", "in", ["VERIFIED", "CLOSED"]).limit(500).get(),
      collegeFilter.where("status", "in", OPEN_STATUSES).limit(1000).get(),
      collegeFilter.limit(1000).get(),
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

    const payload = {
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
    };

    cache.set(cacheKey, { at: Date.now(), payload });
    return json(payload);
  } catch (e) {
    return handleError(e);
  }
}

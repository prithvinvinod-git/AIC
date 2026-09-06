import { NextRequest, NextResponse } from "next/server";
import type { DocumentSnapshot, Query } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/auth";
import { json, handleError } from "@/lib/api";

const db = adminDb();

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { at: number; payload: unknown }>();

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** GET /api/purchases/analytics?year=2026 — spend KPIs + monthly / by-category /
 *  by-college / by-department breakdowns for approved purchases. Purchase team
 *  sees its own college only; admins see the whole campus. Memoized 60 s. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth(req);
    if (!["purchase", "admin"].includes(user.role)) {
      return json({ error: "Not allowed." }, 403);
    }

    const year = Number(req.nextUrl.searchParams.get("year") || new Date().getFullYear());
    if (!Number.isFinite(year) || year < 2000 || year > 3000) {
      return json({ error: "Invalid year." }, 400);
    }
    const college = user.role === "purchase" ? (user.college || "") : "";

    const cacheKey = `${college || "*"}:${year}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return json(cached.payload);
    }

    const start = new Date(`${year}-01-01T00:00:00Z`);
    const end = new Date(`${year + 1}-01-01T00:00:00Z`);
    const startIso = start.toISOString();
    const endIso = end.toISOString();

    let base: Query = db.collection("purchases");
    if (college) {
      base = base.where("college", "==", college);
    }
    base = base.where("approvedAt", ">=", startIso).where("approvedAt", "<", endIso);

    // Batched cursor read — a campus year of purchases fits comfortably under
    // a few thousand records, but we paginate so the endpoint stays correct
    // even past the 1000-doc Firestore limit.
    const byMonth: { label: string; total: number; count: number }[] = MONTH_LABELS.map((label) => ({
      label,
      total: 0,
      count: 0,
    }));
    const byCategoryAgg: Record<string, number> = {};
    const byCollegeAgg: Record<string, number> = {};
    const byDepartmentAgg: Record<string, number> = {};
    let total = 0;
    let count = 0;
    let last: DocumentSnapshot | undefined;
    let pages = 0;

    while (pages < 20) {
      let q = base.orderBy("approvedAt", "desc").limit(1000);
      if (last) q = q.startAfter(last);
      const snap = await q.get();
      if (snap.empty) break;

      for (const doc of snap.docs) {
        const d = doc.data();
        const t = Number(d.total || 0);
        total += t;
        count++;
        const monthIdx = new Date(d.approvedAt).getMonth();
        if (monthIdx >= 0 && monthIdx < 12) {
          byMonth[monthIdx].total += t;
          byMonth[monthIdx].count++;
        }
        const cat = d.categoryName || "Uncategorized";
        byCategoryAgg[cat] = (byCategoryAgg[cat] || 0) + t;
        const coll = d.college || "—";
        byCollegeAgg[coll] = (byCollegeAgg[coll] || 0) + t;
        const dept = d.department || "—";
        byDepartmentAgg[dept] = (byDepartmentAgg[dept] || 0) + t;
      }

      pages++;
      if (snap.size < 1000) break;
      last = snap.docs[snap.docs.length - 1];
    }

    const byCategory = Object.entries(byCategoryAgg)
      .map(([name, value]) => ({ name, total: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.total - a.total);
    const byCollege = Object.entries(byCollegeAgg)
      .map(([name, value]) => ({ name, total: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.total - a.total);
    const byDepartment = Object.entries(byDepartmentAgg)
      .map(([name, value]) => ({ name, total: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.total - a.total);

    const payload = {
      analytics: {
        year,
        total: Math.round(total * 100) / 100,
        count,
        avg: count ? Math.round((total / count) * 100) / 100 : 0,
        byMonth: byMonth.map((m) => ({ ...m, total: Math.round(m.total * 100) / 100 })),
        byCategory,
        byCollege,
        byDepartment,
      },
    };

    cache.set(cacheKey, { at: Date.now(), payload });
    return json(payload);
  } catch (e) {
    return handleError(e);
  }
}
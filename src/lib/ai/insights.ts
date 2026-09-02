import "server-only";

import { adminDb } from "../firebaseAdmin";
import { aiEnabled, aiModelName } from "./genkit";

export interface WeeklyTotals {
  created: number;
  closed: number;
  breached: number;
  open: number;
  avgResolutionHours: number;
  slaCompliancePct: number;
}

export interface WeeklyChartSlice {
  name: string;
  value: number;
}

export interface WeeklyTrendPoint {
  day: string;
  created: number;
  closed: number;
  unresolved: number;
}

export interface WeeklyInsight {
  period: { start: string; end: string };
  totals: WeeklyTotals;
  byCategory: WeeklyChartSlice[];
  byPriority: WeeklyChartSlice[];
  trend: WeeklyTrendPoint[];
  executiveSummary: string;
  slaBreaches: string[];
  topConcerns: string[];
  recommendations: string[];
}

const TERMINAL_STATUSES = ["CLOSED", "VERIFIED", "REJECTED"];

/**
 * F5 — Weekly governance insights. Reads issues created in the last 7 days,
 * produces structured totals + chart data plus a plain-language narrative
 * (AI when enabled, deterministic summary otherwise). Powers the HOD
 * "trending complaints" panel and the weekly report email.
 */
export async function weeklyInsightsFlow(
  input: { weekStart?: string; college?: string } = {}
): Promise<WeeklyInsight> {
  const end = new Date();
  const start = input.weekStart ? new Date(input.weekStart) : new Date();
  if (!input.weekStart) start.setDate(end.getDate() - 6);
  start.setHours(0, 0, 0, 0);

  const db = adminDb();
  const since = start.toISOString();

  const createdBase = db.collection("issues");
  const resolvedBase = db.collection("issues");
  const createdQuery = input.college ? createdBase.where("college", "==", input.college) : createdBase;
  const resolvedQuery = input.college ? resolvedBase.where("college", "==", input.college) : resolvedBase;

  const [createdSnap, resolvedSnap] = await Promise.all([
    createdQuery.where("createdAt", ">=", since).limit(1000).get(),
    resolvedQuery.where("status", "in", ["VERIFIED", "CLOSED"]).limit(1000).get(),
  ]);

  const byCategory: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  const byDepartment: Record<string, number> = {};
  let open = 0;

  for (const doc of createdSnap.docs) {
    const d = doc.data();
    const cat = d.routing?.categoryName || "Uncategorized";
    byCategory[cat] = (byCategory[cat] || 0) + 1;
    const p = d.priority;
    if (p && p >= 1 && p <= 5) byPriority[`P${p}`] = (byPriority[`P${p}`] || 0) + 1;
    if (d.department) byDepartment[d.department] = (byDepartment[d.department] || 0) + 1;
    if (!TERMINAL_STATUSES.includes(d.status)) open++;
  }

  let closed = 0;
  let breached = 0;
  let sumResolutionMs = 0;
  for (const doc of resolvedSnap.docs) {
    const d = doc.data();
    const resolvedAt = d.verification?.verifiedAt || d.updatedAt;
    if (!resolvedAt) continue;
    const t = new Date(resolvedAt).getTime();
    if (t < start.getTime()) continue;
    closed++;
    if (d.createdAt) sumResolutionMs += t - new Date(d.createdAt).getTime();
    if (d.sla?.breachedFlags?.resolution) breached++;
  }

  const avgResolutionHours = closed ? Math.round(sumResolutionMs / closed / 3600000) : 0;
  const slaCompliancePct = closed ? Math.max(0, Math.round(((closed - breached) / closed) * 100)) : 100;

  // Daily trend over the window (created / resolved / still-open per day).
  const trend: WeeklyTrendPoint[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(start.getTime() + i * 86400000);
    const dayEnd = new Date(dayStart.getTime() + 86400000);
    trend.push({
      day: dayStart.toISOString().slice(0, 10),
      created: createdSnap.docs.filter((d) => {
        const t = new Date(d.data().createdAt).getTime();
        return t >= dayStart.getTime() && t < dayEnd.getTime();
      }).length,
      closed: resolvedSnap.docs.filter((d) => {
        const t = new Date(d.data().verification?.verifiedAt || d.data().updatedAt).getTime();
        return t >= dayStart.getTime() && t < dayEnd.getTime();
      }).length,
      unresolved: createdSnap.docs.filter((d) => {
        const d2 = d.data();
        if (TERMINAL_STATUSES.includes(d2.status)) return false;
        return new Date(d2.createdAt).getTime() <= dayEnd.getTime();
      }).length,
    });
  }

  const topCategories = (Object.entries(byCategory) as [string, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k);

  const slaBreaches = breached
    ? [`${breached} SLA breach(es) in the last 7 days.`]
    : ["No SLA breaches recorded this week — keep it up."];

  const concerns = topCategories.length
    ? [
        `${topCategories[0]} issues lead the week with ${byCategory[topCategories[0]]} reports.`,
        ...topCategories.slice(1).map((c) => `${c}: ${byCategory[c]} reports.`),
      ]
    : ["No reports filed this week."];

  const insights = {
    period: {
      start: start.toISOString(),
      end: end.toISOString(),
    },
    totals: {
      created: createdSnap.size,
      closed,
      breached,
      open,
      avgResolutionHours,
      slaCompliancePct,
    },
    byCategory: toSlices(byCategory),
    byPriority: toSlices(byPriority),
    byDepartment: toSlices(byDepartment),
    trend,
  };

  if (aiEnabled()) {
    try {
      const ai = await (await import("./genkit")).getGenkit();
      const { z } = await import("genkit");
      const res = await ai.generate({
        model: `googleai/${aiModelName()}`,
        system:
          "Summarize this week's campus maintenance data. Highlight SLA breaches, worst categories and trends vs last week. Max 120 words. Return ONLY structured JSON.",
        prompt: `Created: ${insights.totals.created}, Closed: ${insights.totals.closed}, Breaches: ${insights.totals.breached}, Avg resolution: ${insights.totals.avgResolutionHours}h, Still open: ${insights.totals.open}. By category: ${JSON.stringify(byCategory)}. By priority: ${JSON.stringify(byPriority)}. By department: ${JSON.stringify(byDepartment)}`,
        output: {
          schema: z.object({
            executiveSummary: z.string(),
            recommendations: z.array(z.string()),
          }),
          format: "json",
        },
      });
      const out = res.output as { executiveSummary: string; recommendations: string[] };
      return {
        ...insights,
        executiveSummary: out.executiveSummary,
        slaBreaches,
        topConcerns: concerns,
        recommendations: out.recommendations?.length ? out.recommendations : ["Prioritise the top categories early in the week."],
      };
    } catch {
      /* fall through */
    }
  }

  const summary = `${insights.totals.created} issue(s) created and ${insights.totals.closed} closed in the last 7 days. ${
    insights.totals.breached ? `${insights.totals.breached} SLA breach(es) need attention.` : "No SLA breaches."
  } ${topCategories.length ? `Top concern: ${topCategories[0]}.` : ""}`;

  return {
    ...insights,
    executiveSummary: summary,
    slaBreaches,
    topConcerns: concerns,
    recommendations: [
      "Address the top category first to reduce backlog.",
      "Review unresolved P1/P2 escalations daily.",
    ],
  };
}

function toSlices(record: Record<string, number>): WeeklyChartSlice[] {
  return Object.entries(record)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export async function writeWeeklyInsights(project: "stats/weekly" | "config/weekly") {
  const insight = await weeklyInsightsFlow({});
  await adminDb()
    .doc(project)
    .set({ ...insight, generatedAt: new Date().toISOString() });
}

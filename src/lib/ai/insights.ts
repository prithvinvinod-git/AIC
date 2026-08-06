import "server-only";

import { adminDb } from "../firebaseAdmin";
import { aiEnabled, aiModelName } from "./genkit";

export interface WeeklyInsight {
  executiveSummary: string;
  slaBreaches: string[];
  topConcerns: string[];
  recommendations: string[];
}

/**
 * F5 — Weekly governance insights. Reads per-day stats docs, produces a plain-language
 * narrative (AI when enabled, deterministic summary otherwise) that powers the
 * HOD "trending complaints" panel and the weekly report email.
 */
export async function weeklyInsightsFlow(input: { weekStart?: string }): Promise<WeeklyInsight> {
  const end = new Date();
  const start = input.weekStart ? new Date(input.weekStart) : new Date();
  if (!input.weekStart) start.setDate(end.getDate() - 6);
  start.setHours(0, 0, 0, 0);

  const db = adminDb();
  const since = start.toISOString();
  const [createdSnap, resolvedSnap] = await Promise.all([
    db.collection("issues").where("createdAt", ">=", since).limit(1000).get(),
    db.collection("issues").where("status", "in", ["VERIFIED", "CLOSED"]).limit(1000).get(),
  ]);

  const byCat: Record<string, number> = {};
  for (const doc of createdSnap.docs) {
    const cat = doc.data().routing?.categoryName || "Uncategorized";
    byCat[cat] = (byCat[cat] || 0) + 1;
  }

  const created = createdSnap.size;
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

  const totals = {
    created,
    closed,
    breached,
    avgMs: closed ? Math.round(sumResolutionMs / closed) : 0,
    byCat,
  };

  const topCategories = (Object.entries(totals.byCat) as [string, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k);

  const slaBreaches = totals.breached
    ? [`${totals.breached} SLA breach(es) in the last 7 days.`]
    : ["No SLA breaches recorded this week — keep it up."];

  const concerns = topCategories.length
    ? [
        `${topCategories[0]} issues lead the week with ${totals.byCat[topCategories[0]]} reports.`,
        ...topCategories.slice(1).map((c) => `${c}: ${totals.byCat[c]} reports.`),
      ]
    : ["No reports filed this week."];

  if (aiEnabled()) {
    try {
      const ai = await (await import("./genkit")).getGenkit();
      const { z } = await import("genkit");
      const res = await ai.generate({
        model: `googleai/${aiModelName()}`,
        system:
          "Summarize this week's campus maintenance data. Highlight SLA breaches, worst categories and trends vs last week. Max 120 words. Return ONLY structured JSON.",
        prompt: `Created: ${totals.created}, Closed: ${totals.closed}, Breaches: ${totals.breached}, Avg resolution: ${Math.round(totals.avgMs / 3600000)}h. By category: ${JSON.stringify(totals.byCat)}`,
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
        executiveSummary: out.executiveSummary,
        slaBreaches,
        topConcerns: concerns,
        recommendations: out.recommendations?.length ? out.recommendations : ["Prioritise the top categories early in the week."],
      };
    } catch {
      /* fall through */
    }
  }

  const summary = `${totals.created} issue(s) created and ${totals.closed} closed in the last 7 days. ${
    totals.breached ? `${totals.breached} SLA breach(es) need attention.` : "No SLA breaches."
  } ${topCategories.length ? `Top concern: ${topCategories[0]}.` : ""}`;

  return {
    executiveSummary: summary,
    slaBreaches,
    topConcerns: concerns,
    recommendations: [
      "Address the top category first to reduce backlog.",
      "Review unresolved P1/P2 escalations daily.",
    ],
  };
}

export async function writeWeeklyInsights(project: "stats/weekly" | "config/weekly") {
  const insight = await weeklyInsightsFlow({});
  await adminDb()
    .doc(project)
    .set({ ...insight, generatedAt: new Date().toISOString() });
}

import "server-only";

import { adminDb } from "../firebaseAdmin";
import { aiEnabled, aiModelName } from "./genkit";

export interface WeeklyInsight {
  executiveSummary: string;
  slaBreaches: string[];
  topConcerns: string[];
  recommendations: string[];
}

interface DailyStat {
  totalCreated?: number;
  totalClosed?: number;
  slaBreached?: number;
  sumResolutionMs?: number;
  byCategory?: Record<string, number>;
}

/** Read stats/daily docs between two dates. */
async function readDailyStats(from: Date, to: Date) {
  const out: Record<string, DailyStat> = {};
  const cursor = new Date(from);
  while (cursor <= to) {
    const key = cursor.toISOString().slice(0, 10);
    const snap = await adminDb().doc(`stats/daily/${key}`).get();
    if (snap.exists) out[key] = snap.data() as DailyStat;
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

/**
 * F5 — Weekly governance insights. Reads stats/daily, produces a plain-language
 * narrative (AI when enabled, deterministic summary otherwise) that powers the
 * HOD "trending complaints" panel and the weekly report email.
 */
export async function weeklyInsightsFlow(input: { weekStart?: string }): Promise<WeeklyInsight> {
  const end = new Date();
  const start = input.weekStart ? new Date(input.weekStart) : new Date();
  if (!input.weekStart) start.setDate(end.getDate() - 6);
  start.setHours(0, 0, 0, 0);

  const stats = await readDailyStats(start, end);

  const totals = Object.values(stats).reduce(
    (acc, d) => {
      acc.created += d.totalCreated || 0;
      acc.closed += d.totalClosed || 0;
      acc.breached += d.slaBreached || 0;
      acc.avgMs += d.sumResolutionMs || 0;
      const byCat = d.byCategory || {};
      for (const [k, v] of Object.entries(byCat)) {
        acc.byCat[k] = (acc.byCat[k] || 0) + v;
      }
      return acc;
    },
    { created: 0, closed: 0, breached: 0, avgMs: 0, byCat: {} as Record<string, number> }
  );

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

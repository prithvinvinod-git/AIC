import "server-only";

import { adminDb } from "../firebaseAdmin";
import { aiEnabled, aiModelName, getGenkit } from "./genkit";

export interface RootCauseResult {
  summary: string;
  likelyArea: string;
  confidence: "Low" | "Medium" | "High";
  recommendation: string;
}

interface IssueRow {
  issueNo: string;
  title: string;
  description: string;
  category: string;
  location: string;
  status: string;
}

async function loadRecentIssues(days: number, college?: string): Promise<IssueRow[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const base = adminDb().collection("issues");
  const query = college ? base.where("college", "==", college) : base;
  const snap = await query
    .where("createdAt", ">=", since.toISOString())
    .orderBy("createdAt", "desc")
    .limit(1000)
    .get();

  return snap.docs
    .map((d) => {
      const x = d.data();
      return {
        issueNo: x.issueNo || "",
        title: x.title || "",
        description: x.description || "",
        category: x.routing?.categoryName || "Unknown",
        location: x.location?.name || "Unknown",
        status: x.status || "",
      };
    })
    .filter((i) => i.status !== "CLOSED" && i.status !== "VERIFIED" && i.status !== "REJECTED");
}

const AREA_HINTS: Record<string, string> = {
  Electrical: "electrical circuit",
  Plumbing: "water supply or drainage line",
  HouseKeeping: "cleaning / waste handling point",
  IT: "network or computer infrastructure",
  General: "general building fittings",
};

function fallbackRootCause(issues: IssueRow[]): RootCauseResult {
  if (issues.length === 0) {
    return {
      summary: "No recent unresolved issues found to analyze.",
      likelyArea: "Unknown",
      confidence: "Low",
      recommendation: "Submit more issues to enable pattern analysis.",
    };
  }

  // Cluster by location, then pick the dominant category in the top location.
  const byLocation = new Map<string, Map<string, number>>();
  for (const i of issues) {
    if (!byLocation.has(i.location)) byLocation.set(i.location, new Map());
    const cats = byLocation.get(i.location)!;
    cats.set(i.category, (cats.get(i.category) || 0) + 1);
  }

  let bestLocation = "";
  let bestCat = "";
  let bestCount = 0;
  for (const [loc, cats] of byLocation) {
    for (const [cat, count] of cats) {
      if (count > bestCount) {
        bestCount = count;
        bestLocation = loc;
        bestCat = cat;
      }
    }
  }

  const area = AREA_HINTS[bestCat] || "underlying system";
  const confidence: RootCauseResult["confidence"] = bestCount >= 4 ? "High" : bestCount >= 2 ? "Medium" : "Low";

  return {
    summary: `Possible underlying problem: ${bestCount} ${bestCat.toLowerCase()} complaint(s) have appeared in ${bestLocation} over the last 30 days.`,
    likelyArea: `${bestLocation} — ${area}`,
    confidence,
    recommendation: `Schedule an inspection of the ${area} in ${bestLocation} before further failures occur.`,
  };
}

/**
 * F6 — Root cause analysis for maintenance staff.
 * Analyzes historical issues to identify possible underlying causes.
 * Uses Gemini when available; otherwise a deterministic cluster fallback.
 */
export async function rootCauseFlow(input: { college?: string } = {}, opts?: { enabled?: boolean }): Promise<RootCauseResult> {
  const issues = await loadRecentIssues(30, input.college);

  if (!aiEnabled(opts?.enabled)) return fallbackRootCause(issues);

  try {
    const ai = await getGenkit();
    const { z } = await import("genkit");

    if (issues.length === 0) return fallbackRootCause(issues);

    const issueTexts = issues
      .map(
        (i) =>
          `Issue ID: ${i.issueNo}\nTitle: ${i.title}\nDescription: ${(i.description || "").slice(0, 500)}\n` +
          `Category: ${i.category}\nLocation: ${i.location}\nStatus: ${i.status}`
      )
      .join("\n---\n")
      .slice(0, 16000);

    const res = await ai.generate({
      model: `googleai/${aiModelName()}`,
      system: `You are a campus maintenance root cause analyst. Analyze patterns in the historical issues and identify possible underlying causes. Be careful and humble: talk about a "possible" root cause, never a definite diagnosis. Return ONLY structured JSON.`,
      prompt: `Recent campus maintenance issues (${issues.length} total):\n\n${issueTexts}`,
      output: {
        schema: z.object({
          summary: z.string(),
          likelyArea: z.string(),
          confidence: z.enum(["Low", "Medium", "High"]),
          recommendation: z.string(),
        }),
        format: "json",
      },
      config: { temperature: 0.3, maxOutputTokens: 1024 },
    });

    const out = res.output as RootCauseResult;
    if (out?.summary && out?.likelyArea && out?.recommendation) return out;
    return fallbackRootCause(issues);
  } catch (e) {
    console.error("rootCauseFlow error, falling back:", e);
    return fallbackRootCause(issues);
  }
}

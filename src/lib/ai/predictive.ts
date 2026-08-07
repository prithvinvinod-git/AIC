import "server-only";

import { adminDb } from "../firebaseAdmin";
import { aiEnabled, aiModelName, getGenkit } from "./genkit";

export interface AtRiskLocation {
  location: string;
  category: string;
  count: number;
  pattern: string;
  risk: "Low" | "Medium" | "High";
  recommendation: string;
}

export interface PredictiveResult {
  locations: AtRiskLocation[];
}

const RISK_HINTS: Record<string, string> = {
  Electrical: "Check wiring, breakers and fixtures for wear.",
  Plumbing: "Inspect pipes, seals and drainage for corrosion or blockages.",
  HouseKeeping: "Review the cleaning schedule and waste handling in the area.",
  IT: "Test network ports, power points and shared equipment.",
  General: "Check doors, fittings and finishes for wear.",
};

function fallbackPredictive(rows: { location: string; category: string }[]): AtRiskLocation[] {
  const byLocCat = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (!byLocCat.has(r.location)) byLocCat.set(r.location, new Map());
    const cats = byLocCat.get(r.location)!;
    cats.set(r.category, (cats.get(r.category) || 0) + 1);
  }

  const out: AtRiskLocation[] = [];
  for (const [location, cats] of byLocCat) {
    for (const [category, count] of cats) {
      const risk: AtRiskLocation["risk"] = count >= 4 ? "High" : count >= 2 ? "Medium" : "Low";
      out.push({
        location,
        category,
        count,
        pattern:
          count >= 2
            ? `Repeated ${category.toLowerCase()} complaints around the same area.`
            : `Single ${category.toLowerCase()} complaint in the last 45 days.`,
        risk,
        recommendation: RISK_HINTS[category] || "Perform a preventive inspection of the area.",
      });
    }
  }

  return out.sort((a, b) => b.count - a.count).slice(0, 10);
}

/**
 * F7 — Predictive maintenance for identifying at-risk locations.
 * Uses Gemini when available; otherwise a deterministic frequency fallback.
 */
export async function predictiveMaintenanceFlow(): Promise<PredictiveResult> {
  const since = new Date();
  since.setDate(since.getDate() - 45);

  const snap = await adminDb()
    .collection("issues")
    .where("createdAt", ">=", since.toISOString())
    .orderBy("createdAt", "desc")
    .limit(1000)
    .get();

  const rows = snap.docs.map((d) => {
    const x = d.data();
    return {
      location: x.location?.name || "Unknown",
      category: x.routing?.categoryName || "Unknown",
      title: x.title || "",
    };
  });

  if (rows.length === 0) return { locations: [] };
  if (!aiEnabled()) return { locations: fallbackPredictive(rows) };

  try {
    const ai = await getGenkit();
    const { z } = await import("genkit");

    const byLocation = new Map<string, string[]>();
    for (const r of rows) {
      if (!byLocation.has(r.location)) byLocation.set(r.location, []);
      byLocation.get(r.location)!.push(`${r.category}: ${r.title}`);
    }
    const locationTexts = [...byLocation.entries()]
      .map(([loc, items]) => `${loc}: ${items.join("; ")}`)
      .join("\n");

    const res = await ai.generate({
      model: `googleai/${aiModelName()}`,
      system: `You are a campus maintenance predictive analyst. Identify locations at risk for future issues based on historical patterns. Be careful: describe patterns and risk, not guarantees. Return ONLY structured JSON (an array). Include 5-10 entries, highest risk first.`,
      prompt: `Campus maintenance issues over the last 45 days grouped by location:\n\n${locationTexts}`,
      output: {
        schema: z.array(
          z.object({
            location: z.string(),
            category: z.string(),
            count: z.number(),
            pattern: z.string(),
            risk: z.enum(["Low", "Medium", "High"]),
            recommendation: z.string(),
          })
        ),
        format: "json",
      },
      config: { temperature: 0.3 },
    });

    const out = res.output as AtRiskLocation[];
    if (Array.isArray(out) && out.length) return { locations: out };
    return { locations: fallbackPredictive(rows) };
  } catch (e) {
    console.error("predictiveMaintenanceFlow error, falling back:", e);
    return { locations: fallbackPredictive(rows) };
  }
}

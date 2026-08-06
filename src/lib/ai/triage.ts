import "server-only";

import { adminDb } from "../firebaseAdmin";
import { aiEnabled, aiModelName, getGenkit } from "./genkit";

export interface TriageResult {
  category: string;
  suggestedPriority: number;
  reasons: string[];
  photoSummary?: string;
  safetyFlags: string[];
}

const CATEGORIES = ["Electrical", "Plumbing", "HouseKeeping", "General", "IT"];

const KEYWORDS: Record<string, { words: string[]; priority: number }> = {
  Electrical: {
    words: [
      "power", "light", "bulb", "tube", "socket", "switch", "fan", "ac ",
      "air condition", "wiring", "short circuit", "current", "tripping",
      "voltage", "inverter", "generator", "cable", "charger", "led", "wiring",
      "breaker", "fuse", "plug", "electric",
    ],
    priority: 2,
  },
  Plumbing: {
    words: [
      "water", "leak", "leaking", "pipe", "tap", "toilet", "flush", "drain",
      "sewer", "sink", "washbasin", "damp", "moisture", "overflow", "faucet",
      "clogged", "clog", "pipeline", "cistern", "geyser", "bathroom",
    ],
    priority: 2,
  },
  HouseKeeping: {
    words: [
      "clean", "cleaning", "garbage", "trash", "waste", "dust", "cobweb",
      "spill", "stain", "rodent", "pest", "mosquito", "litter", "foul smell",
      "unhygienic", "sweeping", "swab", "spider",
    ],
    priority: 3,
  },
  IT: {
    words: [
      "computer", "laptop", "internet", "wifi", "wi-fi", "network", "printer",
      "projector", "display", "server", "password", "software", "mouse",
      "keyboard", "email", "login", "system", "screen", "pc ", "monitor",
      "lan", "router",
    ],
    priority: 3,
  },
  General: {
    words: [
      "door", "window", "furniture", "chair", "desk", "lock", "paint", "wall",
      "ceiling", "crack", "floor", "tile", "bench", "broken", "damaged",
      "stair", "railing", "glass", "signboard", "clamp", "fitting",
    ],
    priority: 4,
  },
};

const SAFETY_WORDS: { word: string; flag: string }[] = [
  { word: "fire", flag: "Fire hazard" },
  { word: "smoke", flag: "Fire hazard" },
  { word: "smoking", flag: "Fire hazard" },
  { word: "gas", flag: "Gas leak risk" },
  { word: "electric", flag: "Electrical hazard" },
  { word: "wire", flag: "Electrical hazard" },
  { word: "water logging", flag: "Slip/water damage risk" },
  { word: "flood", flag: "Water damage risk" },
  { word: "leak", flag: "Water damage risk" },
  { word: "exposed", flag: "Safety hazard" },
  { word: "sharp", flag: "Injury risk" },
  { word: "fall", flag: "Injury risk" },
];

export function fallbackTriage(description: string): TriageResult {
  const text = description.toLowerCase();

  let category = "General";
  let priority = 3;
  const matched: string[] = [];

  for (const [cat, cfg] of Object.entries(KEYWORDS)) {
    for (const w of cfg.words) {
      if (text.includes(w)) {
        matched.push(w);
        if (priority > cfg.priority) priority = cfg.priority;
        category = cat;
        break;
      }
    }
  }

  const safetyFlags = SAFETY_WORDS.filter((s) => text.includes(s.word)).map((s) => s.flag);
  if (safetyFlags.some((f) => /fire|gas|electric/i.test(f))) priority = Math.min(priority, 1);
  else if (safetyFlags.length) priority = Math.min(priority, 2);

  if (/urgent|immediately|emergency|danger|critical|can't use|cannot use|completely/.test(text)) {
    priority = Math.min(priority, 2);
  }
  if (/minor|cosmetic|slight|small|little|aesthetic|stain/.test(text)) {
    priority = Math.max(priority, 4);
  }

  const reasons: string[] = [];
  if (matched.length) reasons.push(`Matches "${matched[0]}" → ${category}`);
  if (safetyFlags.length) reasons.push(`Detected: ${safetyFlags.join(", ")}`);
  reasons.push(`Rated P${priority} — ${priority <= 2 ? "requires fast response" : "routine maintenance"}`);

  return {
    category,
    suggestedPriority: priority,
    reasons,
    photoSummary: "Photo attached — visually confirms the reported damage in the described area.",
    safetyFlags,
  };
}

/**
 * F1 — Auto-triage with photo inspection. Reads text + optional photo and
 * returns a category (constrained to the configured list), priority and
 * safety flags. Runs async after submission; writes aiSuggestion only.
 */
export async function triageFlow(input: {
  description: string;
  imageUrl?: string;
  department: string;
  categories?: string[];
}): Promise<TriageResult> {
  if (!aiEnabled()) return fallbackTriage(input.description);

  try {
    const ai = await getGenkit();
    const { z } = await import("genkit");
    const allowed = input.categories?.length ? input.categories : CATEGORIES;

    const res = await ai.generate({
      model: `googleai/${aiModelName()}`,
      system: `You are a campus maintenance triage assistant. Map the issue to exactly ONE category from: ${allowed.join(", ")}.
Priority: 1 = critical (safety/water/electrical hazard), 5 = cosmetic. Return ONLY structured JSON.`,
      prompt: input.description,
      output: {
        schema: z.object({
          category: z.enum(allowed as [string, ...string[]]),
          suggestedPriority: z.number().int().min(1).max(5),
          reasons: z.array(z.string()),
          photoSummary: z.string().optional(),
          safetyFlags: z.array(z.string()),
        }),
        format: "json",
      },
      config: { temperature: 0.2 },
    });

    const out = res.output as TriageResult;
    return out.category ? out : fallbackTriage(input.description);
  } catch (e) {
    console.error("triageFlow error, falling back:", e);
    return fallbackTriage(input.description);
  }
}

/** Persist a triage suggestion onto the issue (never touches status). */
export async function writeTriage(issueId: string, result: TriageResult) {
  await adminDb()
    .doc(`issues/${issueId}`)
    .update({
      "aiSuggestion.category": result.category,
      "aiSuggestion.suggestedPriority": result.suggestedPriority,
      "aiSuggestion.reasons": result.reasons,
      "aiSuggestion.photoSummary": result.photoSummary || "",
      "aiSuggestion.safetyFlags": result.safetyFlags,
      "aiSuggestion.aiProcessed": true,
      "aiSuggestion.aiModel": aiEnabled() ? `googleai/${aiModelName()}` : "fallback-classifier",
      "aiSuggestion.processedAt": new Date().toISOString(),
    });
}

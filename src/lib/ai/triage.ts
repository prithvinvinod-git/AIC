import "server-only";

import type { Part } from "genkit";
import { adminDb } from "../firebaseAdmin";
import { escalateForSafety } from "../issueMachine";
import { notifyMany } from "../notifications";
import { aiEnabled, getGenkit, triageModelChain } from "./genkit";

export interface TriageResult {
  category: string;
  suggestedPriority: number;
  reasons: string[];
  photoSummary?: string;
  photoQuality?: "relevant" | "irrelevant" | "low_quality" | "mismatch";
  safetyFlags: string[];
  isSpam?: boolean;
  spamReasons?: string[];
  modelUsed?: string;
}

/** Load an uploaded issue image's base64 payload from Firestore.
 *  `imageUrl` is typically `/api/images/{uuid}` → `imageBlobs/{uuid}`. */
async function loadImageBlob(imageUrl?: string): Promise<{ data: string; mimeType: string } | null> {
  if (!imageUrl) return null;
  const m = imageUrl.match(/\/images\/([a-f0-9-]{8,})/i);
  if (!m) return null;
  try {
    const snap = await adminDb().doc(`imageBlobs/${m[1]}`).get();
    if (!snap.exists) return null;
    const d = snap.data();
    if (!d?.data) return null;
    return { data: d.data, mimeType: d.contentType || "image/jpeg" };
  } catch {
    return null;
  }
}

/**
 * Deterministic spam check. Catches the obvious stuff (keyboard mashing,
 * character runs, placeholder/test messages, promotional off-topic content)
 * even when the model call is unavailable or rate-limited. The AI triage
 * prompt handles the subtler cases.
 */
export function spamCheck(text: string): { isSpam: boolean; reasons: string[] } {
  const raw = (text || "").trim();
  const t = raw.toLowerCase().replace(/\s+/g, " ").trim();
  const reasons: string[] = [];
  if (!t) return { isSpam: true, reasons: ["empty description"] };

  const compact = t.replace(/[^a-z0-9]/g, "");
  if (/(.)\1{4,}/.test(compact)) reasons.push("repeated characters (possible keyboard mashing)");

  const words = t.split(/[^a-z0-9]+/).filter(Boolean);

  // Keyboard mashing ("asdf", "asdfjkl", "qwerty"…)
  const KEYMASH = ["asdf", "asdfjkl", "asdfgh", "qwerty", "qwertz", "qwer", "zxcv", "lkjh", "poiu", "fdsa", "hjkl", "asdfghjkl"];
  if (words.some((w) => w.length >= 4 && KEYMASH.some((k) => w.includes(k)))) {
    reasons.push("random keyboard mash detected");
  }

  // Low real-word ratio → gibberish
  const alpha = words.filter((w) => /[a-z]/.test(w));
  const real = alpha.filter((w) => /[aeiouy]/.test(w));
  if (alpha.length >= 3 && real.length / alpha.length < 0.5) {
    reasons.push("low real-word ratio (possible gibberish)");
  }

  // Placeholder / test / filler dominated
  const FILLER = [
    "test", "testing", "tester", "tested", "asdf", "qwerty", "lorem", "ipsum",
    "abc", "xyz", "random", "nothing", "dummy", "fake", "junk", "spam", "blah",
    "lol", "hii", "hiii", "hello", "hey", "hi", "na", "n/a", "none", "filler",
  ];
  const fillerHits = alpha.filter((w) => FILLER.includes(w)).length;
  if (alpha.length > 0 && alpha.length <= 8 && fillerHits >= Math.ceil(alpha.length / 2)) {
    reasons.push("mostly placeholder or filler words");
  }
  if (alpha.length <= 3 && /^(test|testing|asdf|qwerty|lorem|random|nothing|hello|hey|hi+|abc|xyz|spam|lol|filler)([\s,!.]+.*)?$/i.test(t)) {
    reasons.push("looks like a test message");
  }

  // Promotional / off-topic advertising
  const ADS = [
    "discount", "offers", "offer", "promo", "promotion", "limited time", "buy one",
    "get one free", "free", "visit our", "shop", "cheap", "deal", "subscribe",
    "click here", "website", "win", "prize", "bitcoin", "loan", "cash prize",
  ];
  const adHits = ADS.filter((a) => t.includes(a));
  if (adHits.length >= 2) reasons.push(`promotional / off-topic content (${adHits.join(", ")})`);

  // Highly repetitive ("spam spam spam spam")
  const freq: Record<string, number> = {};
  for (const w of alpha) freq[w] = (freq[w] || 0) + 1;
  const topFreq = Math.max(0, ...Object.values(freq));
  if (alpha.length >= 6 && topFreq / alpha.length >= 0.6) reasons.push("highly repetitive content");

  return { isSpam: reasons.length > 0, reasons };
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

export function fallbackTriage(description: string, hasImage = false): TriageResult {
  const spam = spamCheck(description);
  if (spam.isSpam) {
    return {
      category: "General",
      suggestedPriority: 5,
      reasons: [...spam.reasons, "Rated P5 — possible spam, flag for review"],
      safetyFlags: [],
      isSpam: true,
      spamReasons: spam.reasons,
      photoQuality: hasImage ? "irrelevant" : undefined,
    };
  }

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
    photoSummary:
      "Photo attached — an image was provided; visual quality could not be assessed without the AI model.",
    photoQuality: hasImage ? "relevant" : undefined,
    safetyFlags,
  };
}

/**
 * F1 — Auto-triage with photo inspection. Reads text + optional photo and
 * returns a category (constrained to the configured list), priority and
 * safety flags. Runs async after submission; writes aiSuggestion only.
 */
export async function triageFlow(
  input: {
    description: string;
    imageUrl?: string;
    department: string;
    categories?: string[];
  },
  opts?: { triageModel?: string }
): Promise<TriageResult> {
  if (!aiEnabled()) return fallbackTriage(input.description, Boolean(input.imageUrl));

  const ai = await getGenkit();
  const { z } = await import("genkit");
  const allowed = input.categories?.length ? input.categories : CATEGORIES;

  const image = await loadImageBlob(input.imageUrl);

  const schema = z.object({
    category: z.enum(allowed as [string, ...string[]]),
    suggestedPriority: z.number().int().min(1).max(5),
    reasons: z.array(z.string()),
    photoSummary: z.string().optional(),
    photoQuality: z.enum(["relevant", "irrelevant", "low_quality", "mismatch"]).optional(),
    safetyFlags: z.array(z.string()),
    isSpam: z.boolean().optional().default(false),
    spamReasons: z.array(z.string()).optional().default([]),
  });

  // Try a chain of providers/models so a single quota/RateLimit error (429) on
  // one model doesn't silently drop us to the fallback classifier. The
  // admin-configured `config.ai.triageModel` leads the chain when set (AI-4).
  const configured = opts?.triageModel;
  const models = configured ? [configured, ...triageModelChain()] : triageModelChain();
  const promptParts: Part[] = [{ text: input.description }];
  if (image) {
    promptParts.push({ media: { url: `data:${image.mimeType};base64,${image.data}` } });
  }

  for (const model of models) {
    try {
      const res = await ai.generate({
        model,
        system: `You are a campus maintenance triage assistant. Map the issue to exactly ONE category from: ${allowed.join(", ")}.
Priority: 1 = critical (safety/water/electrical hazard), 5 = cosmetic.

First decide if the submission is SPAM: test/placeholder messages, keyboard mashing, gibberish, incoherent text, off-topic advertising or promotions, or content with no real maintenance request. If it is spam, set isSpam=true, add a short explanation to spamReasons, set suggestedPriority=5, and still pick the closest category for filing.

If a photo is provided, inspect it carefully and describe in photoSummary what you actually see: the object(s), damage, condition and surroundings. Compare the photo with the text description and set photoQuality to exactly one of: "relevant" (photo shows the reported issue), "irrelevant" (unrelated to the report — e.g. a screenshot, face/selfie, document or text-only image), "low_quality" (blurry, dark, cut-off or unreadable), or "mismatch" (photo shows something other than what the text describes). Also detect visible hazards (fire, smoke, exposed wiring, gas cylinders, water near electrical equipment, sharp objects, structural damage) and list them in safetyFlags.

If no photo is provided, omit photoSummary and photoQuality. Return ONLY structured JSON.`,
        prompt: promptParts,
        output: { schema, format: "json" },
        config: { temperature: 0.2, maxOutputTokens: 1024 },
      });

      const out = res.output as TriageResult;
      const heur = spamCheck(input.description);
      const aiSpam = Boolean(out.isSpam);
      const spam = heur.isSpam || aiSpam;
      const spamReasons = [...heur.reasons, ...(out.spamReasons || [])];

      if (out.category) {
        return {
          ...out,
          suggestedPriority: spam ? 5 : out.suggestedPriority,
          isSpam: spam,
          spamReasons,
          modelUsed: model,
        };
      }
      return fallbackTriage(input.description, Boolean(input.imageUrl));
    } catch (e) {
      console.error(`triageFlow error on ${model}, trying next:`, e);
    }
  }
  console.error("triageFlow: all models failed, falling back to classifier");
  return fallbackTriage(input.description, Boolean(input.imageUrl));
}

/** Persist a triage suggestion onto the issue (never touches status).
 *  Returns `false` when the issue is already triaged (concurrent create-hook +
 *  manual "Run triage") so the caller can skip duplicate work. The claim +
 *  write happen in one transaction — the `aiProcessed` guard is no longer a
 *  racy read-then-write. */
export async function writeTriage(issueId: string, result: TriageResult): Promise<boolean> {
  const db = adminDb();
  const ref = db.doc(`issues/${issueId}`);
  return await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    if (snap.data()?.aiSuggestion?.aiProcessed) return false;
    tx.update(ref, {
      "aiSuggestion.category": result.category,
      "aiSuggestion.suggestedPriority": result.suggestedPriority,
      "aiSuggestion.reasons": result.reasons,
      "aiSuggestion.photoSummary": result.photoSummary || "",
      "aiSuggestion.photoQuality": result.photoQuality || "",
      "aiSuggestion.safetyFlags": result.safetyFlags,
      "aiSuggestion.isSpam": Boolean(result.isSpam),
      "aiSuggestion.spamReasons": result.spamReasons || [],
      "aiSuggestion.aiProcessed": true,
      "aiSuggestion.aiModel": result.modelUsed || "fallback-classifier",
      "aiSuggestion.processedAt": new Date().toISOString(),
    });
    return true;
  });
}

/**
 * Let the AI own severity while the issue is still NEW: writes the triage
 * priority onto the issue itself (spam → P5) so junk doesn't idle at a
 * reporter-picked P3. Never touches a priority once the validator has acted
 * (status past NEW). Flags spam to the department validators for a quick reject.
 */
export async function applyTriagePriority(issueId: string, result: TriageResult): Promise<void> {
  try {
    const db = adminDb();
    const ref = db.doc(`issues/${issueId}`);
    let applied = false;
    let department = "";
    let issueNo = "";
    // AI-12: the read + the `status == NEW` precondition + the priority write
    // happen in ONE transaction so a just-validated issue can't be overwritten
    // by a racing triage write.
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return;
      const issue = snap.data();
      if (!issue) return;
      if (issue.status !== "NEW") return;

      const target = result.isSpam ? 5 : result.suggestedPriority;
      if (!target || target < 1 || target > 5) return;

      tx.update(ref, {
        priority: target,
        prioritySetBy: { uid: "ai-triage", name: "AI Triage" },
        prioritySetAt: new Date().toISOString(),
      });
      applied = true;
      department = issue.department || "";
      issueNo = issue.issueNo || "";
    });

    if (!applied) return;

    if (result.isSpam) {
      const validatorSnap = await db
        .collection("users")
        .where("role", "==", "validator")
        .where("department", "==", department)
        .get();
      await notifyMany(
        validatorSnap.docs.map((d) => d.id),
        {
          type: "spam",
          title: "Possible spam issue",
          body: `${issueNo || issueId} was flagged as likely spam by AI — review and reject if invalid.`,
          link: `/issues/${issueId}`,
        }
      );
    }

    // Safety hazard on a NEW issue → machine auto-escalates to leadership.
    // Runs after the transaction above completes (it starts its own).
    if (!result.isSpam && result.safetyFlags.length > 0) {
      await escalateForSafety(issueId);
    }
  } catch (e) {
    console.error("applyTriagePriority failed:", e);
  }
}

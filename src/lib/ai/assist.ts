import "server-only";

import { aiEnabled, aiModelName } from "./genkit";

export interface RequirementDraft {
  item: string;
  qty: number;
  needsApproval: boolean;
}

/** Pre-job technician briefing (F4a companion): likely cause, how to stay
 *  safe, what to carry, who should do it, and how long it should take. */
export interface RequestBriefing {
  probableCause: string;
  safetyPrecautions: string[];
  toolsNeeded: string[];
  skillType: string;
  estimatedMinutes: number;
}

/** Deterministic briefing for the no-keys / model-down case. Kept keyword
 *  driven so it still produces useful, category-appropriate guidance. */
function fallbackBriefing(description: string): RequestBriefing {
  const t = description.toLowerCase();

  const safetyPrecautions: string[] = [];
  if (/electric|wire|shock|breaker|fuse|socket|switch/.test(t))
    safetyPrecautions.push("Switch off power to the section before working.");
  if (/gas|fire|smoke/.test(t))
    safetyPrecautions.push("Do not operate switches; ventilate the area and alert campus security.");
  if (/water|tap|pipe|leak|flood|drain|cist|flush/.test(t))
    safetyPrecautions.push("Isolate the water supply before disassembling.");
  if (!safetyPrecautions.length) safetyPrecautions.push("Keep bystanders clear while working.");

  const toolsNeeded = ["Basic hand tools (screwdriver, pliers, wrench)"];
  if (/fan/.test(t)) toolsNeeded.push("Ladder + fan service kit");
  if (/electr|wire|switch|socket|bulb|tube/.test(t)) toolsNeeded.push("Line tester / multimeter");
  if (/pipe|tap|valve|cist|flush|drain/.test(t)) toolsNeeded.push("Pipe wrench, Teflon tape");

  let skillType = "general";
  if (/electr|wire|breaker|fuse|bulb|tube|switch|socket|fan|capacitor/.test(t)) skillType = "electrical";
  else if (/water|tap|valve|pipe|drain|flush|cist|leak|flood/.test(t)) skillType = "plumbing";
  else if (/projector|computer|laptop|network|wifi|printer/.test(t)) skillType = "electronics / IT";

  let probableCause = "Wear and tear in the reported component — verify on site.";
  if (/fan|capacitor/.test(t)) probableCause = "Likely a worn fan capacitor or bearing.";
  else if (/bulb|tube/.test(t)) probableCause = "Likely a failed lamp or tube.";
  else if (/tap|valve|cist|flush/.test(t)) probableCause = "Likely a worn washer, gasket or cistern seal.";
  else if (/pipe|drain|leak|flood/.test(t)) probableCause = "Likely a leak or a blocked drain line.";
  else if (/socket|switch|wire/.test(t)) probableCause = "Likely a loose or failed connection / short circuit.";

  return {
    probableCause,
    safetyPrecautions,
    toolsNeeded,
    skillType,
    estimatedMinutes: safetyPrecautions.length > 1 ? 90 : 45,
  };
}

/**
 * F4a — Extract requirements + a technician briefing from description + photo
 * into a draft `{item, qty, needsApproval}` log and a pre-job briefing.
 * Staff confirm requirements before anything is saved; the briefing is stored
 * on `aiSuggestion.briefing` so the MaintenanceJobCard can display it.
 */
export async function extractRequirementsFlow(input: {
  description: string;
  imageUrl?: string;
}): Promise<{ requirements: RequirementDraft[]; briefing: RequestBriefing }> {
  const text = input.description.toLowerCase();
  const found: RequirementDraft[] = [];

  for (const p of PART_KEYWORDS) {
    if (p.match.some((m) => text.includes(m))) {
      found.push({ item: p.item, qty: p.qty, needsApproval: p.approval });
    }
  }

  if (!found.length) {
    found.push({ item: "Inspection / minor repair", qty: 1, needsApproval: false });
  }

  const briefing = fallbackBriefing(input.description);

  if (aiEnabled()) {
    try {
      const ai = await (await import("./genkit")).getGenkit();
      const { z } = await import("genkit");
      const res = await ai.generate({
        model: `googleai/${aiModelName()}`,
        system:
          "Extract the maintenance parts and quantities needed to fix this campus issue and provide a short pre-job briefing for the technician. " +
          "needsApproval=true for costly items. probableCause: the likely reason, one sentence. safetyPrecautions: 1-3 concrete steps. " +
          "toolsNeeded: only what is plausibly needed. skillType: one of 'general', 'electrical', 'plumbing', 'carpentry', 'housekeeping', 'electronics / IT'. " +
          "estimatedMinutes: a realistic job duration between 5 and 600. Return ONLY structured JSON.",
        prompt: input.description,
        output: {
          schema: z.object({
            requirements: z.array(
              z.object({
                item: z.string(),
                qty: z.number().int().min(0),
                needsApproval: z.boolean(),
              })
            ),
            briefing: z.object({
              probableCause: z.string(),
              safetyPrecautions: z.array(z.string()),
              toolsNeeded: z.array(z.string()),
              skillType: z.string(),
              estimatedMinutes: z.number().int().min(5).max(600),
            }),
          }),
          format: "json",
        },
      });
      const out = res.output as
        | { requirements?: RequirementDraft[]; briefing?: RequestBriefing }
        | null;
      const requirements = out?.requirements?.length ? out.requirements.slice(0, 6) : found;
      const refinedBriefing = out?.briefing?.probableCause ? out.briefing : briefing;
      return { requirements, briefing: refinedBriefing };
    } catch {
      /* keep keyword draft + fallback briefing */
    }
  }

  return { requirements: found, briefing };
}

const PART_KEYWORDS: { match: string[]; item: string; qty: number; approval: boolean }[] = [
  { match: ["stopcock", "cock", "valve"], item: "Valve / stopcock", qty: 1, approval: true },
  { match: ["pipe"], item: "Pipe section", qty: 1, approval: true },
  { match: ["bulb", "led bulb", "tube"], item: "LED bulb / tube light", qty: 1, approval: false },
  { match: ["socket"], item: "Socket", qty: 1, approval: false },
  { match: ["switch", "board"], item: "Switch / switchboard", qty: 1, approval: false },
  { match: ["fan"], item: "Fan", qty: 1, approval: true },
  { match: ["capacitor"], item: "Fan capacitor", qty: 1, approval: false },
  { match: ["tap", "faucet"], item: "Tap / faucet", qty: 1, approval: false },
  { match: ["washer", "gasket"], item: "Washer / gasket", qty: 1, approval: false },
  { match: ["flush", "cistern"], item: "Cistern kit", qty: 1, approval: true },
  { match: ["drain"], item: "Drain cleaning", qty: 1, approval: false },
  { match: ["cable", "wire"], item: "Cable / wiring", qty: 1, approval: true },
  { match: ["adapter", "charger"], item: "Adapter / charger", qty: 1, approval: true },
  { match: ["paint"], item: "Paint (bucket)", qty: 1, approval: true },
  { match: ["tile"], item: "Floor tile", qty: 1, approval: true },
  { match: ["lock"], item: "Lock", qty: 1, approval: false },
  { match: ["handle"], item: "Door handle", qty: 1, approval: false },
  { match: ["glass"], item: "Glass pane", qty: 1, approval: true },
  { match: ["projector"], item: "Projector lamp", qty: 1, approval: true },
  { match: ["carpet", "mat"], item: "Floor mat / carpet", qty: 1, approval: false },
  { match: ["ladder"], item: "Ladder access", qty: 1, approval: false },
];

/**
 * F4b — Draft a structured closure report from a couple of staff bullets.
 */
export async function draftClosureFlow(input: { bullets: string[] }): Promise<string> {
  const bullets = input.bullets.filter((b) => b.trim());
  if (!bullets.length) return "";

  if (aiEnabled()) {
    try {
      const ai = await (await import("./genkit")).getGenkit();
      const { z } = await import("genkit");
      const res = await ai.generate({
        model: `googleai/${aiModelName()}`,
        system:
          "Expand these maintenance notes into a concise structured closure report: work done, parts used, hours spent, and any follow-up. Keep under 120 words.",
        prompt: bullets.join("\n"),
        output: {
          schema: z.object({ report: z.string() }),
          format: "json",
        },
      });
      const r = (res.output as { report: string }).report;
      if (r) return r;
    } catch {
      /* fall through */
    }
  }

  return [
    "Work done:",
    ...bullets.map((b) => `- ${b}`),
    "Parts used: as per requirements log.",
    "Hours spent: to be filled by staff.",
    "Follow-up: monitor the location for recurrence.",
  ].join("\n");
}

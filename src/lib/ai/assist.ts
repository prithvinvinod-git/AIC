import "server-only";

import { aiEnabled, aiModelName } from "./genkit";

export interface RequirementDraft {
  item: string;
  qty: number;
  needsApproval: boolean;
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
 * F4a — Extract requirements from description + photo into a draft
 * `{item, qty, needsApproval}` log. Staff confirm before anything is saved.
 */
export async function extractRequirementsFlow(input: {
  description: string;
  imageUrl?: string;
}): Promise<RequirementDraft[]> {
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

  if (aiEnabled()) {
    try {
      const ai = await (await import("./genkit")).getGenkit();
      const { z } = await import("genkit");
      const res = await ai.generate({
        model: `googleai/${aiModelName()}`,
        system:
          "Extract the maintenance parts and quantities needed to fix this campus issue. needsApproval=true for costly items. Return ONLY structured JSON.",
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
          }),
          format: "json",
        },
      });
      const aiDraft = (res.output as { requirements: RequirementDraft[] }).requirements;
      if (aiDraft?.length) return aiDraft.slice(0, 6);
    } catch {
      /* keep keyword draft */
    }
  }

  return found;
}

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

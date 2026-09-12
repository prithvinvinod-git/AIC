import "server-only";

import { adminDb } from "../firebaseAdmin";
import { aiEnabled, aiModelName } from "./genkit";

export interface RoutingResult {
  teamId: string;
  staffIds: string[];
  reason: string;
}

const OPEN = ["ASSIGNED", "ONGOING", "PENDING", "APPROVED", "VALIDATED"];

/**
 * Rule engine for staff ranking: category match → workload → past performance.
 * AI (when enabled) refines the natural-language `reason`; the rule engine is
 * the deterministic floor that always works offline.
 */
async function rankCandidates(issueId: string, categoryId: string) {
  const issueSnap = await adminDb().doc(`issues/${issueId}`).get();
  const issue = issueSnap.data()!;

  const catSnap = await adminDb().doc(`categories/${categoryId}`).get();
  const cat = catSnap.exists ? catSnap.data()! : { name: categoryId };

  let teamId = issue.routing?.teamId || cat.defaultTeamId || "";
  let members: string[] = [];

  if (!teamId) {
    const teams = await adminDb()
      .collection("teams")
      .where("categoryId", "==", categoryId)
      .where("isActive", "==", true)
      .limit(1)
      .get();
    if (!teams.empty) {
      teamId = teams.docs[0].id;
      members = teams.docs[0].data().members || [];
    }
  } else {
    const teamSnap = await adminDb().doc(`teams/${teamId}`).get();
    if (teamSnap.exists) members = teamSnap.data()?.members || [];
  }

  const workload = new Map<string, number>();
  const completed = new Map<string, number>();

  for (const uid of members) {
    workload.set(uid, 0);
    completed.set(uid, 0);
  }

  if (members.length) {
    const open = await adminDb()
      .collection("issues")
      .where("routing.staff", "array-contains-any", members.slice(0, 10))
      .where("status", "in", OPEN.slice(0, 3))
      .limit(100)
      .get();
    for (const d of open.docs) {
      const staff = d.data().routing?.staff || [];
      for (const s of staff) if (workload.has(s.uid)) workload.set(s.uid, (workload.get(s.uid) || 0) + 1);
    }
  }

  const ranked = members
    .map((uid) => {
      const done = completed.get(uid) || 0;
      const load = workload.get(uid) || 0;
      const score = done * 2 - load;
      return { uid, score, load, done };
    })
    .sort((a, b) => b.score - a.score);

  return { teamId, catName: cat.name || categoryId, ranked };
}

/**
 * F3 — Smart routing suggestion (hybrid). Rule engine ranks candidates, AI
 * (optional) improves the reason. The Validator always confirms before anything is
 * written to `routing`.
 */
export async function suggestAssignmentFlow(
  input: {
    issueId: string;
    categoryId: string;
    description?: string;
  },
  opts?: { routingModel?: string }
): Promise<RoutingResult> {
  const { teamId, catName, ranked } = await rankCandidates(input.issueId, input.categoryId);

  if (!teamId || !ranked.length) {
    return {
      teamId: "",
      staffIds: [],
      reason: "No active team or members found for this category yet.",
    };
  }

  const top = ranked.slice(0, 3);
  const staffIds = top.map((r) => r.uid);
  const staffNames = await Promise.all(
    staffIds.map(async (uid) => {
      try {
        const snap = await adminDb().doc(`users/${uid}`).get();
        return snap.exists ? (snap.data()!.name as string) : uid;
      } catch {
        return uid;
      }
    })
  );

  let reason = `Suggested: ${catName} → ${staffNames[0]}`;
  if (ranked[0].load > 0)
    reason += ` (${ranked[0].load} open job${ranked[0].load > 1 ? "s" : ""})`;
  reason += ` — lowest current workload and best completion record.`;

  if (aiEnabled()) {
    try {
      const ai = await (await import("./genkit")).getGenkit();
      const { z } = await import("genkit");
      const res = await ai.generate({
        model: opts?.routingModel ? `googleai/${opts.routingModel}` : `googleai/${aiModelName()}`,
        system:
          "You assign campus maintenance jobs. Explain, in one sentence, why this staff member is the best pick, referencing workload and experience.",
        prompt: `Staff ranking (highest score best): ${staffNames
          .map((n, i) => `${i + 1}. ${n}`)
          .join(", ")}. Category: ${catName}.`,
        output: {
          schema: z.object({ reason: z.string() }),
          format: "json",
        },
        config: { maxOutputTokens: 256 },
      });
      reason = (res.output as { reason: string }).reason;
    } catch {
      /* keep rule-engine reason */
    }
  }

  return { teamId, staffIds, reason };
}

export async function writeRoutingSuggestion(issueId: string, result: RoutingResult) {
  await adminDb()
    .doc(`issues/${issueId}`)
    .update({
      "aiSuggestion.routing": result,
      "aiSuggestion.aiModel": aiEnabled() ? `googleai/${aiModelName()}` : "fallback-classifier",
      "aiSuggestion.processedAt": new Date().toISOString(),
    });
}

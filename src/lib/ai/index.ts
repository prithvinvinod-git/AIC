import "server-only";

import { adminDb } from "../firebaseAdmin";
import { loadConfig } from "../issueMachine";
import { triageFlow, writeTriage, applyTriagePriority } from "./triage";
import { findDuplicatesFlow, writeDuplicates } from "./duplicates";
import { suggestAssignmentFlow, writeRoutingSuggestion } from "./routing";
import { extractRequirementsFlow } from "./assist";
import { draftClosureFlow } from "./assist";
import { weeklyInsightsFlow, writeWeeklyInsights } from "./insights";
import { rootCauseFlow } from "./rootCause";
import { predictiveMaintenanceFlow } from "./predictive";
import { slaExplainFlow, writeSlaExplanation } from "./slaExplain";

export { triageFlow, writeTriage, applyTriagePriority };
export { findDuplicatesFlow, writeDuplicates };
export { suggestAssignmentFlow, writeRoutingSuggestion };
export { extractRequirementsFlow, draftClosureFlow };
export { weeklyInsightsFlow, writeWeeklyInsights };
export { rootCauseFlow };
export { predictiveMaintenanceFlow };
export { slaExplainFlow, writeSlaExplanation };

export async function getActiveCategories(): Promise<string[]> {
  try {
    const snap = await adminDb()
      .collection("categories")
      .where("isActive", "==", true)
      .get();
    const names = snap.docs.map((d) => d.data().name as string).filter(Boolean);
    return names.length ? names : ["Electrical", "Plumbing", "HouseKeeping", "General", "IT"];
  } catch {
    return ["Electrical", "Plumbing", "HouseKeeping", "General", "IT"];
  }
}

/**
 * Background pipeline fired right after an issue is created:
 *   1. triage (category + priority + photo brief + safety flags)
 *   2. duplicate / similar-issue detection
 * Each step writes into issue.aiSuggestion — never status.
 * The `aiProcessed` flag prevents re-runs (cost control).
 */
export async function runAiOnCreate(issueId: string): Promise<void> {
  try {
    const db = adminDb();
    const snap = await db.doc(`issues/${issueId}`).get();
    if (!snap.exists) return;
    const issue = snap.data()!;
    if (issue.aiSuggestion?.aiProcessed && issue.aiSuggestion?.duplicatesProcessed) return;

    // AI-4: flows honor the persisted config.ai.* values.
    const config = await loadConfig(db);
    const threshold = config.ai?.threshold ?? 0.45;

    const imageUrl = issue.images?.[0]?.url;
    const categories = await getActiveCategories();

    if (!issue.aiSuggestion?.aiProcessed) {
      const triage = await triageFlow(
        {
          description: issue.description || "",
          imageUrl,
          department: issue.department || "",
          categories,
        },
        { triageModel: config.ai?.triageModel, enabled: config.ai?.enabled }
      );
      // Transactional claim — if a manual "Run triage" won the race, skip the
      // rest so we don't re-run priorities, re-flag spam or re-scan duplicates.
      const claimed = await writeTriage(issueId, triage);
      if (claimed) {
        // AI owns severity while the issue is still NEW (spam → P5).
        await applyTriagePriority(issueId, triage);
      }
    }

    // AI-8: duplicates are independently guarded — a triage success followed
    // by a duplicates failure no longer blocks a later backfill.
    if (!issue.aiSuggestion?.duplicatesProcessed) {
      const dupe = await findDuplicatesFlow({
        issueId,
        description: issue.description || "",
        location: issue.location?.name || "",
        threshold,
        college: issue.college || undefined,
      });
      await writeDuplicates(issueId, dupe);
    }
  } catch (e) {
    console.error("runAiOnCreate failed:", e);
  }
}

/** F3 helper — computes and persists a routing suggestion for the Validator. */
export async function runRoutingSuggestion(issueId: string, categoryId: string): Promise<void> {
  try {
    const result = await suggestAssignmentFlow({ issueId, categoryId });
    await writeRoutingSuggestion(issueId, result);
  } catch (e) {
    console.error("runRoutingSuggestion failed:", e);
  }
}

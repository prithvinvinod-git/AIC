import "server-only";

import { adminDb } from "../firebaseAdmin";
import { triageFlow, writeTriage } from "./triage";
import { findDuplicatesFlow, writeDuplicates } from "./duplicates";
import { suggestAssignmentFlow, writeRoutingSuggestion } from "./routing";
import { extractRequirementsFlow } from "./assist";
import { draftClosureFlow } from "./assist";
import { weeklyInsightsFlow, writeWeeklyInsights } from "./insights";
import { rootCauseFlow } from "./rootCause";
import { predictiveMaintenanceFlow } from "./predictive";

export { triageFlow, writeTriage };
export { findDuplicatesFlow, writeDuplicates };
export { suggestAssignmentFlow, writeRoutingSuggestion };
export { extractRequirementsFlow, draftClosureFlow };
export { weeklyInsightsFlow, writeWeeklyInsights };
export { rootCauseFlow };
export { predictiveMaintenanceFlow };

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
    const snap = await adminDb().doc(`issues/${issueId}`).get();
    if (!snap.exists) return;
    const issue = snap.data()!;
    if (issue.aiSuggestion?.aiProcessed) return;

    const imageUrl = issue.images?.[0]?.url;
    const categories = await getActiveCategories();

    const triage = await triageFlow({
      description: issue.description || "",
      imageUrl,
      department: issue.department || "",
      categories,
    });
    await writeTriage(issueId, triage);

    const dupe = await findDuplicatesFlow({
      issueId,
      description: issue.description || "",
      location: issue.location?.name || "",
      threshold: 0.45,
    });
    await writeDuplicates(issueId, dupe);
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

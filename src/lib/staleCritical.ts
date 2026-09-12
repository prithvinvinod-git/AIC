import "server-only";

import { adminDb } from "./firebaseAdmin";
import { applyTransition } from "./issueMachine";
import { escalationBand, escalationReviewerLabel } from "./escalationBand";
import { notifyMany, notifyRole } from "./notifications";
import type { Issue, Role } from "./types";

/** A P1–2 issue may sit in NEW this long before the system forces escalation. */
export const STALE_NEW_MS = 24 * 60 * 60 * 1000;

const AUTO_ESCALATOR = {
  uid: "system:auto-escalate",
  name: "Servox Auto-Escalation",
  role: "admin" as const,
};

/** In-app notification to every active user of the given roles within a
 *  department (validator/HOD are department-scoped). Uses one collection scan
 *  + in-memory filter so no extra composite index is required. */
async function notifyDepartment(
  roles: Role[],
  department: string,
  input: { type: "issue"; title: string; body: string; link: string }
): Promise<void> {
  try {
    const snap = await adminDb()
      .collection("users")
      .where("isActive", "==", true)
      .get();
    const uids = snap.docs
      .filter((d) => {
        const data = d.data();
        if (!roles.includes(data.role as Role)) return false;
        return (data.department as string | undefined) === department;
      })
      .map((d) => d.id);
    await notifyMany(uids, input);
  } catch (e) {
    // Notifications must never break the primary flow.
    console.error("staleCritical: department notify failed", e);
  }
}

/**
 * Scheduled scan: P1–2 issues still in `NEW` after `STALE_NEW_MS` (no validator
 * attention) are forced through the state machine's normal VALIDATED →
 * auto-ESCALATED cascade. The machine owns the move — this job just supplies
 * the synthetic admin actor and then alerts everyone.
 */
export async function runStaleCriticalScan(): Promise<number> {
  const db = adminDb();
  const now = Date.now();
  const cutoff = new Date(now - STALE_NEW_MS).toISOString();

  const snap = await db.collection("issues").where("status", "==", "NEW").get();
  const candidates: { id: string; issue: Issue }[] = [];

  for (const doc of snap.docs) {
    const issue = { id: doc.id, ...(doc.data() as Issue) } as Issue;
    // W-21: `priority` `0` means "reporter never chose one" — treat it as
    // unset, not critical. Only genuinely flagged P1–2 issues escalate.
    const prio = issue.priority ?? 0;
    if (!(prio >= 1 && prio <= 2)) continue;
    // If the AI already weighed in that this is non-critical, defer to it.
    const aiPrio = issue.aiSuggestion?.suggestedPriority ?? 0;
    if (aiPrio >= 1 && aiPrio > 2) continue;
    if (issue.escalation?.required) continue;
    const createdAt = new Date(issue.createdAt).getTime();
    if (!Number.isFinite(createdAt) || createdAt > new Date(cutoff).getTime()) continue;
    candidates.push({ id: doc.id, issue });
  }

  let escalated = 0;
  for (const { id, issue } of candidates) {
    try {
      // Pushing through the machine (not writing status directly) so the
      // timeline, SLA state, and auto-cascade stay consistent.
      const updated = await applyTransition(id, AUTO_ESCALATOR, {
        to: "VALIDATED",
        priority: issue.priority,
        note: "Auto-escalated: critical issue was not validated within 24 hours",
        isAuto: true,
      });

      const issueNo = updated.issueNo || id;
      const link = `/issues/${id}`;
      const staffTitle = "Critical issue auto-escalated";
      const reviewer = escalationReviewerLabel(issue.priority);
      const staffBody = `${issueNo} wasn't actioned within 24 hours and was escalated for ${reviewer} review.`;

      // Dept validators always; the severity approver (P1 → Principal, P2 →
      // HOD) gets the decision alert. HOD is department-scoped.
      await notifyDepartment(["validator"], issue.department, {
        type: "issue",
        title: staffTitle,
        body: staffBody,
        link,
      });
      if (escalationBand(issue.priority) === "principal") {
        await notifyRole(["principal"], {
          type: "issue",
          title: staffTitle,
          body: staffBody,
          link,
        });
      } else {
        await notifyDepartment(["hod"], issue.department, {
          type: "issue",
          title: staffTitle,
          body: staffBody,
          link,
        });
      }
      if (issue.reporter?.uid) {
        await notifyMany([issue.reporter.uid], {
          type: "issue",
          title: "Your issue needs urgent attention",
          body: `${issueNo} wasn't validated within 24 hours and was auto-escalated to ${reviewer}.`,
          link,
        });
      }

      escalated += 1;
    } catch (e) {
      console.error(`staleCritical: failed for ${id}:`, e);
    }
  }
  return escalated;
}
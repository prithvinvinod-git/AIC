import "server-only";

import { adminDb } from "./firebaseAdmin";
import { applyTransition, loadConfig } from "./issueMachine";
import { notify } from "./notifications";
import type { Issue } from "./types";

/**
 * Scheduled scan: close `VERIFIED` issues whose feedback grace period has
 * elapsed without a rating. The state machine already supports auto-closes
 * (`isAuto` skips the mandatory rating), so this job simply wires that rule
 * to a real deadline anchored on the verification timestamp.
 */
export async function runAutoCloseJob(): Promise<number> {
  const db = adminDb();
  const config = await loadConfig(db);
  const graceMs = (config.feedbackGraceHours ?? 24) * 60 * 60 * 1000;
  const now = Date.now();

  const snap = await db.collection("issues").where("status", "==", "VERIFIED").get();
  const candidates: { id: string; issue: Issue }[] = [];

  for (const doc of snap.docs) {
    const issue = { id: doc.id, ...(doc.data() as Issue) };
    const anchor = issue.verification?.verifiedAt || issue.updatedAt;
    const t = new Date(anchor).getTime();
    if (!Number.isFinite(t)) continue;
    if (now - t < graceMs) continue;
    candidates.push({ id: doc.id, issue });
  }

  let closed = 0;
  for (const { id, issue } of candidates) {
    try {
      const actor = {
        uid: issue.reporter?.uid || "system",
        name: issue.reporter?.name || "system",
        role: "reporter" as const,
      };
      const updated = await applyTransition(id, actor, { to: "CLOSED", isAuto: true });
      const issueNo = updated.issueNo || id;

      if (issue.reporter?.uid) {
        await notify(issue.reporter.uid, {
          type: "issue",
          title: "Issue auto-closed",
          body: `${issueNo} was closed automatically — no rating was submitted within the feedback grace period.`,
          link: `/issues/${id}`,
        });
      }
      closed += 1;
    } catch (e) {
      console.error(`autoClose: failed for ${id}:`, e);
    }
  }
  return closed;
}

import "server-only";

import { adminDb } from "./firebaseAdmin";
import type { Issue, Role } from "./types";

export interface NotificationInput {
  type: string;
  title: string;
  body: string;
  link: string;
}

export async function notify(uid: string, input: NotificationInput): Promise<void> {
  try {
    await adminDb().collection(`notifications/${uid}/items`).add({
      ...input,
      isRead: false,
      at: new Date().toISOString(),
    });
  } catch (e) {
    // Notifications must never break the primary flow.
    console.error("notify failed", uid, e);
  }
}

export async function notifyMany(uids: string[], input: NotificationInput): Promise<void> {
  await Promise.allSettled([...new Set(uids)].map((uid) => notify(uid, input)));
}

/** Notify every active user holding one of the given roles. */
export async function notifyRole(roles: Role[], input: NotificationInput): Promise<void> {
  try {
    const snap = await adminDb()
      .collection("users")
      .where("isActive", "==", true)
      .get();
    const uids = snap.docs
      .filter((d) => roles.includes(d.data().role as Role))
      .map((d) => d.id);
    await notifyMany(uids, input);
  } catch (e) {
    console.error("notifyRole failed", e);
  }
}

/** Compact notification body creator used across transition handlers. */
export function notifyRecipientsForIssue(issue: Issue, oldStatus: string, newStatus: string) {
  const link = `/issues/${issue.id}`;
  const recipients: { uid: string; input: NotificationInput }[] = [];

  const toReporter = (title: string, body: string) =>
    recipients.push({
      uid: issue.reporter?.uid,
      input: { type: "issue", title, body, link },
    });

  switch (newStatus) {
    case "REJECTED":
      toReporter("Issue rejected", `Your issue ${issue.issueNo} was rejected: ${issue.rejection?.reason || ""}`);
      break;
    case "VALIDATED":
      notifyRole(["validator"], {
        type: "issue",
        title: "Issue validated",
        body: `${issue.issueNo} validated with priority ${issue.priority}.`,
        link,
      });
      break;
    case "ESCALATED":
      toReporter("Issue escalated", `${issue.issueNo} escalated for HOD/Principal review.`);
      notifyRole(["hod", "principal"], {
        type: "escalation",
        title: "Escalation needs review",
        body: `${issue.issueNo} (P${issue.priority}) needs severity confirmation.`,
        link,
      });
      break;
    case "APPROVED":
      toReporter("Issue approved", `${issue.issueNo} approved — routing next.`);
      break;
    case "ASSIGNED":
      toReporter("Issue assigned", `${issue.issueNo} assigned to a maintenance team.`);
      notifyRole(["validator", "maintenance"], {
        type: "assignment",
        title: "New job assigned",
        body: `${issue.issueNo} routed to ${issue.routing?.categoryName || "team"}.`,
        link,
      });
      break;
    case "ONGOING":
      toReporter("Work started", `${issue.issueNo} is being worked on.`);
      break;
    case "PENDING":
      toReporter("Issue on hold", `${issue.issueNo} is pending a blocker.`);
      notifyRole(["validator"], {
        type: "pending",
        title: "Pending issue needs reassignment",
        body: `${issue.issueNo} hit a blocker — reassign from the queue.`,
        link,
      });
      break;
    case "COMPLETED":
      notifyRole(["validator"], {
        type: "verification",
        title: "Verification needed",
        body: `${issue.issueNo} completed — verify the work.`,
        link,
      });
      break;
    case "VERIFIED":
      toReporter("Issue verified", `${issue.issueNo} is verified. Please rate the resolution.`);
      break;
    case "CLOSED":
      if (oldStatus === "VERIFIED") {
        notifyRole(["validator"], {
          type: "issue",
          title: "Issue closed",
          body: `${issue.issueNo} closed with rating ${issue.feedback?.rating}/5.`,
          link,
        });
      }
      break;
    default:
      break;
  }

  if (recipients.length) {
    return Promise.allSettled(
      recipients
        .filter((r) => r.uid)
        .map((r) => notify(r.uid, r.input))
    ).then(() => undefined);
  }
  return Promise.resolve();
}

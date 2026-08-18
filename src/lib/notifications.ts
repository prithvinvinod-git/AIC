import "server-only";

import { adminDb, adminApp } from "./firebaseAdmin";
import { getMessaging } from "firebase-admin/messaging";
import type { Issue, Role } from "./types";

export interface NotificationInput {
  type: string;
  title: string;
  body: string;
  link: string;
}

/** Best-effort FCM push — never breaks the flow. */
async function sendPushNotification(
  uid: string,
  title: string,
  body: string,
  link: string,
  type: string
): Promise<void> {
  try {
    const userDoc = await adminDb().doc(`users/${uid}`).get();
    const data = userDoc.data();
    if (!data?.fcmToken || data?.pushEnabled === false) return;

    await getMessaging(adminApp()).send({
      token: data.fcmToken,
      notification: { title, body },
      data: { link, type },
      android: {
        priority: "high",
        ttl: 4 * 60 * 60 * 1000, // 4 hours
      },
      webpush: {
        notification: {
          icon: "/servoxlogo.png",
          badge: "/servoxlogo.png",
          tag: `servox-${type}`,
          renotify: true,
        },
        fcmOptions: { link },
      },
    });
  } catch (e: unknown) {
    // Token may be stale — clear it so the client can re-register next visit.
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("registration-token-not-registered") || msg.includes("Invalid registration token")) {
      await adminDb().doc(`users/${uid}`).set({ fcmToken: null }, { merge: true }).catch(() => {});
    }
    // Never throw — push is best-effort.
  }
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

  // Fire-and-forget push — don't await, don't block.
  void sendPushNotification(uid, input.title, input.body, input.link, input.type);
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
    case "ROUTED":
      toReporter("Issue with maintenance head", `${issue.issueNo} is with the maintenance head for dispatch.`);
      if (issue.routing?.maintenanceHeadUid) {
        notify(issue.routing.maintenanceHeadUid, {
          type: "assignment",
          title: "New issue to dispatch",
          body: `${issue.issueNo} routed to you — forward to the right team.`,
          link,
        });
      } else {
        notifyRole(["maintenance_head"], {
          type: "assignment",
          title: "New issue to dispatch",
          body: `${issue.issueNo} needs dispatch to a maintenance team.`,
          link,
        });
      }
      break;
    case "PENDING_ASSIGN":
      toReporter("Issue ready for assignment", `${issue.issueNo} is being dispatched to a maintenance team.`);
      if (issue.routing?.categoryHeadUid) {
        notify(issue.routing.categoryHeadUid, {
          type: "assignment",
          title: "Assign workers",
          body: `${issue.issueNo} forwarded to ${issue.routing?.categoryName || "your category"} — assign a team.`,
          link,
        });
      }
      notifyRole(["maintenance_head"], {
        type: "assignment",
        title: "Issue forwarded",
        body: `${issue.issueNo} forwarded to ${issue.routing?.categoryName || "a category"}.`,
        link,
      });
      break;
    case "ASSIGNED":
      toReporter("Issue assigned", `${issue.issueNo} assigned to a maintenance team.`);
      notifyRole(["validator"], {
        type: "assignment",
        title: "New job assigned",
        body: `${issue.issueNo} routed to ${issue.routing?.categoryName || "team"}.`,
        link,
      });
      /* Notify assigned staff directly */
      if (issue.routing?.staff?.length) {
        for (const s of issue.routing.staff) {
          notify(s.uid, {
            type: "assignment",
            title: "New job assigned to you",
            body: `${issue.issueNo} — ${issue.routing?.categoryName || "team"}. ${issue.title}`,
            link,
          });
        }
      }
      break;
    case "ONGOING":
      if (oldStatus === "COMPLETED" || oldStatus === "INSPECTED" || oldStatus === "HEAD_APPROVED") {
        toReporter("Work revised", `${issue.issueNo} was sent back for revision.`);
      } else {
        toReporter("Work started", `${issue.issueNo} is being worked on.`);
      }
      break;
    case "PENDING":
      toReporter("Issue on hold", `${issue.issueNo} is pending a blocker.`);
      if (issue.routing?.categoryHeadUid) {
        notify(issue.routing.categoryHeadUid, {
          type: "pending",
          title: "Pending issue needs reassignment",
          body: `${issue.issueNo} hit a blocker — reassign or escalate.`,
          link,
        });
      }
      notifyRole(["maintenance_head", "validator"], {
        type: "pending",
        title: "Pending issue needs attention",
        body: `${issue.issueNo} hit a blocker — reassign from the queue.`,
        link,
      });
      break;
    case "COMPLETED":
      toReporter("Work completed", `${issue.issueNo} has been completed and is awaiting verification.`);
      if (issue.routing?.categoryHeadUid) {
        notify(issue.routing.categoryHeadUid, {
          type: "verification",
          title: "In-site verification needed",
          body: `${issue.issueNo} completed — verify the work on site.`,
          link,
        });
      } else {
        notifyRole(["category_head"], {
          type: "verification",
          title: "In-site verification needed",
          body: `${issue.issueNo} completed — verify the work on site.`,
          link,
        });
      }
      break;
    case "INSPECTED":
      toReporter("Work inspected", `${issue.issueNo} passed the on-site inspection.`);
      if (issue.routing?.maintenanceHeadUid) {
        notify(issue.routing.maintenanceHeadUid, {
          type: "verification",
          title: "Head approval needed",
          body: `${issue.issueNo} inspected — approve the completed work.`,
          link,
        });
      } else {
        notifyRole(["maintenance_head"], {
          type: "verification",
          title: "Head approval needed",
          body: `${issue.issueNo} inspected — approve the completed work.`,
          link,
        });
      }
      break;
    case "HEAD_APPROVED":
      notifyRole(["validator"], {
        type: "verification",
        title: "Final verification needed",
        body: `${issue.issueNo} approved by the maintenance head — do the final check.`,
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

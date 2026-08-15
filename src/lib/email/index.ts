import "server-only";

import { adminDb } from "../firebaseAdmin";
import { mailEnabled, sendMail } from "./client";
import { getRecipientEmails, getTeamEmails } from "./recipients";
import { approvedTemplate, feedbackTemplate, jobAssignmentTemplate, reportedTemplate } from "./templates";
import type { Issue } from "../types";

const db = adminDb();

/** New issue email — P1–2 reaches principal + dept HOD + dept validator,
 *  P3–5 reaches the dept validator only. */
export async function sendIssueReportedEmail(issue: Issue, priority: number): Promise<void> {
  if (!mailEnabled()) return;
  const dept = issue.department;
  const urgent = priority >= 1 && priority <= 2;
  const recipients = urgent
    ? [
        ...(await getRecipientEmails(["principal"])),
        ...(await getRecipientEmails(["hod"], dept)),
        ...(await getRecipientEmails(["validator"], dept)),
      ]
    : await getRecipientEmails(["validator"], dept);

  const t = reportedTemplate(issue, priority);
  await sendMail({
    to: recipients,
    subject: `${urgent ? "URGENT · " : ""}New issue reported — ${issue.issueNo}`,
    html: t.html,
    text: t.text,
  });
}

/** Approval email — dept HOD + all principals. Rejections never email. */
export async function sendIssueApprovedEmail(issue: Issue): Promise<void> {
  if (!mailEnabled()) return;
  const recipients = [
    ...(await getRecipientEmails(["hod"], issue.department)),
    ...(await getRecipientEmails(["principal"])),
  ];
  const t = approvedTemplate(issue);
  await sendMail({
    to: recipients,
    subject: `Issue approved — ${issue.issueNo}`,
    html: t.html,
    text: t.text,
  });
}

/** Job assignment email — the assigned team + staff, with the SLA card. */
export async function sendJobAssignmentEmail(issue: Issue): Promise<void> {
  if (!mailEnabled()) return;
  const staffUids = (issue.routing?.staff || []).map((s) => s.uid);
  const recipients = issue.routing?.teamId
    ? await getTeamEmails(issue.routing.teamId, staffUids)
    : await getTeamEmails("", staffUids);

  const t = jobAssignmentTemplate(issue);
  await sendMail({
    to: recipients,
    subject: `New job assigned — ${issue.issueNo}`,
    html: t.html,
    text: t.text,
  });
}

/** Feedback email — after a reporter rates a closed issue (or an issue
 *  auto-closes): the assigned team/staff + the department validator get the
 *  outcome. Manual closes carry the rating; auto-closes note the miss. */
export async function sendFeedbackEmail(issue: Issue): Promise<void> {
  if (!mailEnabled()) return;
  const staffUids = (issue.routing?.staff || []).map((s) => s.uid);
  const teamRecipients = issue.routing?.teamId
    ? await getTeamEmails(issue.routing.teamId, staffUids)
    : await getTeamEmails("", staffUids);
  const validatorRecipients = await getRecipientEmails(["validator"], issue.department);
  const recipients = [...new Set([...teamRecipients, ...validatorRecipients])];
  if (recipients.length === 0) return;

  const rated = (issue.feedback?.rating || 0) > 0;
  const t = feedbackTemplate(issue);
  await sendMail({
    to: recipients,
    subject: `${rated ? "Feedback received" : "Issue closed"} — ${issue.issueNo}`,
    html: t.html,
    text: t.text,
  });
}

const REMINDER_WINDOW_MS = 2 * 60 * 60 * 1000;
const REMINDER_COOLDOWN_MS = 12 * 60 * 60 * 1000;

/** Cron-driver: email the team when a job's SLA resolution deadline is within
 *  the window or already breached. Cooldown prevents reminder spam. */
export async function sendSlaReminderEmails(): Promise<number> {
  if (!mailEnabled()) return 0;
  const snap = await db.collection("issues").where("status", "in", ["ASSIGNED", "ONGOING"]).get();
  const now = Date.now();
  let sent = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const sla = data.sla;
    if (!sla?.resolutionDeadline) continue;
    const deadline = new Date(sla.resolutionDeadline).getTime();
    if (!Number.isFinite(deadline)) continue;

    const lastReminder = sla.emailReminderAt ? new Date(sla.emailReminderAt).getTime() : 0;
    if (lastReminder && now - lastReminder < REMINDER_COOLDOWN_MS) continue;

    const breached = now > deadline || sla.breachedFlags?.resolution === true;
    if (!breached && deadline - now > REMINDER_WINDOW_MS) continue;

    const issue = { id: doc.id, ...data } as Issue;
    const staffUids = (issue.routing?.staff || []).map((s) => s.uid);
    const to = issue.routing?.teamId
      ? await getTeamEmails(issue.routing.teamId, staffUids)
      : await getTeamEmails("", staffUids);
    if (to.length === 0) continue;

    const t = jobAssignmentTemplate(issue);
    await sendMail({
      to,
      subject: `SLA ${breached ? "BREACHED" : "deadline approaching"} — ${issue.issueNo}`,
      html: t.html,
      text: t.text,
    });
    await db.doc(`issues/${doc.id}`).update({ "sla.emailReminderAt": new Date().toISOString() });
    sent += 1;
  }
  return sent;
}

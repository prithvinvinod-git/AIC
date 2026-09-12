import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import type { ZodSchema } from "zod";
import { adminDb } from "./firebaseAdmin";
import { requireAuth } from "./auth";
import { json, parseBody, handleError } from "./api";
import { isRateLimited } from "./rateLimit";
import { applyTransition } from "./issueMachine";
import { notifyRecipientsForIssue } from "./notifications";
import type { Issue } from "./types";
import type { TransitionInput } from "./issueMachine";

/**
 * Shared driver for every status-mutating endpoint: verify the ID token,
 * validate the body, run the state machine inside a transaction, then fire
 * the notification matrix. The only door through which `status` changes.
 *
 * `preParsed` lets callers that already consumed the request body (a body
 * stream can only be read once) hand over the validated payload.
 */
export async function runTransition(
  req: NextRequest,
  issueId: string,
  schema: ZodSchema<Record<string, unknown>>,
  toOverride?: Issue["status"],
  preParsed?: Record<string, unknown>
): Promise<NextResponse> {
  try {
    const user = await requireAuth(req);
    if (isRateLimited(`transition:${user.uid}`, { limit: 120, windowMs: 60_000 })) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down and try again." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }
    const body = preParsed ?? (await parseBody(req, schema));

    const beforeSnap = await adminDb().doc(`issues/${issueId}`).get();
    if (!beforeSnap.exists) return json({ error: "Issue not found." }, 404);
    const before = beforeSnap.data() as Issue;

    const issue = (await applyTransition(
      issueId,
      {
        uid: user.uid,
        name: user.name,
        role: user.role,
        college: user.college,
        department: user.department,
      },
      { ...body, ...(toOverride ? { to: toOverride } : {}) } as TransitionInput
    )) as Issue;

    void notifyRecipientsForIssue(issue, before.status, issue.status);
    const out = { ...issue } as Issue & { trackingToken?: string };
    delete out.trackingToken;

    // Best-effort emails keyed on the final status. Approvals reach HOD +
    // Principal; assignments reach the maintenance team; a CLOSED issue tells
    // the staff + dept validator the feedback outcome. Rejections never email.
    // Any send failure is logged — never allowed to break the transition.
    after(async () => {
      try {
        if (issue.status === "APPROVED") {
          await import("@/lib/email").then((m) => m.sendIssueApprovedEmail(issue));
        } else if (issue.status === "ASSIGNED") {
          await import("@/lib/email").then((m) => m.sendJobAssignmentEmail(issue));
        } else if (issue.status === "CLOSED") {
          await import("@/lib/email").then((m) => m.sendFeedbackEmail(issue));
        }
      } catch (e) {
        const { logError } = await import("@/lib/errorLog");
        await logError(e, { source: "after-transition-email", issueId });
      }
    });

    return json({ issue: out });
  } catch (e) {
    return handleError(e);
  }
}

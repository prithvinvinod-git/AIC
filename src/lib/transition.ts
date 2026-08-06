import "server-only";

import { NextRequest, NextResponse } from "next/server";
import type { ZodSchema } from "zod";
import { adminDb } from "./firebaseAdmin";
import { requireAuth } from "./auth";
import { json, parseBody, handleError } from "./api";
import { applyTransition } from "./issueMachine";
import { notifyRecipientsForIssue } from "./notifications";
import type { Issue } from "./types";
import type { TransitionInput } from "./issueMachine";

/**
 * Shared driver for every status-mutating endpoint: verify the ID token,
 * validate the body, run the state machine inside a transaction, then fire
 * the notification matrix. The only door through which `status` changes.
 */
export async function runTransition(
  req: NextRequest,
  issueId: string,
  schema: ZodSchema<Record<string, unknown>>,
  toOverride?: Issue["status"]
): Promise<NextResponse> {
  try {
    const user = await requireAuth(req);
    const body = await parseBody(req, schema);

    const beforeSnap = await adminDb().doc(`issues/${issueId}`).get();
    if (!beforeSnap.exists) return json({ error: "Issue not found." }, 404);
    const before = beforeSnap.data() as Issue;

    const issue = (await applyTransition(
      issueId,
      { uid: user.uid, name: user.name, role: user.role },
      { ...body, ...(toOverride ? { to: toOverride } : {}) } as TransitionInput
    )) as Issue;

    void notifyRecipientsForIssue(issue, before.status, issue.status);

    return json({ issue });
  } catch (e) {
    return handleError(e);
  }
}

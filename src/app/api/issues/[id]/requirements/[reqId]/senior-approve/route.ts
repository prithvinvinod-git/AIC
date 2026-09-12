import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/auth";
import { json, handleError } from "@/lib/api";
import { isRateLimited } from "@/lib/rateLimit";
import { notify, notifyRole } from "@/lib/notifications";
import { pendingCount, seniorPendingCount, writePurchaseRecord } from "@/lib/purchase";
import type { Issue, Requirement, Role } from "@/lib/types";

const ALLOWED_ROLES: Role[] = ["hod", "principal", "admin"];

/** POST /api/issues/[id]/requirements/[reqId]/senior-approve — HOD/Principal/Admin
 *  finalizes an over-limit purchase submitted by the purchase team. */
export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/issues/[id]/requirements/[reqId]/senior-approve">
): Promise<NextResponse> {
  try {
    const { id, reqId } = await ctx.params;
    const user = await requireAuth(req);
    if (!ALLOWED_ROLES.includes(user.role)) {
      return json({ error: "Not allowed." }, 403);
    }
    if (isRateLimited(`req-senior-approve:${user.uid}`, { limit: 40, windowMs: 60_000 })) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down and try again." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    const db = adminDb();
    const ref = db.doc(`issues/${id}`);
    const now = new Date().toISOString();

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error("issue-missing");
      const data = snap.data() as Issue;
      if (data.status === "CLOSED") throw new Error("issue-closed");
      const requirements: Requirement[] = Array.isArray(data.requirements) ? [...data.requirements] : [];
      const idx = requirements.findIndex((r) => r.id === reqId);
      if (idx === -1) throw new Error("requirement-missing");

      const current = requirements[idx];
      if (!current.needsApproval) throw new Error("not-flagged");
      if (!current.seniorApprovalRequired) throw new Error("not-senior");
      if (current.resolved || current.approvalStatus === "approved") throw new Error("already-approved");

      const approved: Requirement = {
        ...current,
        approvalStatus: "approved",
        resolved: true,
        approvalBy: { uid: user.uid, name: user.name },
        approvalAt: now,
      };
      delete approved.rejectReason;
      delete approved.rejectedBy;
      delete approved.rejectedAt;
      requirements[idx] = approved;

      writePurchaseRecord(tx, data, approved, { uid: user.uid, name: user.name }, "senior");

      await tx.update(ref, {
        requirements,
        pendingPurchaseCount: pendingCount(requirements),
        pendingSeniorApprovalCount: seniorPendingCount(requirements),
        updatedAt: now,
      });

      return { approved, issue: data };
    });

    const { approved: approvedReq, issue: approvedIssue } = result;
    if (approvedReq) {
      const recipientUids = [
        ...(approvedIssue.routing?.staff?.map((s) => s.uid) || []),
        approvedIssue.reporter?.uid,
      ].filter(Boolean) as string[];
      void Promise.allSettled(
        recipientUids.map((uid) =>
          notify(uid, {
            type: "purchase",
            title: "Purchase approved",
            body: `Approved ${approvedReq.item} ×${approvedReq.qty} at ₹${approvedReq.price ?? 0} by ${user.name}.`,
            link: `/issues/${id}`,
          })
        )
      );
      void notifyRole(
        ["purchase"],
        {
          type: "purchase",
          title: "Purchase approved",
          body: `Senior approved ${approvedReq.item} ×${approvedReq.qty} at ₹${approvedReq.price ?? 0}.`,
          link: `/issues/${id}`,
        },
        approvedIssue.college
      );
    }

    return json({ ok: true, requirement: result.approved });
  } catch (e) {
    if (e instanceof Error && e.message === "issue-missing") return json({ error: "Issue not found." }, 404);
    if (e instanceof Error && e.message === "issue-closed")
      return json({ error: "This issue is closed — purchases can no longer be approved." }, 400);
    if (e instanceof Error && e.message === "requirement-missing") return json({ error: "Requirement not found." }, 404);
    if (e instanceof Error && e.message === "not-flagged")
      return json({ error: "This requirement was not flagged for approval." }, 400);
    if (e instanceof Error && e.message === "not-senior")
      return json({ error: "This item was not submitted for senior approval." }, 400);
    if (e instanceof Error && e.message === "already-approved")
      return json({ error: "This requirement was already approved." }, 400);
    return handleError(e);
  }
}
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/auth";
import { json, parseBody, handleError } from "@/lib/api";
import { isRateLimited } from "@/lib/rateLimit";
import { rejectRequirementSchema } from "@/lib/schemas";
import { notify } from "@/lib/notifications";
import type { Issue, Requirement } from "@/lib/types";

const ALLOWED_ROLES = ["purchase", "admin"];

const pendingCount = (reqs: Requirement[]) =>
  reqs.filter((r) => r.needsApproval && !r.resolved && r.approvalStatus !== "rejected").length;

/** POST /api/issues/[id]/requirements/[reqId]/reject — purchase team rejects a flagged requirement. */
export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/issues/[id]/requirements/[reqId]/reject">
): Promise<NextResponse> {
  try {
    const { id, reqId } = await ctx.params;
    const user = await requireAuth(req);
    if (!ALLOWED_ROLES.includes(user.role)) {
      return json({ error: "Not allowed." }, 403);
    }
    if (isRateLimited(`req-reject:${user.uid}`, { limit: 40, windowMs: 60_000 })) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down and try again." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }
    const body = await parseBody(req, rejectRequirementSchema);

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
      if (current.resolved || current.approvalStatus === "approved") throw new Error("already-approved");

      const rejected: Requirement = {
        ...current,
        approvalStatus: "rejected",
        resolved: false,
        rejectReason: body.reason,
        rejectedBy: { uid: user.uid, name: user.name },
        rejectedAt: now,
      };
      delete rejected.price;
      delete rejected.approvalBy;
      delete rejected.approvalAt;
      requirements[idx] = rejected;

      await tx.update(ref, {
        requirements,
        pendingPurchaseCount: pendingCount(requirements),
        updatedAt: now,
      });

      return { rejected, issue: data };
    });

    const { rejected: rejectedReq, issue: rejectedIssue } = result;
    if (rejectedReq) {
      const recipientUids = [
        ...(rejectedIssue.routing?.staff?.map((s) => s.uid) || []),
        rejectedIssue.reporter?.uid,
      ].filter(Boolean) as string[];
      void Promise.allSettled(
        recipientUids.map((uid) =>
          notify(uid, {
            type: "purchase",
            title: "Purchase rejected",
            body: `Rejected ${rejectedReq.item} ×${rejectedReq.qty} — ${body.reason}`,
            link: `/issues/${id}`,
          })
        )
      );
    }

    return json({ ok: true, requirement: result.rejected });
  } catch (e) {
    if (e instanceof Error && e.message === "issue-missing") return json({ error: "Issue not found." }, 404);
    if (e instanceof Error && e.message === "issue-closed")
      return json({ error: "This issue is closed — requirements can no longer be rejected." }, 400);
    if (e instanceof Error && e.message === "requirement-missing") return json({ error: "Requirement not found." }, 404);
    if (e instanceof Error && e.message === "not-flagged")
      return json({ error: "This requirement was not flagged for approval." }, 400);
    if (e instanceof Error && e.message === "already-approved")
      return json({ error: "This requirement was already approved." }, 400);
    return handleError(e);
  }
}

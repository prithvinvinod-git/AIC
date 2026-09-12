import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/auth";
import { json, parseBody, handleError } from "@/lib/api";
import { isRateLimited } from "@/lib/rateLimit";
import { approveRequirementSchema } from "@/lib/schemas";
import { notify, notifyRole } from "@/lib/notifications";
import {
  loadPurchaseLimit,
  pendingCount,
  seniorPendingCount,
  writePurchaseRecord,
} from "@/lib/purchase";
import type { Issue, Requirement, Role } from "@/lib/types";

const ALLOWED_ROLES: Role[] = ["purchase", "admin"];

/** POST /api/issues/[id]/requirements/[reqId]/approve — purchase team approves a
 *  flagged requirement. Over-limit totals (non-admin) are routed to a senior. */
export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/issues/[id]/requirements/[reqId]/approve">
): Promise<NextResponse> {
  try {
    const { id, reqId } = await ctx.params;
    const user = await requireAuth(req);
    if (!ALLOWED_ROLES.includes(user.role)) {
      return json({ error: "Not allowed." }, 403);
    }
    if (isRateLimited(`req-approve:${user.uid}`, { limit: 40, windowMs: 60_000 })) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down and try again." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }
    const body = await parseBody(req, approveRequirementSchema);

    const db = adminDb();
    const ref = db.doc(`issues/${id}`);
    const now = new Date().toISOString();
    const limit = await loadPurchaseLimit(db);

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
      if (current.seniorApprovalRequired) throw new Error("awaiting-senior");

      const total = Math.round((body.price || 0) * (current.qty || 1) * 100) / 100;

      // Over the configured limit (admins final-approve regardless): submit to
      // the senior queue instead of resolving. It stays pending for seniors.
      if (total > limit && user.role !== "admin") {
        const submitted: Requirement = {
          ...current,
          price: body.price,
          seniorApprovalRequired: true,
          submittedBy: { uid: user.uid, name: user.name },
          submittedAt: now,
        };
        requirements[idx] = submitted;

        await tx.update(ref, {
          requirements,
          pendingPurchaseCount: pendingCount(requirements),
          pendingSeniorApprovalCount: seniorPendingCount(requirements),
          updatedAt: now,
        });

        return { action: "senior" as const, requirement: submitted, issue: data };
      }

      const approved: Requirement = {
        ...current,
        approvalStatus: "approved",
        resolved: true,
        price: body.price,
        approvalBy: { uid: user.uid, name: user.name },
        approvalAt: now,
      };
      delete approved.rejectReason;
      delete approved.rejectedBy;
      delete approved.rejectedAt;
      requirements[idx] = approved;

      writePurchaseRecord(tx, data, approved, { uid: user.uid, name: user.name }, "purchase");

      await tx.update(ref, {
        requirements,
        pendingPurchaseCount: pendingCount(requirements),
        pendingSeniorApprovalCount: seniorPendingCount(requirements),
        updatedAt: now,
      });

      return { action: "approved" as const, requirement: approved, issue: data };
    });

    const { action, requirement, issue } = result;
    if (action === "senior") {
      const total = Math.round((requirement.price || 0) * (requirement.qty || 1));
      void notifyRole(
        ["hod", "principal", "admin"],
        {
          type: "purchase",
          title: "Senior approval needed",
          body: `${requirement.item} ×${requirement.qty} totals ₹${total.toLocaleString("en-IN")} — over the purchase limit.`,
          link: `/issues/${id}`,
        },
        issue.college
      );
    } else {
      const recipientUids = [
        ...(issue.routing?.staff?.map((s) => s.uid) || []),
        issue.reporter?.uid,
      ].filter(Boolean) as string[];
      void Promise.allSettled(
        recipientUids.map((uid) =>
          notify(uid, {
            type: "purchase",
            title: "Purchase approved",
            body: `Approved ${requirement.item} ×${requirement.qty} at ₹${body.price}.`,
            link: `/issues/${id}`,
          })
        )
      );
    }

    return json({ ok: true, requirement, action });
  } catch (e) {
    if (e instanceof Error && e.message === "issue-missing") return json({ error: "Issue not found." }, 404);
    if (e instanceof Error && e.message === "issue-closed")
      return json({ error: "This issue is closed — requirements can no longer be approved." }, 400);
    if (e instanceof Error && e.message === "requirement-missing") return json({ error: "Requirement not found." }, 404);
    if (e instanceof Error && e.message === "not-flagged")
      return json({ error: "This requirement was not flagged for approval." }, 400);
    if (e instanceof Error && e.message === "already-approved")
      return json({ error: "This requirement was already approved." }, 400);
    if (e instanceof Error && e.message === "awaiting-senior")
      return json({ error: "This item is awaiting senior approval — please wait for a decision." }, 400);
    return handleError(e);
  }
}
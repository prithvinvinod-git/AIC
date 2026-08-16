import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/auth";
import { json, handleError } from "@/lib/api";
import { resolveRequirementSchema, editRequirementSchema } from "@/lib/schemas";
import { notifyRole } from "@/lib/notifications";
import type { Issue, Requirement } from "@/lib/types";

const ALLOWED_ROLES = ["maintenance", "admin"];

const pendingCount = (reqs: Requirement[]) =>
  reqs.filter((r) => r.needsApproval && !r.resolved && r.approvalStatus !== "rejected").length;

/** PATCH /api/issues/[id]/requirements/[reqId] — resolve/un-resolve, or edit & resubmit a rejected approval request. */
export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<"/api/issues/[id]/requirements/[reqId]">
): Promise<NextResponse> {
  try {
    const { id, reqId } = await ctx.params;
    const user = await requireAuth(req);
    if (!ALLOWED_ROLES.includes(user.role)) {
      return json({ error: "Not allowed." }, 403);
    }

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return json({ error: "Invalid JSON body." }, 400);
    }
    if (!raw || typeof raw !== "object") return json({ error: "Invalid body." }, 400);

    const hasResolved = "resolved" in (raw as object);
    const hasEdit = "item" in (raw as object) || "qty" in (raw as object);
    if (hasResolved === hasEdit) return json({ error: "Provide either resolved or item/qty, not both." }, 400);

    const rawObj = raw as { resolved?: unknown; item?: unknown; qty?: unknown };
    const editInfo = hasEdit ? { item: String(rawObj.item ?? ""), qty: Number(rawObj.qty ?? 1) } : null;

    const db = adminDb();
    const ref = db.doc(`issues/${id}`);
    const now = new Date().toISOString();

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error("issue-missing");
      const data = snap.data() as Issue;
      if (data.status === "CLOSED") throw new Error("issue-closed");
      const requirements: Requirement[] = Array.isArray(data.requirements) ? [...data.requirements] : [];
      const idx = requirements.findIndex((r) => r.id === reqId);
      if (idx === -1) throw new Error("requirement-missing");

      const current = requirements[idx];
      let next: Requirement;

      if (hasResolved) {
        const body = resolveRequirementSchema.parse({ resolved: rawObj.resolved });
        if (current.needsApproval) {
          throw new Error("approval-locked");
        }
        next = { ...current, resolved: body.resolved };
      } else {
        const body = editRequirementSchema.parse(editInfo ?? {});
        if (current.approvalStatus === "approved") {
          throw new Error("already-approved");
        }
        next = { ...current, ...body };
        if (current.needsApproval && current.approvalStatus === "rejected") {
          next = {
            ...next,
            approvalStatus: "pending",
            resolved: false,
          };
          delete next.rejectReason;
        }
      }

      requirements[idx] = next;

      await tx.update(ref, {
        requirements,
        pendingPurchaseCount: pendingCount(requirements),
        updatedAt: now,
      });
    });

    if (hasEdit) {
      void notifyRole(["purchase"], {
        type: "purchase",
        title: "Purchase approval requested again",
        body: `Resubmitted for approval: ${editInfo?.item ?? "item"} ×${editInfo?.qty ?? "?"}.`,
        link: `/issues/${id}`,
      });
    }

    return json({ ok: true });
  } catch (e) {
    if (e instanceof Error && e.message === "issue-missing") return json({ error: "Issue not found." }, 404);
    if (e instanceof Error && e.message === "issue-closed")
      return json({ error: "This issue is closed — requirements can no longer be modified." }, 400);
    if (e instanceof Error && e.message === "requirement-missing") return json({ error: "Requirement not found." }, 404);
    if (e instanceof Error && e.message === "approval-locked")
      return json({ error: "Approval-flagged requirements are resolved by the purchase team only." }, 403);
    if (e instanceof Error && e.message === "already-approved")
      return json({ error: "This requirement was already approved — it cannot be edited." }, 400);
    return handleError(e);
  }
}

/** DELETE /api/issues/[id]/requirements/[reqId] — remove a requirement. */
export async function DELETE(
  req: NextRequest,
  ctx: RouteContext<"/api/issues/[id]/requirements/[reqId]">
): Promise<NextResponse> {
  try {
    const { id, reqId } = await ctx.params;
    const user = await requireAuth(req);
    if (!ALLOWED_ROLES.includes(user.role)) {
      return json({ error: "Not allowed." }, 403);
    }

    const db = adminDb();
    const ref = db.doc(`issues/${id}`);
    const now = new Date().toISOString();

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error("issue-missing");
      const data = snap.data() as Issue;
      if (user.role === "maintenance" && !(data.routing?.staff || []).some((s) => s.uid === user.uid)) {
        throw new Error("not-assigned");
      }
      if (data.status === "CLOSED") throw new Error("issue-closed");
      const requirements: Requirement[] = Array.isArray(data.requirements) ? [...data.requirements] : [];
      const idx = requirements.findIndex((r) => r.id === reqId);
      if (idx === -1) throw new Error("requirement-missing");
      if (requirements[idx].needsApproval) throw new Error("approval-locked");
      requirements.splice(idx, 1);

      await tx.update(ref, {
        requirements,
        pendingPurchaseCount: pendingCount(requirements),
        updatedAt: now,
      });
    });

    return json({ ok: true });
  } catch (e) {
    if (e instanceof Error && e.message === "issue-missing") return json({ error: "Issue not found." }, 404);
    if (e instanceof Error && e.message === "issue-closed")
      return json({ error: "This issue is closed — requirements can no longer be modified." }, 400);
    if (e instanceof Error && e.message === "requirement-missing") return json({ error: "Requirement not found." }, 404);
    if (e instanceof Error && e.message === "not-assigned")
      return json({ error: "Only the assigned maintenance staff can remove requirements." }, 403);
    if (e instanceof Error && e.message === "approval-locked")
      return json({ error: "Requirements sent for approval cannot be removed." }, 403);
    return handleError(e);
  }
}

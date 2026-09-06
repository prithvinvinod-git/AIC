import "server-only";

import type { Firestore, Transaction } from "firebase-admin/firestore";
import { adminDb } from "./firebaseAdmin";
import { DEFAULT_CONFIG } from "./constants";
import type { Issue, Requirement } from "./types";

/** Denormalized count used to drive the purchase queue. */
export const pendingCount = (reqs: Requirement[]) =>
  reqs.filter((r) => r.needsApproval && !r.resolved && r.approvalStatus !== "rejected").length;

/** Denormalized count used to drive the senior (HOD/Principal/Admin) queue. */
export const seniorPendingCount = (reqs: Requirement[]) =>
  reqs.filter(
    (r) =>
      r.needsApproval &&
      !r.resolved &&
      r.approvalStatus !== "rejected" &&
      r.seniorApprovalRequired
  ).length;

/**
 * Write a `purchases/{id}` expense record inside the same transaction as the
 * requirement approval so history + analytics never miss a purchase. Only
 * final approvals (direct or senior) call this — rejections aren't expenses.
 */
export function writePurchaseRecord(
  tx: Transaction,
  issue: Issue,
  req: Requirement,
  approver: { uid: string; name: string },
  source: "purchase" | "senior"
): void {
  const unitPrice = req.price && req.price >= 0 ? req.price : 0;
  const qty = req.qty && req.qty > 0 ? req.qty : 1;
  tx.set(adminDb().collection("purchases").doc(), {
    item: req.item,
    qty,
    unitPrice,
    total: Math.round(unitPrice * qty * 100) / 100,
    categoryName: issue.routing?.categoryName || "",
    categoryId: issue.routing?.categoryId || "",
    college: issue.college || "",
    department: issue.department || "",
    issueId: issue.id || "",
    issueNo: issue.issueNo,
    title: issue.title,
    approvedAt: new Date().toISOString(),
    approvedBy: approver,
    source,
    seniorApproved: source === "senior",
  });
}

/** Load the configured purchase approval limit (₹) from config/general. */
export async function loadPurchaseLimit(db: Firestore): Promise<number> {
  try {
    const snap = await db.doc("config/general").get();
    const raw = snap.exists ? (snap.data()?.purchaseApprovalLimit as number | undefined) : undefined;
    return typeof raw === "number" && raw >= 0 ? raw : DEFAULT_CONFIG.purchaseApprovalLimit;
  } catch {
    return DEFAULT_CONFIG.purchaseApprovalLimit;
  }
}
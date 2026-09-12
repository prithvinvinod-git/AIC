"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, IndianRupee } from "lucide-react";
import type { Issue, Requirement } from "@/lib/types";
import { api } from "@/lib/clientApi";
import { StatusBadge, PriorityBadge } from "@/components/ui/Badge";
import { useActionError } from "@/components/ui/Toast";

const inr = (n: number) => `₹${Math.round(n || 0).toLocaleString("en-IN")}`;

/** One over-limit purchase awaiting a senior (HOD/Principal/Admin) decision. */
export function SeniorPurchaseApprovalCard({
  issue,
  onAction,
}: {
  issue: Issue;
  onAction: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<Requirement | null>(null);
  const [reason, setReason] = useState("");
  const { showError, errorEl } = useActionError();

  const pending: Requirement[] = (issue.requirements || []).filter(
    (r) =>
      r.needsApproval &&
      r.seniorApprovalRequired &&
      r.approvalStatus !== "approved" &&
      r.approvalStatus !== "rejected" &&
      !r.resolved
  );
  if (pending.length === 0) return null;

  const approve = async (r: Requirement) => {
    setBusy(r.id ?? "");
    try {
      await api(`/api/issues/${issue.id}/requirements/${r.id}/senior-approve`, { method: "POST" });
      onAction();
    } catch (e) {
      showError(e);
      setBusy(null);
    }
  };

  const submitReject = async () => {
    if (!rejectFor) return;
    if (reason.trim().length < 3) {
      showError("A rejection reason (at least 3 characters) is required.");
      return;
    }
    setBusy(rejectFor.id ?? "");
    try {
      await api(`/api/issues/${issue.id}/requirements/${rejectFor.id}/senior-reject`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() }),
      });
      setRejectFor(null);
      setReason("");
      onAction();
    } catch (e) {
      showError(e);
      setBusy(null);
    }
  };

  return (
    <div className="card min-w-0 overflow-hidden">
      <button
        type="button"
        className="flex w-full flex-col gap-2 text-left"
        onClick={() => router.push(`/issues/${issue.id}`)}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-slate">{issue.issueNo}</p>
            <h3 className="truncate font-display text-base font-medium text-graphite">{issue.title}</h3>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <PriorityBadge priority={issue.priority} />
            <StatusBadge status={issue.status} />
          </div>
        </div>
        <p className="line-clamp-2 text-sm text-slate">{issue.description}</p>
        <div className="flex flex-wrap gap-2 text-xs text-slate">
          <span className="tag tag-outline">{issue.routing?.categoryName}</span>
          <span className="tag tag-outline">{issue.location.name}</span>
          <span className="tag tag-outline">{issue.department}</span>
          {issue.college && <span className="tag tag-outline">{issue.college}</span>}
        </div>
      </button>

      <ul className="mt-3 flex flex-col gap-2 border-t border-silver pt-3">
        {pending.map((r) => (
          <li key={r.id} className="rounded-lg bg-warning-soft px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-graphite">
                {r.item} ×{r.qty}
                <span className="ml-2 text-[10px] font-medium uppercase tracking-wide text-warning">
                  over-limit · awaiting your approval
                </span>
              </p>
              <p className="text-sm font-semibold text-graphite">
                {inr((r.price || 0) * (r.qty || 1))}
              </p>
            </div>
            <p className="mt-1 text-xs text-slate">
              <IndianRupee className="mr-1 inline h-3 w-3" aria-hidden />
              {inr(r.price ?? 0)} per unit · submitted {r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : ""} by{" "}
              {r.submittedBy?.name || "the purchase team"}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                className="btn btn-primary btn-sm"
                disabled={busy !== null}
                onClick={() => void approve(r)}
              >
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                {busy === r.id ? "Approving…" : "Approve purchase"}
              </button>
              <button
                className="btn btn-ghost btn-sm text-danger"
                disabled={busy !== null}
                onClick={() => {
                  setRejectFor(r);
                  setReason("");
                }}
              >
                Reject
              </button>
            </div>
            {rejectFor?.id === r.id && (
              <form
                className="mt-3 flex flex-col gap-2 rounded-xl bg-paper p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void submitReject();
                }}
              >
                <label className="label">Rejection reason</label>
                <input
                  className="input"
                  required
                  minLength={3}
                  value={reason}
                  placeholder="Why is this purchase being rejected?"
                  onChange={(e) => setReason(e.target.value)}
                />
                <div className="flex gap-2">
                  <button type="submit" className="btn btn-danger btn-sm" disabled={busy !== null}>
                    {busy === r.id ? "Rejecting…" : "Confirm rejection"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setRejectFor(null);
                      setReason("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </li>
        ))}
      </ul>
      {errorEl}
    </div>
  );
}
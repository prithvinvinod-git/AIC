"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import type { Issue } from "@/lib/types";
import { api } from "@/lib/clientApi";
import { StatusBadge, PriorityBadge } from "@/components/ui/Badge";
import { IssuePhotos } from "@/components/ui/IssuePhotos";
import { FeedbackStars } from "@/components/ui/FeedbackStars";
import { useActionError } from "@/components/ui/Toast";

export function EscalationCard({
  issue,
  onAction,
  approveLabel = "Approve & route to validator",
}: {
  issue: Issue;
  onAction: () => void;
  approveLabel?: string;
}) {
  const router = useRouter();
  const [priority, setPriority] = useState(String(issue.priority || 1));
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);
  const { showError, errorEl } = useActionError();

  const approve = async () => {
    setBusy(true);
    try {
      await api(`/api/issues/${issue.id}/approve`, {
        method: "POST",
        body: JSON.stringify({
          priority: Number(priority) === issue.priority ? undefined : Number(priority),
          note: "Approved for execution.",
        }),
      });
      onAction();
    } catch (e) {
      showError(e);
      setBusy(false);
    }
  };

  const reject = async () => {
    setBusy(true);
    try {
      await api(`/api/issues/${issue.id}/reject`, {
        method: "POST",
        body: JSON.stringify({ rejectionReason: rejectReason }),
      });
      onAction();
    } catch (e) {
      showError(e);
      setBusy(false);
    }
  };

  return (
    <div className="card">
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
        </div>
      </button>

      {issue.images.length > 0 && <IssuePhotos images={issue.images} />}

      <div className="mt-4 flex flex-col gap-3 border-t border-silver pt-4 sm:flex-row sm:items-end">
        <div>
          <label className="label" htmlFor={`rev-${issue.id}`}>
            Severity revision
          </label>
          <select
            id={`rev-${issue.id}`}
            className="input w-auto"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            {[1, 2, 3, 4, 5].map((p) => (
              <option key={p} value={p}>
                P{p}
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => void approve()}>
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          {busy ? "Approving…" : approveLabel}
        </button>
        <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setRejectOpen((v) => !v)}>
          Reject escalation
        </button>
        {errorEl}
      </div>
      {rejectOpen && (
        <form
          className="flex flex-col gap-2 rounded-xl bg-paper p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void reject();
          }}
        >
          <label className="label">Rejection reason</label>
          <input
            className="input"
            required
            minLength={3}
            value={rejectReason}
            placeholder="Why is this being rejected?"
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <div className="flex gap-2">
            <button type="submit" className="btn btn-danger btn-sm" disabled={busy}>
              {busy ? "Rejecting…" : "Confirm rejection"}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setRejectOpen(false);
                setRejectReason("");
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {issue.status === "CLOSED" && issue.feedback?.rating && (
        <div className="flex justify-end border-t border-silver pt-3">
          <FeedbackStars rating={issue.feedback.rating} size={16} />
        </div>
      )}
    </div>
  );
}

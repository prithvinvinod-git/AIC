"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { useIssues } from "@/hooks/useIssues";
import { Loading, EmptyState, BoardErrorState } from "@/components/ui/States";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/Badge";
import { api } from "@/lib/clientApi";
import { useActionError } from "@/components/ui/Toast";
import type { Issue, Requirement } from "@/lib/types";

export default function PurchasePage() {
  const { issues, error, reload } = useIssues({});
  const router = useRouter();
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [rejecting, setRejecting] = useState<{ issue: Issue; req: Requirement } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const { showError } = useActionError();

  const approve = useCallback(
    async (issue: Issue, req: Requirement) => {
      setBusy(true);
      const price = Math.max(0, Number(prices[req.id ?? ""] ?? "") || 0);
      try {
        await api(`/api/issues/${issue.id}/requirements/${req.id}/approve`, {
          method: "POST",
          body: JSON.stringify({ price }),
        });
        void reload();
      } catch (e) {
        showError(e);
      } finally {
        setBusy(false);
      }
    },
    [prices, reload, showError]
  );

  const submitReject = useCallback(async () => {
    if (!rejecting) return;
    if (reason.trim().length < 3) {
      showError("A rejection reason (at least 3 characters) is required.");
      return;
    }
    setBusy(true);
    try {
      await api(`/api/issues/${rejecting.issue.id}/requirements/${rejecting.req.id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() }),
      });
      setRejecting(null);
      setReason("");
      void reload();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  }, [rejecting, reason, reload, showError]);

  if (!issues) return <Loading label="Loading purchase requests…" />;
  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl max-md:text-xl font-semibold text-ink">Purchases</h1>
          <p className="mt-1 text-sm text-slate">Items flagged by maintenance teams for purchase approval.</p>
        </div>
        <BoardErrorState message={error} onRetry={() => void reload()} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl max-md:text-xl font-semibold text-ink">Purchases</h1>
        <p className="mt-1 text-sm text-slate">
          Approve or reject purchase requests. Approved items are marked resolved on the job automatically.
        </p>
      </div>

      {issues.length === 0 ? (
        <EmptyState
          title="No purchase requests"
          body="When maintenance staff flag a requirement for approval, it will appear here."
        />
      ) : (
        <div className="grid items-stretch gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-3">
          {issues.map((issue) => {
            const flagged = issue.requirements.filter((r) => r.needsApproval);
            const pending = flagged.filter((r) => r.approvalStatus !== "approved" && r.approvalStatus !== "rejected");
            return (
              <div key={issue.id} className="card flex h-full flex-col gap-3">
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
                    <StatusBadge status={issue.status} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate">
                    <span className="tag tag-outline">{issue.location.name}</span>
                    <span className="tag tag-outline">{issue.routing?.categoryName}</span>
                    <span className="tag tag-outline">{issue.department}</span>
                  </div>
                </button>

                <ul className="flex flex-col gap-2">
                  {flagged.map((r) =>
                    r.approvalStatus === "approved" ? (
                      <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg bg-success-soft px-3 py-2 text-sm max-md:flex-wrap">
                        <span className="text-success">
                          {r.item} ×{r.qty}
                        </span>
                        <span className="text-xs font-medium text-success">
                          <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                          ₹{r.price ?? 0}
                        </span>
                      </li>
                    ) : r.approvalStatus === "rejected" ? (
                      <li
                        key={r.id}
                        className="flex items-center justify-between gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm max-md:flex-wrap"
                        title={r.rejectReason}
                      >
                        <span className="text-danger">
                          {r.item} ×{r.qty}
                        </span>
                        <span className="text-xs font-medium text-danger">
                          <XCircle className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                          Rejected
                        </span>
                      </li>
                    ) : (
                      <li key={r.id} className="rounded-lg bg-warning-soft px-3 py-2">
                        <p className="text-sm text-graphite">
                          {r.item} ×{r.qty}
                          <span className="ml-2 text-[10px] font-medium uppercase tracking-wide text-warning">
                            pending approval
                          </span>
                        </p>
                        <div className="mt-2 flex items-center gap-2 max-md:flex-wrap">
                          <label className="flex items-center gap-1 text-xs text-slate">
                            ₹
                            <input
                              className="input h-8 w-24 text-sm"
                              type="number"
                              min={0}
                              step="any"
                              value={prices[r.id ?? ""] ?? ""}
                              placeholder="0"
                              onChange={(e) => setPrices((p) => ({ ...p, [r.id ?? ""]: e.target.value }))}
                            />
                          </label>
                          <button
                            className="btn btn-primary btn-sm"
                            disabled={busy}
                            onClick={() => void approve(issue, r)}
                          >
                            Approve
                          </button>
                          <button
                            className="btn btn-ghost btn-sm text-danger"
                            disabled={busy}
                            onClick={() => {
                              setRejecting({ issue, req: r });
                              setReason("");
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      </li>
                    )
                  )}
                </ul>

                {pending.length > 0 && (
                  <p className="mt-auto text-xs text-slate">
                    {pending.length} item(s) awaiting approval in this job.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal open={!!rejecting} onClose={() => setRejecting(null)} title="Reject purchase request">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate">
            {rejecting?.req.item} ×{rejecting?.req.qty} — why is this being rejected?
          </p>
          <textarea
            className="input resize-none"
            rows={3}
            required
            minLength={3}
            value={reason}
            placeholder="e.g. Out of scope / wrong spec / already in stock…"
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex gap-2">
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => void submitReject()}>
              Confirm rejection
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setRejecting(null)} disabled={busy}>
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

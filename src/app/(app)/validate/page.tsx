"use client";

import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { useIssues } from "@/hooks/useIssues";
import { useAuth } from "@/components/auth/AuthProvider";
import { api, ApiError } from "@/lib/clientApi";
import { Loading, EmptyState } from "@/components/ui/States";
import { AISuggestionCard } from "@/components/issues/AISuggestionCard";
import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import type { Issue } from "@/lib/types";

function ValidatePanel({ issue, onDone }: { issue: Issue; onDone: () => void }) {
  const [priority, setPriority] = useState("3");
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState<"validate" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const act = async (kind: "validate" | "reject") => {
    setBusy(kind);
    setError(null);
    try {
      if (kind === "validate") {
        await api(`/api/issues/${issue.id}/validate`, {
          method: "POST",
          body: JSON.stringify({ priority: Number(priority) }),
        });
      } else {
        await api(`/api/issues/${issue.id}/reject`, {
          method: "POST",
          body: JSON.stringify({ rejectionReason: rejectReason }),
        });
      }
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Action failed.");
      setBusy(null);
    }
  };

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-xl bg-paper p-4">
      <AISuggestionCard issue={issue} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div>
          <label className="label" htmlFor={`p-${issue.id}`}>
            Priority (1 = critical)
          </label>
          <select
            id={`p-${issue.id}`}
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
        <button
          className="btn btn-primary btn-sm"
          disabled={busy !== null}
          onClick={() => void act("validate")}
        >
          {busy === "validate" ? "Validating…" : "Validate & auto-route"}
        </button>
        <input
          className="input flex-1"
          placeholder="Rejection reason (required to reject)"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
        <button
          className="btn btn-danger btn-sm"
          disabled={busy !== null || !rejectReason.trim()}
          onClick={() => void act("reject")}
        >
          {busy === "reject" ? "Rejecting…" : "Reject"}
        </button>
      </div>
      {error && <p className="text-sm text-[#c0392b]">{error}</p>}
    </div>
  );
}

export default function ValidatePage() {
  const { claims } = useAuth();
  const { issues, reload } = useIssues({ status: "NEW" });
  const [openId, setOpenId] = useState<string | null>(null);

  if (!claims) return null;
  if (!issues) return <Loading label="Loading issues to validate…" />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Validate issues</h1>
        <p className="mt-1 text-sm text-slate">
          {claims.department} · Review reports, confirm AI triage, and route them onward.
        </p>
      </div>

      {issues.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-8 w-8" aria-hidden />}
          title="Nothing to review"
          body="New issues from your department will appear here for validation."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {issues.map((issue) => {
            const open = openId === issue.id;
            return (
              <div key={issue.id} className="card">
                <button
                  type="button"
                  className="flex w-full flex-col gap-2 text-left"
                  onClick={() => setOpenId(open ? null : issue.id || null)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate">{issue.issueNo}</p>
                      <h3 className="truncate font-display text-base font-medium text-graphite">
                        {issue.title}
                      </h3>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {issue.priority > 0 && <PriorityBadge priority={issue.priority} />}
                      <StatusBadge status={issue.status} />
                    </div>
                  </div>
                  <p className="line-clamp-2 text-sm text-slate">{issue.description}</p>
                  <div className="flex flex-wrap gap-2 text-xs text-slate">
                    <span className="tag tag-outline">{issue.location.name}</span>
                    <span className="tag tag-outline">{issue.routing?.categoryName}</span>
                    <span className="ml-auto flex items-center gap-1 text-slate">
                      {open ? <XCircle className="h-4 w-4" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
                    </span>
                  </div>
                </button>

                {open && <ValidatePanel issue={issue} onDone={() => { setOpenId(null); void reload(); }} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

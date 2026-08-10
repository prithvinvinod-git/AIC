"use client";

import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { useIssues } from "@/hooks/useIssues";
import { useAuth } from "@/components/auth/AuthProvider";
import { api, ApiError } from "@/lib/clientApi";
import { Loading, EmptyState, BoardErrorState } from "@/components/ui/States";
import { AISuggestionCard } from "@/components/issues/AISuggestionCard";
import { AssignCard, VerifyCard } from "@/components/issues/HeadCards";
import { MaintenanceJobCard } from "@/components/issues/MaintenanceJobCard";
import { RootCauseAnalysisCard } from "@/components/ai/RootCauseAnalysisCard";
import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import { IssuePhotos } from "@/components/ui/IssuePhotos";
import type { Issue } from "@/lib/types";

function ValidatePanel({ issue, onDone, onTriaged }: { issue: Issue; onDone: () => void; onTriaged: () => void }) {
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
      <AISuggestionCard issue={issue} onTriaged={onTriaged} />
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
          <p className="mt-1 max-w-[220px] text-xs text-slate">
            P1–2 go to HOD/Principal approval; P3–5 auto-assign to a team.
          </p>
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
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

export default function ValidatePage() {
  const { claims } = useAuth();
  const { issues, error, reload } = useIssues({});
  const [openId, setOpenId] = useState<string | null>(null);

  if (!claims) return null;
  if (!issues) return <Loading label="Loading board…" />;

  const validateQueue = issues.filter((i) => i.status === "NEW");
  const active = issues.filter((i) => ["ASSIGNED", "ONGOING"].includes(i.status));
  const assignQueue = issues.filter((i) => i.status === "APPROVED");
  const verifyQueue = issues.filter((i) => i.status === "COMPLETED");
  const blocked = issues.filter((i) => i.status === "PENDING");

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Validate & manage</h1>
        <p className="mt-1 text-sm text-slate">
          {claims.department} · Review reports, route approved work, and verify completed jobs.
        </p>
      </div>

      <RootCauseAnalysisCard />

      {error ? (
        <BoardErrorState message={error} onRetry={() => void reload()} />
      ) : (
        <>
          <section className="flex flex-col gap-4">
            <h2 className="font-display text-lg font-semibold text-ink">
              Validate queue <span className="text-sm font-normal text-slate">({validateQueue.length})</span>
            </h2>
        {validateQueue.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="h-8 w-8" aria-hidden />}
            title="Nothing to review"
            body="New issues from your department will appear here for validation."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {validateQueue.map((issue) => {
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
                        {open ? <XCircle className="h-3.5 w-3.5" aria-hidden /> : <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />}
                      </span>
                    </div>
                  </button>

                  {issue.images.length > 0 && <IssuePhotos images={issue.images} />}

                  {open && <ValidatePanel issue={issue} onDone={() => { setOpenId(null); void reload(); }} onTriaged={() => void reload()} />}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-lg font-semibold text-ink">
          Active jobs <span className="text-sm font-normal text-slate">({active.length})</span>
        </h2>
        {active.length === 0 ? (
          <EmptyState title="No active jobs" body="Assigned jobs being worked on will appear here." />
        ) : (
          <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((issue) => (
              <MaintenanceJobCard key={issue.id} issue={issue} onRefresh={() => void reload()} readOnly />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-lg font-semibold text-ink">
          Assign queue <span className="text-sm font-normal text-slate">({assignQueue.length})</span>
        </h2>
        {assignQueue.length === 0 ? (
          <EmptyState title="Nothing to assign" body="Approved issues awaiting your team assignment will land here." />
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-2">
            {assignQueue.map((issue) => (
              <AssignCard key={issue.id} issue={issue} onRefresh={() => void reload()} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-lg font-semibold text-ink">
          Verify queue <span className="text-sm font-normal text-slate">({verifyQueue.length})</span>
        </h2>
        {verifyQueue.length === 0 ? (
          <EmptyState title="Nothing to verify" body="Completed jobs awaiting your verification will appear here." />
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-2">
            {verifyQueue.map((issue) => (
              <VerifyCard key={issue.id} issue={issue} onRefresh={() => void reload()} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-lg font-semibold text-ink">
          Blocked <span className="text-sm font-normal text-slate">({blocked.length})</span>
        </h2>
        {blocked.length === 0 ? (
          <EmptyState title="No blocked jobs" body="Jobs awaiting parts or permissions will appear here." />
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-2">
            {blocked.map((issue) => (
              <AssignCard key={issue.id} issue={issue} onRefresh={() => void reload()} />
            ))}
          </div>
        )}
      </section>
        </>
      )}
    </div>
  );
}

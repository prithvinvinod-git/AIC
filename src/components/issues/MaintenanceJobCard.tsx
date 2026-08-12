"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { ListChecks, PlayCircle, Sparkles } from "lucide-react";
import type { Issue, Requirement } from "@/lib/types";
import { api, ApiError } from "@/lib/clientApi";
import { StatusBadge, PriorityBadge } from "@/components/ui/Badge";
import { IssuePhotos } from "@/components/ui/IssuePhotos";
import { formatDateTime } from "@/lib/format";

interface DraftRequirement {
  item: string;
  qty: number;
  needsApproval: boolean;
}

export function MaintenanceJobCard({
  issue,
  onRefresh,
  readOnly = false,
}: {
  issue: Issue;
  onRefresh: () => void;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"start" | "block" | "complete" | "req" | null>(null);
  const [note, setNote] = useState("");
  const [reqItem, setReqItem] = useState("");
  const [reqQty, setReqQty] = useState("1");
  const [reqApproval, setReqApproval] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);

  const act = useCallback(
    async (kind: "start" | "block" | "complete") => {
      setBusy(true);
      setError(null);
      try {
        if (kind === "start") {
          await api(`/api/issues/${issue.id}/status`, {
            method: "POST",
            body: JSON.stringify({ to: "ONGOING", note: "Work started." }),
          });
        } else if (kind === "block") {
          await api(`/api/issues/${issue.id}/pending`, {
            method: "POST",
            body: JSON.stringify({ note }),
          });
        } else {
          await api(`/api/issues/${issue.id}/complete`, {
            method: "POST",
            body: JSON.stringify({ note }),
          });
        }
        setMode(null);
        setNote("");
        onRefresh();
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Action failed.");
      } finally {
        setBusy(false);
      }
    },
    [issue.id, note, onRefresh]
  );

  const addRequirement = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setBusy(true);
      setError(null);
      try {
        await api(`/api/issues/${issue.id}/requirements`, {
          method: "POST",
          body: JSON.stringify({
            item: reqItem,
            qty: Number(reqQty) || 1,
            needsApproval: reqApproval,
          }),
        });
        setReqItem("");
        setReqQty("1");
        setReqApproval(false);
        setMode(null);
        onRefresh();
      } catch (e2) {
        setError(e2 instanceof ApiError ? e2.message : "Failed to log requirement.");
      } finally {
        setBusy(false);
      }
    },
    [issue.id, reqItem, reqQty, reqApproval, onRefresh]
  );

  const draftRequirements = useCallback(async () => {
    setDrafting(true);
    setError(null);
    try {
      const res = await api<{ requirements: DraftRequirement[] }>("/api/ai/extract-requirements", {
        method: "POST",
        body: JSON.stringify({ issueId: issue.id }),
      });
      for (const r of res.requirements) {
        await api(`/api/issues/${issue.id}/requirements`, {
          method: "POST",
          body: JSON.stringify(r),
        });
      }
      setMode(null);
      onRefresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Draft failed.");
    } finally {
      setDrafting(false);
    }
  }, [issue.id, onRefresh]);

  const toggleRequirement = useCallback(
    async (r: Requirement) => {
      try {
        await api(`/api/issues/${issue.id}/requirements/${(r as Requirement & { id?: string }).id}`, {
          method: "PATCH",
          body: JSON.stringify({ resolved: !r.resolved }),
        });
        onRefresh();
      } catch {
        setError("Failed to update requirement.");
      }
    },
    [issue.id, onRefresh]
  );

  const isAssigned = issue.status === "ASSIGNED";
  const isOngoing = issue.status === "ONGOING";
  const isBlocked = issue.status === "PENDING";
  const unresolvedApproval = issue.requirements.filter((r) => !r.resolved && r.needsApproval).length;

  return (
    <div className="card flex flex-col gap-3">
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
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate">
          <span className="tag tag-outline">{issue.location.name}</span>
          <span className="tag tag-outline">{issue.routing?.categoryName}</span>
          {issue.routing?.staff?.map((s) => (
            <span key={s.uid} className="tag bg-ink text-white">
              {s.name}
            </span>
          ))}
        </div>
      </button>

      {issue.images.length > 0 && <IssuePhotos images={issue.images} />}

      {issue.requirements.length > 0 && (
        <div className="rounded-xl bg-paper p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate">
            <ListChecks className="h-3.5 w-3.5" aria-hidden /> Requirements
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {issue.requirements.map((r, i) => (
              <li key={`${(r as Requirement & { id?: string }).id || i}`} className="flex items-center gap-3 text-sm">
                {readOnly ? (
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 sm:h-3.5 sm:w-3.5 ${
                      r.resolved ? "border-success bg-success text-white" : "border-slate bg-white"
                    }`}
                    aria-label={r.resolved ? "Resolved" : "Unresolved"}
                    title={r.resolved ? "Resolved" : "Unresolved"}
                  >
                    {r.resolved && <span className="text-[10px] leading-none">✓</span>}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void toggleRequirement(r)}
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors sm:h-3.5 sm:w-3.5 ${
                      r.resolved
                        ? "border-success bg-success text-white"
                        : "border-slate bg-white hover:border-ink"
                    }`}
                    aria-label={r.resolved ? "Mark as unresolved" : "Mark as resolved"}
                    title={r.resolved ? "Mark as unresolved" : "Mark as resolved"}
                  >
                    {r.resolved && <span className="text-[10px] leading-none">✓</span>}
                  </button>
                )}
                <span className={r.resolved ? "text-slate line-through" : "text-graphite"}>
                  {r.item} ×{r.qty}
                  {r.needsApproval && (
                    <span
                      className={`ml-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        r.resolved ? "bg-success-soft text-success" : "bg-warning-soft text-warning"
                      }`}
                    >
                      approval
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {unresolvedApproval > 0 && (
            <p className="mt-2 text-xs text-warning">
              Tick the box next to each approval-flagged item once it&apos;s been obtained, or add a waiver note
              in the closure report.
            </p>
          )}
        </div>
      )}

      {!readOnly && (isAssigned || isOngoing) && (
        <div className="flex flex-wrap items-center gap-2">
          {isAssigned && (
            <button className="btn btn-primary btn-sm" onClick={() => void act("start")} disabled={busy}>
              <PlayCircle className="h-3.5 w-3.5" aria-hidden /> Start job
            </button>
          )}
          {isOngoing && (
            <>
              <button className="btn btn-primary btn-sm" onClick={() => setMode("complete")}>
                Complete job
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setMode("block")}>
                Set blocked
              </button>
            </>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => setMode("req")}>
            + Requirement
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => void draftRequirements()} disabled={drafting}>
            <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden />
            {drafting ? "Drafting…" : "AI draft"}
          </button>
        </div>
      )}

      {mode === "complete" && (
        <form
          className="flex flex-col gap-2 rounded-xl bg-paper p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void act("complete");
          }}
        >
          <label className="label">Closure report</label>
          <textarea
            className="input resize-none"
            rows={3}
            required
            minLength={5}
            value={note}
            placeholder="What was fixed, when, and verification notes…"
            onChange={(e) => setNote(e.target.value)}
          />
          {unresolvedApproval > 0 && (
            <p className="text-xs text-warning">
              {unresolvedApproval} approval-flagged requirement(s) unresolved — you can still submit with a
              waiver note in the report.
            </p>
          )}
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
              Submit report
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMode(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {mode === "block" && (
        <form
          className="flex flex-col gap-2 rounded-xl bg-paper p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void act("block");
          }}
        >
          <label className="label">Blocker reason</label>
          <input
            className="input"
            required
            minLength={3}
            value={note}
            placeholder="Awaiting parts / permission…"
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex gap-2">
            <button type="submit" className="btn btn-ghost btn-sm" disabled={busy}>
              Set blocked
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMode(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {mode === "req" && (
        <form
          className="flex flex-col gap-2 rounded-xl bg-paper p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void addRequirement(e);
          }}
        >
          <div className="grid grid-cols-[1fr_64px] gap-2">
            <input
              className="input"
              required
              minLength={2}
              value={reqItem}
              placeholder="e.g. Ceiling fan replacement"
              onChange={(e) => setReqItem(e.target.value)}
            />
            <input
              className="input"
              type="number"
              min={0}
              value={reqQty}
              onChange={(e) => setReqQty(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate">
            <input
              type="checkbox"
              checked={reqApproval}
              onChange={(e) => setReqApproval(e.target.checked)}
            />
            Needs purchase approval
          </label>
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
              Add requirement
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMode(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {isBlocked && (
        <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
          Blocked while awaiting parts or permissions. The department validator can reassign.
        </p>
      )}

      {issue.status === "COMPLETED" && (
        <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
          Awaiting verification by the department validator.
        </p>
      )}

      {issue.status === "VERIFIED" && issue.verification && (
        <div className="rounded-lg bg-success-soft px-3 py-2 text-xs text-success">
          <p className="font-medium">Verified by {issue.verification.verifiedBy.name}</p>
          {issue.verification.note && <p className="mt-1">{issue.verification.note}</p>}
          <p className="mt-1 text-slate">on {formatDateTime(issue.verification.verifiedAt)}</p>
        </div>
      )}

      {issue.status === "PENDING" && issue.verification?.sendBackReason && (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
          Sent back: {issue.verification.sendBackReason}
        </p>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { ListChecks, PlayCircle, Sparkles, X } from "lucide-react";
import type { Issue, Requirement } from "@/lib/types";
import { api } from "@/lib/clientApi";
import { StatusBadge, PriorityBadge } from "@/components/ui/Badge";
import { IssuePhotos } from "@/components/ui/IssuePhotos";
import { Modal } from "@/components/ui/Modal";
import { FeedbackStars } from "@/components/ui/FeedbackStars";
import { formatDateTime } from "@/lib/format";
import { useActionError } from "@/components/ui/Toast";
import { useAuth } from "@/components/auth/AuthProvider";
import { RequirementCheck } from "@/components/issues/RequirementCheck";

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
  const { user, claims } = useAuth();
  const [mode, setMode] = useState<"start" | "block" | "complete" | "req" | null>(null);
  const [note, setNote] = useState("");
  const [reqItem, setReqItem] = useState("");
  const [reqQty, setReqQty] = useState("1");
  const [reqApproval, setReqApproval] = useState(false);
  const [busy, setBusy] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const { showError, errorEl } = useActionError();
  const canRemove =
    claims?.role === "admin" ||
    (claims?.role === "maintenance" && !!user && issue.routing?.staff?.some((s) => s.uid === user.uid));

  const act = useCallback(
    async (kind: "start" | "block" | "complete") => {
      setBusy(true);
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
        showError(e);
      } finally {
        setBusy(false);
      }
    },
    [issue.id, note, onRefresh, showError]
  );

  const addRequirement = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setBusy(true);
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
        showError(e2);
      } finally {
        setBusy(false);
      }
    },
    [issue.id, reqItem, reqQty, reqApproval, onRefresh, showError]
  );

  const draftRequirements = useCallback(async () => {
    setDrafting(true);
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
      showError(e);
    } finally {
      setDrafting(false);
    }
  }, [issue.id, onRefresh, showError]);

  const toggleRequirement = useCallback(
    async (r: Requirement) => {
      try {
        await api(`/api/issues/${issue.id}/requirements/${(r as Requirement & { id?: string }).id}`, {
          method: "PATCH",
          body: JSON.stringify({ resolved: !r.resolved }),
        });
        onRefresh();
      } catch {
        showError("Failed to update requirement.");
      }
    },
    [issue.id, onRefresh, showError]
  );

  const resubmitRequirement = useCallback(
    async (r: Requirement) => {
      setBusy(true);
      try {
        await api(`/api/issues/${issue.id}/requirements/${(r as Requirement & { id?: string }).id}`, {
          method: "PATCH",
          body: JSON.stringify({ item: r.item, qty: r.qty }),
        });
        onRefresh();
      } catch (e) {
        showError(e);
      } finally {
        setBusy(false);
      }
    },
    [issue.id, onRefresh, showError]
  );

  const removeRequirement = useCallback(
    async (r: Requirement) => {
      setBusy(true);
      try {
        await api(`/api/issues/${issue.id}/requirements/${(r as Requirement & { id?: string }).id}`, {
          method: "DELETE",
        });
        onRefresh();
      } catch (e) {
        showError(e);
      } finally {
        setBusy(false);
      }
    },
    [issue.id, onRefresh, showError]
  );

  const isAssigned = issue.status === "ASSIGNED";
  const isOngoing = issue.status === "ONGOING";
  const isBlocked = issue.status === "PENDING";
  const unresolvedApproval = issue.requirements.filter((r) => r.needsApproval && !r.resolved).length;

  const completeForm = (
    <form
      className="flex flex-col gap-2"
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
          {unresolvedApproval} approval-flagged requirement(s) unresolved — the job can&apos;t be completed until the
          purchase team approves them.
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
  );

  const blockForm = (
    <form
      className="flex flex-col gap-2"
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
  );

  const reqForm = (
    <form
      className="flex flex-col gap-2"
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
  );

  const actions = !readOnly && (
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
      {issue.status !== "CLOSED" && (
        <>
          <button className="btn btn-ghost btn-sm" onClick={() => setMode("req")}>
            + Requirement
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => void draftRequirements()} disabled={drafting}>
            <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden />
            {drafting ? "Drafting…" : "AI draft"}
          </button>
        </>
      )}
    </div>
  );

  const statusNote = isBlocked ? (
    <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
      Blocked while awaiting parts or permissions. The department validator can reassign.
    </p>
  ) : issue.status === "COMPLETED" ? (
    <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
      Awaiting in-site verification by your category head.
    </p>
  ) : issue.status === "INSPECTED" ? (
    <div className="rounded-lg bg-success-soft px-3 py-2 text-xs text-success">
      <p className="font-medium">
        In-site verified{issue.inspection?.inspectedBy ? ` by ${issue.inspection.inspectedBy.name}` : ""}
      </p>
      {issue.inspection?.verdict && <p className="mt-1">{issue.inspection.verdict}</p>}
    </div>
  ) : issue.status === "VERIFIED" && issue.verification ? (
    <div className="rounded-lg bg-success-soft px-3 py-2 text-xs text-success">
      <p className="font-medium">Verified by {issue.verification.verifiedBy.name}</p>
      {issue.verification.note && <p className="mt-1">{issue.verification.note}</p>}
      <p className="mt-1 text-slate">on {formatDateTime(issue.verification.verifiedAt)}</p>
    </div>
  ) : issue.status === "PENDING" && issue.verification?.sendBackReason ? (
    <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
      Sent back: {issue.verification.sendBackReason}
    </p>
  ) : null;

  return (
    <div className="card flex h-full flex-col gap-3">
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
        <p className="line-clamp-2 text-sm text-slate max-md:text-[13px]">{issue.description}</p>
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

      <IssuePhotos images={issue.images} placeholder />

      <div className="rounded-xl bg-paper p-3">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate">
          <ListChecks className="h-3.5 w-3.5" aria-hidden /> Requirements
        </p>
        <ul
          className={`mt-2 flex flex-col gap-1.5 overflow-y-auto pr-1 ${
            issue.requirements.length > 2 ? "max-h-[54px] sm:max-h-[40px]" : ""
          }`}
        >
          {issue.requirements.length === 0 && (
            <li className="text-xs text-stone">No requirements logged yet.</li>
          )}
            {issue.requirements.map((r, i) => {
            const isApproval = !!r.needsApproval;
            const isApprovalRejected = isApproval && r.approvalStatus === "rejected";
            const isApprovalApproved = isApproval && r.approvalStatus === "approved";
            const toggleable = !isApproval;
            return (
              <li key={`${(r as Requirement & { id?: string }).id || i}`} className="flex items-center gap-3 text-sm">
                {readOnly || !toggleable ? (
                  <RequirementCheck
                    checked={r.resolved}
                    disabled
                    title={r.resolved ? "Resolved" : "Unresolved"}
                  />
                ) : (
                  <RequirementCheck
                    checked={r.resolved}
                    onToggle={() => void toggleRequirement(r)}
                    title={r.resolved ? "Mark as unresolved" : "Mark as resolved"}
                  />
                )}
                <span className={`min-w-0 flex-1 truncate ${r.resolved ? "text-slate line-through" : "text-graphite"}`}>
                  {r.item} ×{r.qty}
                </span>
                {isApproval && (
                  isApprovalApproved ? (
                    <span
                      className="rounded bg-success-soft px-1.5 py-0.5 text-[10px] font-medium text-success"
                      title={r.approvalBy?.name ? `Approved by ${r.approvalBy.name}` : "Approved"}
                    >
                      Approved · ₹{r.price ?? 0}
                    </span>
                  ) : isApprovalRejected ? (
                    <span
                      className="rounded bg-danger-soft px-1.5 py-0.5 text-[10px] font-medium text-danger"
                      title={r.rejectReason || "Rejected"}
                    >
                      Rejected
                    </span>
                  ) : (
                    <span className="rounded bg-warning-soft px-1.5 py-0.5 text-[10px] font-medium text-warning">
                      Awaiting approval
                    </span>
                  )
                )}
                {isApprovalRejected && !readOnly && (
                  <button
                    type="button"
                    onClick={() => void resubmitRequirement(r)}
                    disabled={busy}
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    Resubmit
                  </button>
                )}
                {!readOnly && canRemove && !isApproval && (
                  <button
                    type="button"
                    onClick={() => void removeRequirement(r)}
                    disabled={busy}
                    aria-label={`Remove requirement ${r.item}`}
                    title="Remove requirement"
                    className="ml-auto rounded p-0.5 text-slate transition-colors hover:bg-danger-soft hover:text-danger"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                )}
              </li>
            );
          })}
          </ul>
          {unresolvedApproval > 0 && (
            <p className="mt-2 text-xs text-warning">
              {unresolvedApproval} approval-flagged item(s) awaiting purchase team approval. The job can&apos;t be
              completed until they&apos;re approved.
            </p>
          )}
        </div>

      <div className="mt-auto flex flex-col gap-2">
        {actions}
        {statusNote}
        {issue.status === "CLOSED" && issue.feedback?.rating && (
          <div className="flex justify-end pt-1">
            <FeedbackStars rating={issue.feedback.rating} size={16} />
          </div>
        )}
      </div>

      {errorEl}

      <Modal open={mode === "complete"} onClose={() => setMode(null)} title="Complete job">
        {completeForm}
      </Modal>
      <Modal open={mode === "block"} onClose={() => setMode(null)} title="Set blocked">
        {blockForm}
      </Modal>
      <Modal open={mode === "req"} onClose={() => setMode(null)} title="Add requirement">
        {reqForm}
      </Modal>
    </div>
  );
}

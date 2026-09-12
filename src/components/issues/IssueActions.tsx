"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import type { Issue, Requirement, Role, TeamWithMembers } from "@/lib/types";
import { api } from "@/lib/clientApi";
import { useAuth } from "@/components/auth/AuthProvider";
import { useActionError } from "@/components/ui/Toast";
import { RequirementCheck } from "@/components/issues/RequirementCheck";
import { canApproveEscalation } from "@/lib/escalationBand";

interface Props {
  issue: Issue;
  onChanged: () => void;
}

export function IssueActions({ issue, onChanged }: Props) {
  const { claims } = useAuth();
  const { showError, errorEl } = useActionError();
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async (path: string, body: unknown) => {
      setBusy(true);
      try {
        await api(path, { method: "POST", body: JSON.stringify(body) });
        onChanged();
      } catch (e) {
        showError(e);
      } finally {
        setBusy(false);
      }
    },
    [onChanged, showError]
  );

  if (!claims) return null;
  const role = claims.role;

  if (role === "validator" && issue.status === "NEW") {
    return <ValidatorActions issue={issue} onChanged={onChanged} />;
  }

  if (role === "validator") {
    if (issue.status === "VALIDATED") {
      return (
        <div className="flex flex-col gap-4">
          <AssignPanel issue={issue} onChanged={onChanged} />
          <div className="card">
            <p className="text-sm text-slate">This issue is awaiting HOD/Principal approval.</p>
            <button
              className="btn btn-ghost btn-sm mt-3"
              disabled={busy}
              onClick={() => void run(`/api/issues/${issue.id}/escalate`, { note: "Escalated." })}
            >
              {busy ? "Escalating…" : "Escalate again"}
            </button>
            {errorEl}
          </div>
        </div>
      );
    }
    if (["APPROVED", "PENDING"].includes(issue.status)) {
      return (
        <div className="flex flex-col gap-4">
          <ForwardPanel
            issue={issue}
            onChanged={onChanged}
            to={issue.status === "APPROVED" ? "ROUTED" : "PENDING_ASSIGN"}
          />
          <AssignPanel issue={issue} onChanged={onChanged} />
        </div>
      );
    }
  }

  // Severity-band approval: P1 → Principal, P2 → HOD (portal roles included).
  const approverRole = (claims.portal ?? claims.role) as Role;
  if (
    (role === "hod" || role === "principal" || claims.portal) &&
    issue.status === "ESCALATED" &&
    canApproveEscalation(approverRole, issue.priority)
  ) {
    return (
      <div className="card">
        <p className="font-medium text-graphite">Approve this escalation</p>
        <div className="mt-3 flex items-center gap-3">
          <button
            className="btn btn-primary btn-sm"
            disabled={busy}
            onClick={() => void run(`/api/issues/${issue.id}/approve`, { note: "Approved for execution." })}
          >
            {busy ? "Approving…" : "Approve & route to validator"}
          </button>
          {errorEl}
        </div>
      </div>
    );
  }

  if (role === "maintenance") {
    if (issue.status === "ASSIGNED") {
      return <AssignedActions issue={issue} onChanged={onChanged} />;
    }
    if (issue.status === "ONGOING") {
      return <MaintenanceComplete issue={issue} onChanged={onChanged} />;
    }
    if (issue.status === "COMPLETED") {
      return (
        <div className="card">
          <p className="text-sm text-warning">Awaiting in-site verification by your category head.</p>
        </div>
      );
    }
    if (issue.status === "INSPECTED") {
      return (
        <div className="card">
          <p className="text-sm text-success">
            In-site verified by {issue.inspection?.inspectedBy.name || "the category head"} — awaiting reporter review.
          </p>
        </div>
      );
    }
    if (issue.status === "VERIFIED" && issue.verification) {
      return (
        <div className="card">
          <p className="text-sm text-success">Verified by {issue.verification.verifiedBy.name}.</p>
          {issue.verification.note && <p className="mt-1 text-sm text-slate">{issue.verification.note}</p>}
        </div>
      );
    }
  }

  if (role === "maintenance_head") {
    if (issue.status === "ROUTED" || issue.status === "PENDING_ASSIGN") {
      return (
        <div className="flex flex-col gap-4">
          <ForwardPanel issue={issue} onChanged={onChanged} />
          {issue.status === "PENDING_ASSIGN" && <AssignPanel issue={issue} onChanged={onChanged} />}
        </div>
      );
    }
  }

  if (role === "category_head") {
    if (issue.status === "PENDING_ASSIGN") return <AssignPanel issue={issue} onChanged={onChanged} />;
    if (issue.status === "COMPLETED") {
      return (
        <VerifyPanel
          issue={issue}
          onChanged={onChanged}
          to="INSPECTED"
          title="In-site verification"
          verifyLabel="Verify"
        />
      );
    }
  }

  return null;
}

function ValidatorActions({ issue, onChanged }: { issue: Issue; onChanged: () => void }) {
  const defaultPriority =
    issue.priority >= 1 && issue.priority <= 5
      ? String(issue.priority)
      : issue.aiSuggestion?.suggestedPriority && issue.aiSuggestion.suggestedPriority >= 1 && issue.aiSuggestion.suggestedPriority <= 5
        ? String(issue.aiSuggestion.suggestedPriority)
        : "3";
  const [priority, setPriority] = useState(defaultPriority);
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);
  const { showError, errorEl } = useActionError();

  const act = useCallback(
    async (kind: "validate" | "reject") => {
      setBusy(true);
      try {
        if (kind === "validate") {
          await api(`/api/issues/${issue.id}/validate`, { method: "POST", body: JSON.stringify({ priority: Number(priority) }) });
        } else {
          await api(`/api/issues/${issue.id}/reject`, { method: "POST", body: JSON.stringify({ rejectionReason: rejectReason }) });
        }
        onChanged();
      } catch (e) {
        showError(e);
      } finally {
        setBusy(false);
      }
    },
    [issue.id, priority, rejectReason, onChanged, showError]
  );

  return (
    <div className="card flex flex-col gap-3">
      <p className="font-medium text-graphite">Validate this issue</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div>
          <label className="label" htmlFor="prio">
            Priority (1 = critical)
          </label>
          <select id="prio" className="input w-auto" value={priority} onChange={(e) => setPriority(e.target.value)}>
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
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => void act("validate")}>
          {busy ? "Validating…" : "Validate & auto-route"}
        </button>
        <input
          className="input flex-1"
          placeholder="Rejection reason (min 3 chars)"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
        <button className="btn btn-danger btn-sm" disabled={busy || rejectReason.trim().length < 3} onClick={() => void act("reject")}>
          Reject
        </button>
      </div>
      {errorEl}
    </div>
  );
}

function VerifyPanel({
  issue,
  onChanged,
  to,
  title = "Verify completion",
  verifyLabel = "Verify",
  placeholder = "Verification note",
}: {
  issue: Issue;
  onChanged: () => void;
  to: "INSPECTED" | "VERIFIED";
  title?: string;
  verifyLabel?: string;
  placeholder?: string;
}) {
  const [verdict, setVerdict] = useState("");
  const [sendBack, setSendBack] = useState("");
  const [busy, setBusy] = useState(false);
  const { showError, errorEl } = useActionError();

  const act = useCallback(
    async (kind: "verify" | "sendback") => {
      setBusy(true);
      try {
        if (kind === "verify") {
          const endpoint = to === "INSPECTED" ? "inspect" : "verify";
          await api(`/api/issues/${issue.id}/${endpoint}`, {
            method: "POST",
            body: JSON.stringify({ verdict: verdict || "Verified." }),
          });
        } else {
          await api(`/api/issues/${issue.id}/sendback`, { method: "POST", body: JSON.stringify({ sendBackReason: sendBack }) });
        }
        onChanged();
      } catch (e) {
        showError(e);
      } finally {
        setBusy(false);
      }
    },
    [issue.id, verdict, sendBack, to, onChanged, showError]
  );

  return (
    <div className="card">
      <p className="font-medium text-graphite">{title}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input className="input flex-1" placeholder={placeholder} value={verdict} onChange={(e) => setVerdict(e.target.value)} />
        <input className="input flex-1" placeholder="Send-back reason" value={sendBack} onChange={(e) => setSendBack(e.target.value)} />
        <div className="flex gap-2">
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => void act("verify")}>
            {busy ? "Saving…" : verifyLabel}
          </button>
          <button className="btn btn-ghost btn-sm" disabled={busy || sendBack.trim().length < 3} onClick={() => void act("sendback")}>
            Send back
          </button>
        </div>
      </div>
      {errorEl}
    </div>
  );
}

function MaintenanceComplete({ issue, onChanged }: { issue: Issue; onChanged: () => void }) {
  const [report, setReport] = useState("");
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [busy, setBusy] = useState(false);
  const { showError, errorEl } = useActionError();
  const unresolvedApproval = issue.requirements.filter((r) => !r.resolved && r.needsApproval).length;

  const complete = useCallback(async () => {
    setBusy(true);
    try {
      await api(`/api/issues/${issue.id}/complete`, {
        method: "POST",
        body: JSON.stringify({ note: report }),
      });
      onChanged();
    } catch (e) {
      showError(e);
      setBusy(false);
    }
  }, [issue.id, report, onChanged, showError]);

  const block = useCallback(async () => {
    setBusy(true);
    try {
      await api(`/api/issues/${issue.id}/pending`, {
        method: "POST",
        body: JSON.stringify({ note: blockReason }),
      });
      onChanged();
    } catch (e) {
      showError(e);
      setBusy(false);
    }
  }, [issue.id, blockReason, onChanged, showError]);

  return (
    <div className="card flex flex-col gap-3">
      <p className="font-medium text-graphite">Complete this job</p>
      <textarea
        value={report}
        onChange={(e) => setReport(e.target.value)}
        className="input resize-none"
        rows={3}
        minLength={5}
        placeholder="Closure report: what was fixed and how… (required)"
      />
      {unresolvedApproval > 0 && (
        <p className="text-xs text-warning">
          {unresolvedApproval} approval-flagged requirement(s) unresolved — the job can&apos;t be completed until the
          purchase team approves them.
        </p>
      )}
      <div className="flex gap-2">
        <button
          className="btn btn-primary btn-sm"
          disabled={busy || report.trim().length < 5}
          onClick={() => void complete()}
        >
          {busy ? "Submitting…" : "Submit & complete"}
        </button>
        <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setBlockOpen((v) => !v)}>
          Set blocked
        </button>
      </div>
      {blockOpen && (
        <form
          className="flex flex-col gap-2 rounded-xl bg-paper p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void block();
          }}
        >
          <label className="label">Blocker reason</label>
          <input
            className="input"
            required
            minLength={3}
            value={blockReason}
            placeholder="Awaiting parts / permission…"
            onChange={(e) => setBlockReason(e.target.value)}
          />
          <div className="flex gap-2">
            <button type="submit" className="btn btn-ghost btn-sm" disabled={busy}>
              {busy ? "Setting blocked…" : "Confirm blocked"}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setBlockOpen(false);
                setBlockReason("");
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {errorEl}
    </div>
  );
}

function AssignedActions({ issue, onChanged }: { issue: Issue; onChanged: () => void }) {
  const [blockOpen, setBlockOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const { showError, errorEl } = useActionError();

  const run = useCallback(
    async (path: string, body: unknown) => {
      setBusy(true);
      try {
        await api(path, { method: "POST", body: JSON.stringify(body) });
        onChanged();
      } catch (e) {
        showError(e);
        setBusy(false);
      }
    },
    [onChanged, showError]
  );

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="btn btn-primary btn-sm"
          disabled={busy}
          onClick={() => void run(`/api/issues/${issue.id}/status`, { to: "ONGOING", note: "Work started." })}
        >
          {busy ? "Starting…" : "Start job"}
        </button>
        <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setBlockOpen((v) => !v)}>
          Set blocked
        </button>
        {errorEl}
      </div>
      {blockOpen && (
        <form
          className="flex flex-col gap-2 rounded-xl bg-paper p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run(`/api/issues/${issue.id}/pending`, { note: reason });
          }}
        >
          <label className="label">Blocker reason</label>
          <input
            className="input"
            required
            minLength={3}
            value={reason}
            placeholder="Awaiting parts / permission…"
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex gap-2">
            <button type="submit" className="btn btn-ghost btn-sm" disabled={busy}>
              {busy ? "Setting blocked…" : "Confirm blocked"}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setBlockOpen(false);
                setReason("");
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function ForwardPanel({
  issue,
  onChanged,
  to = "PENDING_ASSIGN",
}: {
  issue: Issue;
  onChanged: () => void;
  to?: "ROUTED" | "PENDING_ASSIGN";
}) {
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [categoryId, setCategoryId] = useState(issue.routing?.categoryId || "");
  const [busy, setBusy] = useState(false);
  const { showError, errorEl } = useActionError();
  const hasCategory = Boolean(issue.routing?.categoryId);

  useEffect(() => {
    if (to === "ROUTED" || hasCategory) return;
    void api<{ categories: { id: string; name: string }[] }>("/api/categories")
      .then((res) => setCategories(res.categories))
      .catch(() => showError("Couldn't load categories."));
  }, [to, hasCategory, showError]);

  const forward = useCallback(async () => {
    if (!hasCategory && !categoryId) return;
    setBusy(true);
    try {
      await api(`/api/issues/${issue.id}/forward`, {
        method: "POST",
        body: JSON.stringify({ to, categoryId }),
      });
      onChanged();
    } catch (e) {
      showError(e);
      setBusy(false);
    }
  }, [issue.id, to, categoryId, hasCategory, onChanged, showError]);

  const label =
    to === "ROUTED"
      ? "Route to maintenance head"
      : hasCategory
        ? "Send to category head"
        : "Forward to category";

  return (
    <div className="card flex flex-col gap-3">
      <p className="font-medium text-graphite">
        {to === "ROUTED"
          ? "Dispatch this approved issue to the maintenance head"
          : "Send this job back to the category head for reassignment"}
      </p>
      {!hasCategory && to === "PENDING_ASSIGN" && (
        <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Choose category…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
      <button
        className="btn btn-primary btn-sm self-start"
        disabled={busy || (!hasCategory && !categoryId)}
        onClick={() => void forward()}
      >
        {busy ? "Sending…" : label}
      </button>
      {errorEl}
    </div>
  );
}

function AssignPanel({ issue, onChanged }: { issue: Issue; onChanged: () => void }) {  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [teamId, setTeamId] = useState("");
  const [staff, setStaff] = useState<string[]>([]);
  const [suggestReason, setSuggestReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const { showError, errorEl } = useActionError();

  const loadTeams = useCallback(() => {
    void api<{ teams: TeamWithMembers[] }>("/api/teams")
      .then((res) => {
        setTeams(res.teams);
      })
      .catch(() => showError("Couldn't load teams."));
  }, [showError]);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  const assign = useCallback(async () => {
    setBusy(true);
    try {
      await api(`/api/issues/${issue.id}/assign`, { method: "POST", body: JSON.stringify({ teamId, staff }) });
      onChanged();
    } catch (e) {
      showError(e);
      setBusy(false);
    }
  }, [issue.id, teamId, staff, onChanged, showError]);

  const suggest = useCallback(async () => {
    setSuggesting(true);
    setSuggestReason(null);
    try {
      const res = await api<{ result: { teamId: string; staffIds: string[]; reason: string } }>("/api/ai/suggest-assign", {
        method: "POST",
        body: JSON.stringify({ issueId: issue.id }),
      });
      if (res.result?.teamId) setTeamId(res.result.teamId);
      if (res.result?.staffIds) setStaff(res.result.staffIds);
      setSuggestReason(res.result?.reason || null);
    } catch (e) {
      showError(e);
    } finally {
      setSuggesting(false);
    }
  }, [issue.id, showError]);

  const selectedTeam = teams.find((t) => t.id === teamId);

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="font-medium text-graphite">{issue.status === "PENDING" ? "Reassign this job" : "Assign this job"}</p>
        <button className="btn btn-ghost btn-sm" disabled={suggesting} onClick={() => void suggest()}>
          <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden />
          {suggesting ? "Suggesting…" : "AI suggest"}
        </button>
      </div>
      {suggestReason && <p className="text-xs text-slate">AI suggests this because: {suggestReason}</p>}
      <select
        className="input"
        value={teamId}
        onChange={(e) => {
          setTeamId(e.target.value);
          setStaff([]);
        }}
      >
        <option value="">Select team…</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      {selectedTeam && selectedTeam.members.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTeam.members.map((m) => {
            const checked = staff.includes(m.uid);
            return (
              <button
                key={m.uid}
                type="button"
                className={`tag ${checked ? "bg-ink text-white" : "tag-outline"}`}
                onClick={() => setStaff((prev) => (checked ? prev.filter((s) => s !== m.uid) : [...prev, m.uid]))}
              >
                {m.name}
              </button>
            );
          })}
        </div>
      )}
      {selectedTeam && selectedTeam.members.length === 0 && (
        <p className="text-xs text-warning">This team has no members — add staff to the team in Admin.</p>
      )}
      <div className="flex items-center gap-2">
        <button
          className="btn btn-primary btn-sm"
          disabled={busy || !teamId || staff.length === 0}
          onClick={() => void assign()}
        >
          {busy ? "Assigning…" : issue.status === "PENDING" ? "Reassign" : "Assign"}
        </button>
        {staff.length === 0 && <span className="text-xs text-slate">Select at least one staff member.</span>}
        {errorEl}
      </div>
    </div>
  );
}

export function RequirementsPanel({ issue, onChanged }: { issue: Issue; onChanged: () => void }) {
  const { claims, user } = useAuth();
  const [item, setItem] = useState("");
  const [qty, setQty] = useState("1");
  const [needsApproval, setNeedsApproval] = useState(false);
  const { showError, errorEl } = useActionError();
  const canEdit = claims && ["maintenance", "admin"].includes(claims.role);
  const canRemove =
    claims?.role === "admin" ||
    (claims?.role === "maintenance" && !!user && issue.routing?.staff?.some((s) => s.uid === user.uid));
  const closed = issue.status === "CLOSED";

  const add = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        await api(`/api/issues/${issue.id}/requirements`, {
          method: "POST",
          body: JSON.stringify({ item, qty: Number(qty) || 1, needsApproval }),
        });
        setItem("");
        setQty("1");
        setNeedsApproval(false);
        onChanged();
      } catch (e2) {
        showError(e2);
      }
    },
    [issue.id, item, qty, needsApproval, onChanged, showError]
  );

  const remove = useCallback(
    async (r: Requirement) => {
      try {
        await api(`/api/issues/${issue.id}/requirements/${(r as Requirement & { id?: string }).id}`, {
          method: "DELETE",
        });
        onChanged();
      } catch {
        showError("Failed to remove requirement.");
      }
    },
    [issue.id, onChanged, showError]
  );

  const toggle = useCallback(
    async (r: Requirement) => {
      try {
        await api(`/api/issues/${issue.id}/requirements/${(r as Requirement & { id?: string }).id}`, {
          method: "PATCH",
          body: JSON.stringify({ resolved: !r.resolved }),
        });
        onChanged();
      } catch {
        showError("Failed to update requirement.");
      }
    },
    [issue.id, onChanged, showError]
  );

  const resubmit = useCallback(
    async (r: Requirement) => {
      try {
        await api(`/api/issues/${issue.id}/requirements/${(r as Requirement & { id?: string }).id}`, {
          method: "PATCH",
          body: JSON.stringify({ item: r.item, qty: r.qty }),
        });
        onChanged();
      } catch {
        showError("Failed to resubmit requirement.");
      }
    },
    [issue.id, onChanged, showError]
  );

  return (
    <div className="card">
      <p className="font-medium text-graphite">Requirements</p>
      {issue.requirements.length === 0 ? (
        <p className="mt-2 text-sm text-slate">No requirements logged yet.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1.5">
          {issue.requirements.map((r, i) => {
            const isApproval = !!r.needsApproval;
            const isApprovalApproved = isApproval && r.approvalStatus === "approved";
            const isApprovalRejected = isApproval && r.approvalStatus === "rejected";
            const toggleable = canEdit && !isApproval;
            return (
              <li key={`${(r as Requirement & { id?: string }).id || i}`} className="flex items-center gap-2 text-sm">
                {toggleable ? (
                  <RequirementCheck
                    checked={r.resolved}
                    onToggle={() => void toggle(r)}
                    title={r.resolved ? "Mark as unresolved" : "Mark as resolved"}
                  />
                ) : (
                  <RequirementCheck
                    checked={r.resolved}
                    disabled
                    title={r.resolved ? "Resolved" : "Unresolved"}
                  />
                )}
                <span className={r.resolved ? "text-slate line-through" : "text-graphite"}>
                  {r.item} ×{r.qty}
                  {isApproval &&
                    (isApprovalApproved ? (
                      <span
                        className="ml-1 rounded bg-success-soft px-1.5 py-0.5 text-[10px] font-medium text-success"
                        title={r.approvalBy?.name ? `Approved by ${r.approvalBy.name}` : "Approved"}
                      >
                        Approved · ₹{r.price ?? 0}
                      </span>
                    ) : isApprovalRejected ? (
                      <span
                        className="ml-1 rounded bg-danger-soft px-1.5 py-0.5 text-[10px] font-medium text-danger"
                        title={r.rejectReason || "Rejected"}
                      >
                        Rejected
                      </span>
                    ) : (
                      <span className="ml-1 rounded bg-warning-soft px-1.5 py-0.5 text-[10px] font-medium text-warning">
                        {r.seniorApprovalRequired ? "Awaiting senior approval" : "Awaiting approval"}
                      </span>
                    ))}
                </span>
                {isApprovalRejected && canEdit && (
                  <button type="button" className="text-xs font-medium text-accent hover:underline" onClick={() => void resubmit(r)}>
                    Resubmit
                  </button>
                )}
                {canRemove && !isApproval && (
                  <button
                    type="button"
                    onClick={() => void remove(r)}
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
      )}
      {canEdit && !closed && (
        <form onSubmit={(e) => void add(e)} className="mt-3 flex flex-col gap-2 border-t border-silver pt-3">
          <div className="grid grid-cols-[1fr_64px] gap-2">
            <input className="input col-span-4" placeholder="e.g. LED tube replacement" required minLength={2} value={item} onChange={(e) => setItem(e.target.value)} />
            <input className="input col-span-1" type="number" min={0} value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-slate">
              <input type="checkbox" checked={needsApproval} onChange={(e) => setNeedsApproval(e.target.checked)} />
              Approval
            </label>
            <button type="submit" className="btn btn-primary btn-sm">
              Add
            </button>
          </div>
        </form>
      )}
      {errorEl}
    </div>
  );
}

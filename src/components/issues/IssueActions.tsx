"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import type { Issue, Requirement, TeamWithMembers } from "@/lib/types";
import { api, ApiError } from "@/lib/clientApi";
import { useAuth } from "@/components/auth/AuthProvider";

interface Props {
  issue: Issue;
  onChanged: () => void;
}

export function IssueActions({ issue, onChanged }: Props) {
  const { claims } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (path: string, body: unknown) => {
      setBusy(true);
      setError(null);
      try {
        await api(path, { method: "POST", body: JSON.stringify(body) });
        onChanged();
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Action failed.");
      } finally {
        setBusy(false);
      }
    },
    [onChanged]
  );

  if (!claims) return null;
  const role = claims.role;

  if (role === "reporter" && issue.status === "VERIFIED") {
    return <ReporterFeedback issue={issue} onDone={onChanged} />;
  }

  if (role === "validator" && issue.status === "NEW") {
    return <ValidatorActions issue={issue} onChanged={onChanged} />;
  }

  if (role === "validator" && issue.status === "VALIDATED") {
    return (
      <div className="card">
        <p className="text-sm text-slate">This issue is awaiting HOD/Principal approval.</p>
        <button
          className="btn btn-ghost btn-sm mt-3"
          disabled={busy}
          onClick={() => void run(`/api/issues/${issue.id}/escalate`, { note: "Escalated." })}
        >
          {busy ? "Escalating…" : "Escalate again"}
        </button>
        {error && <p className="mt-2 text-sm text-[#c0392b]">{error}</p>}
      </div>
    );
  }

  if (["hod", "principal"].includes(role) && issue.status === "ESCALATED") {
    return (
      <div className="card">
        <p className="font-medium text-graphite">Approve this escalation</p>
        <div className="mt-3 flex items-center gap-3">
          <button
            className="btn btn-primary btn-sm"
            disabled={busy}
            onClick={() => void run(`/api/issues/${issue.id}/approve`, { note: "Approved for execution." })}
          >
            {busy ? "Approving…" : "Approve & route to head"}
          </button>
          {error && <span className="text-sm text-[#c0392b]">{error}</span>}
        </div>
      </div>
    );
  }

  if (role === "head") {
    if (["APPROVED", "ESCALATED", "PENDING"].includes(issue.status)) {
      return <HeadAssign issue={issue} onChanged={onChanged} />;
    }
    if (issue.status === "COMPLETED") {
      return <HeadVerify issue={issue} onChanged={onChanged} />;
    }
  }

  if (role === "maintenance") {
    if (issue.status === "ASSIGNED") {
      return (
        <div className="card flex flex-wrap items-center gap-2">
          <button
            className="btn btn-primary btn-sm"
            disabled={busy}
            onClick={() => void run(`/api/issues/${issue.id}/status`, { to: "ONGOING", note: "Work started." })}
          >
            {busy ? "Starting…" : "Start job"}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            disabled={busy}
            onClick={() => void run(`/api/issues/${issue.id}/pending`, { note: "Blocked" })}
          >
            Set blocked
          </button>
          {error && <span className="text-sm text-[#c0392b]">{error}</span>}
        </div>
      );
    }
    if (issue.status === "ONGOING") {
      return <MaintenanceComplete issue={issue} onChanged={onChanged} />;
    }
    if (issue.status === "COMPLETED") {
      return (
        <div className="card">
          <p className="text-sm text-[#d97706]">Awaiting verification by the maintenance head.</p>
        </div>
      );
    }
    if (issue.status === "VERIFIED" && issue.verification) {
      return (
        <div className="card">
          <p className="text-sm text-[#2e7d32]">Verified by {issue.verification.verifiedBy.name}.</p>
          {issue.verification.note && <p className="mt-1 text-sm text-slate">{issue.verification.note}</p>}
        </div>
      );
    }
  }

  return null;
}

function ValidatorActions({ issue, onChanged }: { issue: Issue; onChanged: () => void }) {
  const [priority, setPriority] = useState("3");
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const act = useCallback(
    async (kind: "validate" | "reject") => {
      setBusy(true);
      setError(null);
      try {
        if (kind === "validate") {
          await api(`/api/issues/${issue.id}/validate`, { method: "POST", body: JSON.stringify({ priority: Number(priority) }) });
        } else {
          await api(`/api/issues/${issue.id}/reject`, { method: "POST", body: JSON.stringify({ rejectionReason: rejectReason }) });
        }
        onChanged();
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Action failed.");
      } finally {
        setBusy(false);
      }
    },
    [issue.id, priority, rejectReason, onChanged]
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
      {error && <p className="text-sm text-[#c0392b]">{error}</p>}
    </div>
  );
}

function ReporterFeedback({ issue, onDone }: { issue: Issue; onDone: () => void }) {
  const [rating, setRating] = useState(1);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/issues/${issue.id}/feedback`, {
        method: "POST",
        body: JSON.stringify({ rating, comment: comment || undefined }),
      });
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to submit feedback.");
      setBusy(false);
    }
  }, [issue.id, rating, comment, onDone]);

  return (
    <div className="card">
      <p className="font-medium text-graphite">Job verified — rate the resolution</p>
      <div className="mt-3 flex items-center gap-1.5">
        {[1, 2, 3].map((r) => (
          <button
            key={r}
            type="button"
            className={`btn btn-sm ${rating === r ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setRating(r)}
          >
            {r === 1 ? "Excellent" : r === 2 ? "OK" : "Poor"}
          </button>
        ))}
      </div>
      <input className="input mt-3" placeholder="Optional comment" value={comment} maxLength={500} onChange={(e) => setComment(e.target.value)} />
      <div className="mt-3 flex items-center gap-2">
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => void submit()}>
          {busy ? "Closing…" : "Close issue"}
        </button>
        {error && <span className="text-sm text-[#c0392b]">{error}</span>}
      </div>
    </div>
  );
}

function HeadVerify({ issue, onChanged }: { issue: Issue; onChanged: () => void }) {
  const [verdict, setVerdict] = useState("");
  const [sendBack, setSendBack] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const act = useCallback(
    async (kind: "verify" | "sendback") => {
      setBusy(true);
      setError(null);
      try {
        if (kind === "verify") {
          await api(`/api/issues/${issue.id}/verify`, { method: "POST", body: JSON.stringify({ verdict: verdict || "Verified." }) });
        } else {
          await api(`/api/issues/${issue.id}/sendback`, { method: "POST", body: JSON.stringify({ sendBackReason: sendBack }) });
        }
        onChanged();
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Action failed.");
      } finally {
        setBusy(false);
      }
    },
    [issue.id, verdict, sendBack, onChanged]
  );

  return (
    <div className="card">
      <p className="font-medium text-graphite">Verify completion</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input className="input flex-1" placeholder="Verification note" value={verdict} onChange={(e) => setVerdict(e.target.value)} />
        <input className="input flex-1" placeholder="Send-back reason" value={sendBack} onChange={(e) => setSendBack(e.target.value)} />
        <div className="flex gap-2">
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => void act("verify")}>
            {busy ? "Verifying…" : "Verify"}
          </button>
          <button className="btn btn-ghost btn-sm" disabled={busy || sendBack.trim().length < 3} onClick={() => void act("sendback")}>
            Send back
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-[#c0392b]">{error}</p>}
    </div>
  );
}

function MaintenanceComplete({ issue, onChanged }: { issue: Issue; onChanged: () => void }) {
  const reportRef = useRef<HTMLTextAreaElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unresolvedApproval = issue.requirements.filter((r) => !r.resolved && r.needsApproval).length;

  const complete = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/issues/${issue.id}/complete`, {
        method: "POST",
        body: JSON.stringify({ note: reportRef.current?.value || "Work completed." }),
      });
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to complete.");
      setBusy(false);
    }
  }, [issue.id, onChanged]);

  return (
    <div className="card flex flex-col gap-3">
      <p className="font-medium text-graphite">Complete this job</p>
      <textarea ref={reportRef} className="input resize-none" rows={3} minLength={5} placeholder="Closure report: what was fixed and how…" />
      {unresolvedApproval > 0 && (
        <p className="text-xs text-[#d97706]">
          {unresolvedApproval} approval-flagged requirement(s) unresolved — add a waiver note to the report.
        </p>
      )}
      <div className="flex gap-2">
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => void complete()}>
          {busy ? "Submitting…" : "Submit & complete"}
        </button>
        <button
          className="btn btn-ghost btn-sm"
          disabled={busy}
          onClick={() => void api(`/api/issues/${issue.id}/pending`, { method: "POST", body: JSON.stringify({ note: "Blocked" }) }).then(onChanged)}
        >
          Set blocked
        </button>
      </div>
      {error && <p className="text-sm text-[#c0392b]">{error}</p>}
    </div>
  );
}

function HeadAssign({ issue, onChanged }: { issue: Issue; onChanged: () => void }) {
  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [teamId, setTeamId] = useState("");
  const [staff, setStaff] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api<{ teams: TeamWithMembers[] }>("/api/teams")
      .then((res) => {
        setTeams(res.teams);
        if (!teamId && res.teams.length) setTeamId(res.teams[0].id);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const assign = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/issues/${issue.id}/assign`, { method: "POST", body: JSON.stringify({ teamId, staff }) });
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Assignment failed.");
      setBusy(false);
    }
  }, [issue.id, teamId, staff, onChanged]);

  const suggest = useCallback(async () => {
    setSuggesting(true);
    setError(null);
    try {
      const res = await api<{ result: { teamId: string; staffIds: string[] } }>("/api/ai/suggest-assign", {
        method: "POST",
        body: JSON.stringify({ issueId: issue.id }),
      });
      if (res.result?.teamId) setTeamId(res.result.teamId);
      if (res.result?.staffIds) setStaff(res.result.staffIds);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Suggestion failed.");
    } finally {
      setSuggesting(false);
    }
  }, [issue.id]);

  const selectedTeam = teams.find((t) => t.id === teamId);

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="font-medium text-graphite">{issue.status === "PENDING" ? "Reassign this job" : "Assign this job"}</p>
        <button className="btn btn-ghost btn-sm" disabled={suggesting} onClick={() => void suggest()}>
          <Sparkles className="h-3.5 w-3.5 text-action-blue" aria-hidden />
          {suggesting ? "Suggesting…" : "AI suggest"}
        </button>
      </div>
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
      <div className="flex items-center gap-2">
        <button className="btn btn-primary btn-sm" disabled={busy || !teamId} onClick={() => void assign()}>
          {busy ? "Assigning…" : issue.status === "PENDING" ? "Reassign" : "Assign"}
        </button>
        {error && <span className="text-sm text-[#c0392b]">{error}</span>}
      </div>
    </div>
  );
}

export function RequirementsPanel({ issue, onChanged }: { issue: Issue; onChanged: () => void }) {
  const { claims } = useAuth();
  const [item, setItem] = useState("");
  const [qty, setQty] = useState("1");
  const [needsApproval, setNeedsApproval] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canEdit = claims && ["maintenance", "head", "admin"].includes(claims.role);

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
        setError(e2 instanceof ApiError ? e2.message : "Failed to add requirement.");
      }
    },
    [issue.id, item, qty, needsApproval, onChanged]
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
        setError("Failed to update requirement.");
      }
    },
    [issue.id, onChanged]
  );

  return (
    <div className="card">
      <p className="font-medium text-graphite">Requirements</p>
      {issue.requirements.length === 0 ? (
        <p className="mt-2 text-sm text-slate">No requirements logged yet.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1.5">
          {issue.requirements.map((r, i) => (
            <li key={`${(r as Requirement & { id?: string }).id || i}`} className="flex items-center gap-2 text-sm">
              {canEdit ? (
                <button
                  type="button"
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border-2 transition-colors ${
                    r.resolved
                      ? "border-[#2e7d32] bg-[#2e7d32] text-white"
                      : "border-slate bg-white hover:border-ink"
                  }`}
                  aria-label={r.resolved ? "Mark as unresolved" : "Mark as resolved"}
                  title={r.resolved ? "Mark as unresolved" : "Mark as resolved"}
                  onClick={() => void toggle(r)}
                >
                  {r.resolved && <span className="text-xl leading-none">✓</span>}
                </button>
              ) : (
                <span
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border-2 ${
                    r.resolved ? "border-[#2e7d32] bg-[#2e7d32]" : "border-slate"
                  }`}
                />
              )}
              <span className={r.resolved ? "text-slate line-through" : "text-graphite"}>
                {r.item} ×{r.qty}
                {r.needsApproval && (
                  <span
                    className={`ml-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      r.resolved ? "bg-[#ecfdf5] text-[#2e7d32]" : "bg-[#fffbeb] text-[#d97706]"
                    }`}
                  >
                    approval
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <form onSubmit={(e) => void add(e)} className="mt-3 flex flex-col gap-2 border-t border-silver pt-3">
          <div className="grid grid-cols-5 gap-2">
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
      {error && <p className="mt-2 text-sm text-[#c0392b]">{error}</p>}
    </div>
  );
}

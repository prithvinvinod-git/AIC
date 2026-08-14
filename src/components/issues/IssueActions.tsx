"use client";

import { useCallback, useEffect, useState } from "react";
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
            {error && <p className="mt-2 text-sm text-danger">{error}</p>}
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
    if (issue.status === "COMPLETED") {
      return <VerifyPanel issue={issue} onChanged={onChanged} />;
    }
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
            {busy ? "Approving…" : "Approve & route to validator"}
          </button>
          {error && <span className="text-sm text-danger">{error}</span>}
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
          <p className="text-sm text-warning">Awaiting verification by the department validator.</p>
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

  if (role === "category_head" && issue.status === "PENDING_ASSIGN") {
    return <AssignPanel issue={issue} onChanged={onChanged} />;
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
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

function VerifyPanel({ issue, onChanged }: { issue: Issue; onChanged: () => void }) {
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
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}

function MaintenanceComplete({ issue, onChanged }: { issue: Issue; onChanged: () => void }) {
  const [report, setReport] = useState("");
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unresolvedApproval = issue.requirements.filter((r) => !r.resolved && r.needsApproval).length;

  const complete = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/issues/${issue.id}/complete`, {
        method: "POST",
        body: JSON.stringify({ note: report }),
      });
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to complete.");
      setBusy(false);
    }
  }, [issue.id, report, onChanged]);

  const block = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/issues/${issue.id}/pending`, {
        method: "POST",
        body: JSON.stringify({ note: blockReason }),
      });
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Action failed.");
      setBusy(false);
    }
  }, [issue.id, blockReason, onChanged]);

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
          {unresolvedApproval} approval-flagged requirement(s) unresolved — add a waiver note to the report.
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
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

function AssignedActions({ issue, onChanged }: { issue: Issue; onChanged: () => void }) {
  const [blockOpen, setBlockOpen] = useState(false);
  const [reason, setReason] = useState("");
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
        setBusy(false);
      }
    },
    [onChanged]
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
        {error && <span className="text-sm text-danger">{error}</span>}
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
  const [error, setError] = useState<string | null>(null);
  const hasCategory = Boolean(issue.routing?.categoryId);

  useEffect(() => {
    if (to === "ROUTED" || hasCategory) return;
    void api<{ categories: { id: string; name: string }[] }>("/api/categories")
      .then((res) => setCategories(res.categories))
      .catch(() => setError("Couldn't load categories."));
  }, [to, hasCategory]);

  const forward = useCallback(async () => {
    if (!hasCategory && !categoryId) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/issues/${issue.id}/forward`, {
        method: "POST",
        body: JSON.stringify({ to, categoryId }),
      });
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Forward failed.");
      setBusy(false);
    }
  }, [issue.id, to, categoryId, hasCategory, onChanged]);

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
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

function AssignPanel({ issue, onChanged }: { issue: Issue; onChanged: () => void }) {  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [teamId, setTeamId] = useState("");
  const [staff, setStaff] = useState<string[]>([]);
  const [suggestReason, setSuggestReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [teamsError, setTeamsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadTeams = useCallback(() => {
    void api<{ teams: TeamWithMembers[] }>("/api/teams")
      .then((res) => {
        setTeams(res.teams);
        setTeamsError(null);
      })
      .catch(() => setTeamsError("Couldn't load teams. Please retry."));
  }, []);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

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
          <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden />
          {suggesting ? "Suggesting…" : "AI suggest"}
        </button>
      </div>
      {teamsError && (
        <p className="flex items-center gap-2 text-xs text-danger">
          {teamsError}
          <button className="link-blue" onClick={() => void loadTeams()}>
            Retry
          </button>
        </p>
      )}
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
        {error && <span className="text-sm text-danger">{error}</span>}
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
  const canEdit = claims && ["maintenance", "validator", "admin"].includes(claims.role);

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
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors sm:h-[21px] sm:w-[21px] ${
                    r.resolved
                      ? "border-success bg-success text-white"
                      : "border-slate bg-white hover:border-ink"
                  }`}
                  aria-label={r.resolved ? "Mark as unresolved" : "Mark as resolved"}
                  title={r.resolved ? "Mark as unresolved" : "Mark as resolved"}
                  onClick={() => void toggle(r)}
                >
                  {r.resolved && <span className="text-sm leading-none">✓</span>}
                </button>
              ) : (
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 sm:h-[21px] sm:w-[21px] ${
                    r.resolved ? "border-success bg-success" : "border-slate"
                  }`}
                />
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
      )}
      {canEdit && (
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
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Sparkles, ThumbsUp } from "lucide-react";
import type { Issue, TeamWithMembers } from "@/lib/types";
import { api } from "@/lib/clientApi";
import { StatusBadge, PriorityBadge } from "@/components/ui/Badge";
import { IssuePhotos } from "@/components/ui/IssuePhotos";
import { useActionError } from "@/components/ui/Toast";

export function AssignCard({ issue, onRefresh }: { issue: Issue; onRefresh: () => void }) {
  const router = useRouter();
  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
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

  const selectedTeam = teams.find((t) => t.id === teamId);

  const assign = useCallback(async () => {
    setBusy(true);
    try {
      await api(`/api/issues/${issue.id}/assign`, {
        method: "POST",
        body: JSON.stringify({ teamId, staff }),
      });
      onRefresh();
    } catch (e) {
      showError(e);
      setBusy(false);
    }
  }, [issue.id, teamId, staff, onRefresh, showError]);

  const suggest = useCallback(async () => {
    setSuggesting(true);
    setSuggestReason(null);
    try {
      const res = await api<{ result: { teamId: string; staffIds: string[]; reason: string } }>(
        "/api/ai/suggest-assign",
        { method: "POST", body: JSON.stringify({ issueId: issue.id }) }
      );
      const t = res.result;
      if (t?.teamId) setTeamId(t.teamId);
      if (t?.staffIds) setStaff(t.staffIds);
      setSuggestReason(t?.reason || null);
    } catch (e) {
      showError(e);
    } finally {
      setSuggesting(false);
    }
  }, [issue.id, showError]);

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
        </div>
      </button>

      {issue.images.length > 0 && <IssuePhotos images={issue.images} />}

      <div className="mt-4 flex flex-col gap-3 border-t border-silver pt-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <select className="input" value={teamId} onChange={(e) => { setTeamId(e.target.value); setStaff([]); }}>
            <option value="">Select team…</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={() => void suggest()} disabled={suggesting}>
            <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden />
            {suggesting ? "Suggesting…" : "AI suggest"}
          </button>
        </div>
        {suggestReason && <p className="text-xs text-slate">AI suggests this because: {suggestReason}</p>}

        {selectedTeam && selectedTeam.members.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedTeam.members.map((m) => {
              const checked = staff.includes(m.uid);
              return (
                <button
                  key={m.uid}
                  type="button"
                  className={`tag ${checked ? "bg-ink text-white" : "tag-outline"}`}
                  onClick={() =>
                    setStaff((prev) =>
                      checked ? prev.filter((s) => s !== m.uid) : [...prev, m.uid]
                    )
                  }
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
            {busy ? "Assigning…" : "Assign job"}
          </button>
          {staff.length > 0 ? (
            <span className="text-xs text-slate">{staff.length} staff selected</span>
          ) : (
            <span className="text-xs text-slate">Select at least one staff member.</span>
          )}
          {errorEl}
        </div>
      </div>
    </div>
  );
}

export function RouteToHeadCard({
  issue,
  onRefresh,
  pending = false,
}: {
  issue: Issue;
  onRefresh: () => void;
  pending?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const { showError, errorEl } = useActionError();

  const forward = useCallback(async () => {
    setBusy(true);
    try {
      await api(`/api/issues/${issue.id}/forward`, {
        method: "POST",
        body: JSON.stringify({ to: pending ? "PENDING_ASSIGN" : "ROUTED" }),
      });
      onRefresh();
    } catch (e) {
      showError(e);
      setBusy(false);
    }
  }, [issue.id, pending, onRefresh, showError]);

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
        </div>
      </button>

      {issue.images.length > 0 && <IssuePhotos images={issue.images} />}

      <div className="mt-4 flex flex-col gap-2 border-t border-silver pt-4">
        <button className="btn btn-primary btn-sm self-start" disabled={busy} onClick={() => void forward()}>
          {busy ? "Sending…" : pending ? "Send back to category head" : "Route to maintenance head"}
        </button>
        {pending && (
          <p className="text-xs text-slate">
            The category head will pick a team and assign workers. Or{" "}
            <button className="link-blue" onClick={() => router.push(`/issues/${issue.id}`)}>
              assign directly
            </button>{" "}
            from the issue.
          </p>
        )}
        {errorEl}
      </div>
    </div>
  );
}

export function VerifyCard({ issue, onRefresh }: { issue: Issue; onRefresh: () => void }) {
  const router = useRouter();
  const [verdict, setVerdict] = useState("Work verified as complete.");
  const [sendBackReason, setSendBackReason] = useState("");
  const [busy, setBusy] = useState(false);
  const { showError, errorEl } = useActionError();

  const submit = useCallback(
    async (kind: "verify" | "sendback") => {
      setBusy(true);
      try {
        if (kind === "verify") {
          await api(`/api/issues/${issue.id}/verify`, {
            method: "POST",
            body: JSON.stringify({ verdict }),
          });
        } else {
          await api(`/api/issues/${issue.id}/sendback`, {
            method: "POST",
            body: JSON.stringify({ sendBackReason }),
          });
        }
        onRefresh();
      } catch (e) {
        showError(e);
        setBusy(false);
      }
    },
    [issue.id, verdict, sendBackReason, onRefresh, showError]
  );

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
          <StatusBadge status={issue.status} />
        </div>
        <p className="line-clamp-2 text-sm text-slate">{issue.description}</p>
        {issue.completion?.report && (
          <p className="rounded-lg bg-paper px-3 py-2 text-xs text-slate">
            <span className="font-medium text-graphite">Report:</span> {issue.completion.report}
          </p>
        )}
      </button>

      {issue.images.length > 0 && <IssuePhotos images={issue.images} />}

      <div className="mt-4 flex flex-col gap-2 border-t border-silver pt-4">
        <input
          className="input"
          value={verdict}
          minLength={2}
          onChange={(e) => setVerdict(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => void submit("verify")}>
            <ThumbsUp className="h-3.5 w-3.5" aria-hidden /> Verify
          </button>
          <div className="flex flex-1 items-center gap-2">
            <input
              className="input flex-1"
              placeholder="Send-back reason…"
              value={sendBackReason}
              minLength={3}
              onChange={(e) => setSendBackReason(e.target.value)}
            />
            <button
              className="btn btn-ghost btn-sm"
              disabled={busy || sendBackReason.trim().length < 3}
              onClick={() => void submit("sendback")}
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Send back
            </button>
          </div>
        </div>
        {errorEl}
      </div>
    </div>
  );
}

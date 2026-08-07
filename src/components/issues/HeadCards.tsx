"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Sparkles, ThumbsUp } from "lucide-react";
import type { Issue, TeamWithMembers } from "@/lib/types";
import { api, ApiError } from "@/lib/clientApi";
import { StatusBadge, PriorityBadge } from "@/components/ui/Badge";
import { IssuePhotos } from "@/components/ui/IssuePhotos";

export function AssignCard({ issue, onRefresh }: { issue: Issue; onRefresh: () => void }) {
  const router = useRouter();
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

  const selectedTeam = teams.find((t) => t.id === teamId);

  const assign = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/issues/${issue.id}/assign`, {
        method: "POST",
        body: JSON.stringify({ teamId, staff }),
      });
      onRefresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Assignment failed.");
      setBusy(false);
    }
  }, [issue.id, teamId, staff, onRefresh]);

  const suggest = useCallback(async () => {
    setSuggesting(true);
    setError(null);
    try {
      const res = await api<{ result: { teamId: string; staffIds: string[]; reason: string } }>(
        "/api/ai/suggest-assign",
        { method: "POST", body: JSON.stringify({ issueId: issue.id }) }
      );
      const t = res.result;
      if (t?.teamId) setTeamId(t.teamId);
      if (t?.staffIds) setStaff(t.staffIds);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Suggestion failed.");
    } finally {
      setSuggesting(false);
    }
  }, [issue.id]);

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
            <Sparkles className="h-3.5 w-3.5 text-action-blue" aria-hidden />
            {suggesting ? "Suggesting…" : "AI suggest"}
          </button>
        </div>

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

        <div className="flex items-center gap-2">
          <button className="btn btn-primary btn-sm" disabled={busy || !teamId} onClick={() => void assign()}>
            {busy ? "Assigning…" : "Assign job"}
          </button>
          {staff.length > 0 && <span className="text-xs text-slate">{staff.length} staff selected</span>}
          {error && <span className="text-xs text-[#c0392b]">{error}</span>}
        </div>
      </div>
    </div>
  );
}

export function VerifyCard({ issue, onRefresh }: { issue: Issue; onRefresh: () => void }) {
  const router = useRouter();
  const [verdict, setVerdict] = useState("Work verified as complete.");
  const [sendBackReason, setSendBackReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (kind: "verify" | "sendback") => {
      setBusy(true);
      setError(null);
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
        setError(e instanceof ApiError ? e.message : "Action failed.");
        setBusy(false);
      }
    },
    [issue.id, verdict, sendBackReason, onRefresh]
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
        {error && <p className="text-sm text-[#c0392b]">{error}</p>}
      </div>
    </div>
  );
}

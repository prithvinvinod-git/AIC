"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, UserCheck } from "lucide-react";
import type { Issue, TeamWithMembers } from "@/lib/types";
import { api, ApiError } from "@/lib/clientApi";
import { StatusBadge, PriorityBadge } from "@/components/ui/Badge";
import { IssuePhotos } from "@/components/ui/IssuePhotos";
import { Modal } from "@/components/ui/Modal";

export function DispatchCard({
  issue,
  role,
  onRefresh,
}: {
  issue: Issue;
  role: "maintenance_head" | "category_head";
  onRefresh: () => void;
}) {
  const router = useRouter();
  const isMaintHead = role === "maintenance_head";
  const isForward = isMaintHead && (issue.status === "ROUTED" || issue.status === "PENDING_ASSIGN");

  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [categoryId, setCategoryId] = useState(issue.routing?.categoryId || "");
  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [teamId, setTeamId] = useState("");
  const [staff, setStaff] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"forward" | "assign" | null>(null);

  useEffect(() => {
    void api<{ categories: { id: string; name: string }[] }>("/api/categories")
      .then((res) => setCategories(res.categories.filter((c) => c.id !== issue.routing?.categoryId)))
      .catch(() => undefined);
    void api<{ teams: TeamWithMembers[] }>("/api/teams")
      .then((res) => {
        const scoped = issue.routing?.categoryId
          ? res.teams.filter((t) => t.categoryId === issue.routing?.categoryId)
          : res.teams;
        setTeams(scoped);
      })
      .catch(() => undefined);
  }, [issue.routing?.categoryId]);

  const forward = useCallback(async () => {
    if (!categoryId) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/issues/${issue.id}/forward`, {
        method: "POST",
        body: JSON.stringify({ categoryId }),
      });
      setDialog(null);
      onRefresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Forward failed.");
      setBusy(false);
    }
  }, [issue.id, categoryId, onRefresh]);

  const assign = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/issues/${issue.id}/assign`, {
        method: "POST",
        body: JSON.stringify({ teamId, staff }),
      });
      setDialog(null);
      onRefresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Assignment failed.");
      setBusy(false);
    }
  }, [issue.id, teamId, staff, onRefresh]);

  const selectedTeam = teams.find((t) => t.id === teamId);

  const forwardPanel = isForward && (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-slate">Forward to a category head, who will assign a team and workers.</p>
      <div className="flex gap-2">
        <select className="input flex-1" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Choose category…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button className="btn btn-primary btn-sm" disabled={busy || !categoryId} onClick={() => void forward()}>
          {busy ? "Forwarding…" : "Forward"}
        </button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );

  const assignPanel = issue.status === "PENDING_ASSIGN" && (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-slate">Pick a team and the workers who will handle this job.</p>
      <div className="flex flex-wrap gap-2">
        {teams.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tag ${teamId === t.id ? "bg-ink text-white" : "tag-outline"}`}
            onClick={() => {
              setTeamId(t.id);
              setStaff([]);
            }}
          >
            {t.name}
          </button>
        ))}
      </div>
      {selectedTeam && selectedTeam.members.length === 0 && (
        <p className="text-xs text-warning">This team has no members — add staff in Admin.</p>
      )}
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
      <button
        className="btn btn-primary btn-sm self-start"
        disabled={busy || !teamId || staff.length === 0}
        onClick={() => void assign()}
      >
        <UserCheck className="h-3.5 w-3.5" aria-hidden />
        {busy ? "Assigning…" : "Assign workers"}
      </button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );

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
        <p className="line-clamp-2 text-sm text-slate">{issue.description}</p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate">
          <span className="tag tag-outline">{issue.location.name}</span>
          <span className="tag tag-outline">{issue.routing?.categoryName || "Uncategorised"}</span>
        </div>
      </button>

      <IssuePhotos images={issue.images} placeholder />

      {(isForward || issue.status === "PENDING_ASSIGN") && (
        <div className="mt-auto flex flex-wrap items-center gap-2">
          {isForward && (
            <button className="btn btn-primary btn-sm" onClick={() => setDialog("forward")}>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden /> Forward to category
            </button>
          )}
          {issue.status === "PENDING_ASSIGN" && (
            <button className="btn btn-primary btn-sm" onClick={() => setDialog("assign")}>
              <UserCheck className="h-3.5 w-3.5" aria-hidden /> Assign workers
            </button>
          )}
        </div>
      )}

      <Modal
        open={dialog === "forward"}
        onClose={() => setDialog(null)}
        title="Forward to category"
      >
        {forwardPanel}
      </Modal>
      <Modal open={dialog === "assign"} onClose={() => setDialog(null)} title="Assign workers">
        {assignPanel}
      </Modal>
    </div>
  );
}

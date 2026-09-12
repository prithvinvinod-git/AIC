"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, UserCheck } from "lucide-react";
import type { Issue, TeamWithMembers } from "@/lib/types";
import { api } from "@/lib/clientApi";
import { StatusBadge, PriorityBadge } from "@/components/ui/Badge";
import { IssuePhotos } from "@/components/ui/IssuePhotos";
import { Modal } from "@/components/ui/Modal";
import { FeedbackStars } from "@/components/ui/FeedbackStars";
import { useActionError } from "@/components/ui/Toast";

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
  const isCatHead = role === "category_head";
  const isForward = isMaintHead && (issue.status === "ROUTED" || issue.status === "PENDING_ASSIGN");

  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [categoryId, setCategoryId] = useState(issue.routing?.categoryId || "");
  const [note, setNote] = useState(issue.routing?.note || "");
  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [teamId, setTeamId] = useState("");
  const [staff, setStaff] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<"forward" | "assign" | null>(null);
  const [verdict, setVerdict] = useState("");
  const [sendBack, setSendBack] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const { showError, errorEl } = useActionError();

  useEffect(() => {
    void api<{ categories: { id: string; name: string }[] }>("/api/categories")
      .then((res) => {
        setCategories(res.categories);
        const aiMatch = res.categories.find((c) => c.name === issue.aiSuggestion?.category);
        const preferred = aiMatch?.id || issue.routing?.categoryId || "";
        if (preferred) setCategoryId(preferred);
      })
      .catch(() => undefined);
    void api<{ teams: TeamWithMembers[] }>("/api/teams")
      .then((res) => {
        const scoped = issue.routing?.categoryId
          ? res.teams.filter((t) => t.categoryId === issue.routing?.categoryId)
          : res.teams;
        setTeams(scoped);
        if (scoped.length === 1) setTeamId(scoped[0].id);
      })
      .catch(() => undefined);
  }, [issue.routing?.categoryId, issue.aiSuggestion?.category]);

  const forward = useCallback(async () => {
    if (!categoryId) return;
    setBusy(true);
    try {
      await api(`/api/issues/${issue.id}/forward`, {
        method: "POST",
        body: JSON.stringify({ categoryId, note }),
      });
      setDialog(null);
      onRefresh();
    } catch (e) {
      showError(e);
      setBusy(false);
    }
  }, [issue.id, categoryId, note, onRefresh, showError]);

  const assign = useCallback(async () => {
    setBusy(true);
    try {
      await api(`/api/issues/${issue.id}/assign`, {
        method: "POST",
        body: JSON.stringify({ teamId, staff, note }),
      });
      setDialog(null);
      onRefresh();
    } catch (e) {
      showError(e);
      setBusy(false);
    }
  }, [issue.id, teamId, staff, note, onRefresh, showError]);

  const selectedTeam = teams.find((t) => t.id === teamId);

  const review = useCallback(
    async (kind: "inspect" | "sendback") => {
      setReviewBusy(true);
      try {
        if (kind === "inspect") {
          await api(`/api/issues/${issue.id}/inspect`, {
            method: "POST",
            body: JSON.stringify({ verdict: verdict || "Verified." }),
          });
        } else {
          await api(`/api/issues/${issue.id}/sendback`, {
            method: "POST",
            body: JSON.stringify({ sendBackReason: sendBack }),
          });
        }
        setVerdict("");
        setSendBack("");
        onRefresh();
      } catch (e) {
        showError(e);
        setReviewBusy(false);
      }
    },
    [issue.id, verdict, sendBack, onRefresh, showError]
  );

  const forwardPanel = isForward && (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-slate">Forward to a category head, who will assign a team and workers.</p>
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-slate">
          Category
          <select className="input mt-1 w-full" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Choose category…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate">
          Note <span className="font-normal text-slate/70">(optional)</span>
          <input
            className="input mt-1 w-full"
            placeholder="Add a note for the category head…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
      </div>
      <button className="btn btn-primary btn-sm self-start" disabled={busy || !categoryId} onClick={() => void forward()}>
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        {busy ? "Routing…" : "Route to Category Head"}
      </button>
      {errorEl}
    </div>
  );

  const assignPanel = issue.status === "PENDING_ASSIGN" && (
    <div className="flex flex-col gap-3">
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
      {issue.routing?.note && (
        <p className="rounded-lg bg-accent-soft px-3 py-2 text-xs leading-relaxed text-graphite">
          <span className="font-semibold">Note from maintenance head:</span> {issue.routing.note}
        </p>
      )}
      {selectedTeam && selectedTeam.members.length === 0 && (
        <p className="text-xs text-warning">This team has no members — add staff in Admin.</p>
      )}
      {selectedTeam && selectedTeam.members.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-slate">Select workers</span>
          <div className="flex flex-wrap gap-2">
            {selectedTeam.members.map((m) => {
              const checked = staff.includes(m.uid);
              return (
                <button
                  key={m.uid}
                  type="button"
                  className={`tag border ${checked ? "border-accent bg-ink text-white" : "border-silver"}`}
                  onClick={() => setStaff((prev) => (checked ? prev.filter((s) => s !== m.uid) : [...prev, m.uid]))}
                >
                  {m.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <label className="text-xs font-medium text-slate">
        Note <span className="font-normal text-slate/70">(optional)</span>
        <input
          className="input mt-1 w-full"
          placeholder="Add a note for the workers…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <button
        className="btn btn-primary btn-sm self-start"
        disabled={busy || !teamId || staff.length === 0}
        onClick={() => void assign()}
      >
        <UserCheck className="h-3.5 w-3.5" aria-hidden />
        {busy ? "Assigning…" : "Assign workers"}
      </button>
      {errorEl}
    </div>
  );

  return (
    <div className="card flex h-full min-w-0 flex-col gap-3 overflow-hidden">
      <button
        type="button"
        className="flex w-full flex-col gap-2 text-left"
        onClick={() => router.push(`/issues/${issue.id}`)}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-slate">{issue.issueNo}</p>
            <h3 className="truncate text-base font-medium text-graphite">{issue.title}</h3>
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
              <ArrowRight className="h-3.5 w-3.5" aria-hidden /> Route to category head
            </button>
          )}
          {issue.status === "PENDING_ASSIGN" && (
            <button className="btn btn-primary btn-sm" onClick={() => setDialog("assign")}>
              <UserCheck className="h-3.5 w-3.5" aria-hidden /> Assign workers
            </button>
          )}
        </div>
      )}

      {issue.status === "CLOSED" && issue.feedback?.rating && (
        <div className="mt-auto flex justify-end">
          <FeedbackStars rating={issue.feedback.rating} size={16} />
        </div>
      )}

      {isCatHead && issue.status === "COMPLETED" && (
        <div className="mt-auto flex flex-col gap-2 rounded-xl bg-paper p-3">
          <p className="text-xs text-slate">Verify the completed work on site.</p>
          <input
            className="input"
            placeholder="Inspection note"
            value={verdict}
            onChange={(e) => setVerdict(e.target.value)}
          />
          <div className="flex gap-2">
            <button className="btn btn-primary btn-sm" disabled={reviewBusy} onClick={() => void review("inspect")}>
              {reviewBusy ? "Saving…" : "Verify"}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              disabled={reviewBusy || sendBack.trim().length < 3}
              onClick={() => void review("sendback")}
            >
              Send back
            </button>
          </div>
          {errorEl}
        </div>
      )}

      <Modal
        open={dialog === "forward"}
        onClose={() => setDialog(null)}
        title="Route to category head"
      >
        {forwardPanel}
      </Modal>
      <Modal open={dialog === "assign"} onClose={() => setDialog(null)} title="Assign workers">
        {assignPanel}
      </Modal>
    </div>
  );
}

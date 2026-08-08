"use client";

import { useCallback, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CircleCheckBig, Clock3, Download, MapPin, Star } from "lucide-react";
import { downloadIssueReceipt } from "@/lib/receiptPdf";
import { useIssue } from "@/hooks/useIssue";
import { useAuth } from "@/components/auth/AuthProvider";
import { Loading, EmptyState } from "@/components/ui/States";
import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import { IssuePhotos } from "@/components/ui/IssuePhotos";
import { AISuggestionCard } from "@/components/issues/AISuggestionCard";
import { CloseIssueModal } from "@/components/issues/CloseIssueModal";
import { IssueActions, RequirementsPanel } from "@/components/issues/IssueActions";
import { api, ApiError } from "@/lib/clientApi";
import { deadlineLabel, formatDateTime, timeAgo } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/constants";
import type { TimelineEntry } from "@/lib/types";

const dotClass = (t: TimelineEntry): string => {
  if (!t.from) return "bg-[#c0392b]";
  if (t.to === "APPROVED") return "bg-[#f59e0b]";
  if (t.to === "CLOSED") return "bg-[#16a34a]";
  return t.isAuto ? "bg-action-blue" : "bg-ink";
};

export default function IssueDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const { issue, timeline, comments, error, reload } = useIssue(id);
  const { claims, user } = useAuth();

  const [closeOpen, setCloseOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [receiptBusy, setReceiptBusy] = useState(false);

  const downloadReceipt = useCallback(async () => {
    if (!issue || !timeline) return;
    setReceiptBusy(true);
    try {
      await downloadIssueReceipt(issue, timeline);
    } finally {
      setReceiptBusy(false);
    }
  }, [issue, timeline]);

  const postComment = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setCommentBusy(true);
      setCommentError(null);
      try {
        await api(`/api/issues/${id}/comments`, { method: "POST", body: JSON.stringify({ body: comment }) });
        setComment("");
        await reload();
      } catch (e2) {
        setCommentError(e2 instanceof ApiError ? e2.message : "Failed to post comment.");
      } finally {
        setCommentBusy(false);
      }
    },
    [id, comment, reload]
  );

  if (error) {
    return (
      <EmptyState
        title="Issue not found"
        body={error}
        icon={
          <button className="btn btn-secondary btn-sm rounded-full" onClick={() => router.back()}>
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Go back
          </button>
        }
      />
    );
  }
  if (!issue || !claims) return <Loading label="Loading issue…" />;

  const slaDeadline =
    issue.sla?.resolutionDeadline && ["ASSIGNED", "ONGOING", "PENDING", "COMPLETED"].includes(issue.status)
      ? deadlineLabel(issue.sla.resolutionDeadline)
      : null;

  return (
    <div className="flex flex-col gap-6">
      <button className="btn btn-secondary btn-sm self-start rounded-full" onClick={() => router.back()}>
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back
      </button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate">{issue.issueNo}</p>
          <h1 className="mt-1 font-display text-2xl font-semibold leading-tight text-ink">{issue.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge status={issue.status} />
            <PriorityBadge priority={issue.priority} />
            <span className="tag tag-outline">{issue.routing?.categoryName}</span>
            <span className="tag tag-outline">{issue.department}</span>
          </div>
          {issue.prioritySetBy && issue.prioritySetBy.uid !== issue.reporter?.uid && (
            <p className="mt-1.5 text-xs text-slate">Priority set by {issue.prioritySetBy.name}</p>
          )}
        </div>
        {slaDeadline && (
          <div
            className={`kpi min-w-[160px] ${
              slaDeadline.tone === "over"
                ? "!bg-[#fef2f2]"
                : slaDeadline.tone === "warn"
                  ? "!bg-[#fffbeb]"
                  : ""
            }`}
          >
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate">
              <Clock3 className="h-3.5 w-3.5" aria-hidden /> Resolution SLA
            </p>
            <p
              className={`mt-1.5 font-display text-lg font-semibold ${
                slaDeadline.tone === "over" ? "text-[#c0392b]" : slaDeadline.tone === "warn" ? "text-[#d97706]" : "text-ink"
              }`}
            >
              {slaDeadline.text}
            </p>
          </div>
        )}
        {!slaDeadline && ["NEW", "VALIDATED", "ESCALATED", "APPROVED"].includes(issue.status) && (
          <div className="kpi min-w-[160px]">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate">
              <Clock3 className="h-3.5 w-3.5" aria-hidden /> Resolution SLA
            </p>
            <p className="mt-1.5 font-display text-sm font-medium text-slate">Starts once accepted</p>
          </div>
        )}
        {issue.status === "CLOSED" && (
          <button
            type="button"
            className="btn btn-primary w-fit mt-10"
            disabled={receiptBusy}
            onClick={() => void downloadReceipt()}
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            {receiptBusy ? "Preparing receipt…" : "Download receipt"}
          </button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="card">
            <h2 className="font-display text-lg font-semibold text-ink">Description</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate">{issue.description}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate">
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" aria-hidden />
                {issue.location.building}
                {issue.location.floor && ` · Floor ${issue.location.floor}`}
                {issue.location.name && ` · ${issue.location.name}`}
              </span>
              <span className="mx-1 text-silver">|</span>
              <span>Reported by {issue.reporter?.name}</span>
              <span className="mx-1 text-silver">|</span>
              <span>{timeAgo(issue.createdAt)}</span>
            </div>
            {issue.images.length > 0 && (
              <div className="mt-4">
                <IssuePhotos images={issue.images} size={148} />
              </div>
            )}
          </div>

          <AISuggestionCard issue={issue} />

          <RequirementsPanel issue={issue} onChanged={() => void reload()} />

          <IssueActions issue={issue} onChanged={() => void reload()} />

          <div className="card">
            <h2 className="font-display text-lg font-semibold text-ink">Comments</h2>
            <form onSubmit={(e) => void postComment(e)} className="mt-3 flex gap-2">
              <input
                className="input flex-1"
                placeholder="Add a comment…"
                value={comment}
                maxLength={1000}
                onChange={(e) => setComment(e.target.value)}
              />
              <button type="submit" className="btn btn-primary btn-sm" disabled={commentBusy || !comment.trim()}>
                {commentBusy ? "Posting…" : "Post"}
              </button>
            </form>
            {commentError && <p className="mt-2 text-sm text-[#c0392b]">{commentError}</p>}
            {comments && comments.length > 0 && (
              <ul className="mt-4 flex flex-col gap-3">
                {comments.map((c) => (
                  <li key={c.id} className="rounded-xl bg-paper p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-graphite">{c.author.name}</p>
                      <span className="text-xs text-slate">{formatDateTime(c.at)}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate">{c.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {issue.status === "VERIFIED" && claims?.role === "reporter" && issue.reporter?.uid === user?.uid && (
            <button
              type="button"
              className="btn btn-primary -mt-[40px]"
              onClick={() => setCloseOpen(true)}
            >
              <CircleCheckBig className="h-3.5 w-3.5" aria-hidden /> Close issue
            </button>
          )}

          <div className="card">
            <h2 className="font-display text-lg font-semibold text-ink">Timeline</h2>
            <ol className="mt-4 flex flex-col gap-0">
              {timeline?.map((t, i) => (
                <li key={i} className="relative flex gap-3 pb-5 last:pb-0">
                  {i < (timeline?.length || 0) - 1 && (
                    <span className="absolute left-[5px] top-[11px] h-full w-px bg-silver" aria-hidden />
                  )}
                  <span
                    className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${dotClass(t)}`}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="text-sm">
                      <span className="font-medium text-graphite">
                        {t.from ? STATUS_LABEL[t.from] : "Reported"} → {STATUS_LABEL[t.to]}
                      </span>
                      {t.isAuto && <span className="ml-1 text-xs text-action-blue">auto</span>}
                    </p>
                    <p className="mt-0.5 text-xs text-slate">
                      {t.by?.name} · {formatDateTime(t.at)}
                    </p>
                    {t.note && <p className="mt-1 text-sm text-slate">{t.note}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {issue.feedback && (
            <div className="card">
              <h2 className="font-display text-lg font-semibold text-ink">Feedback</h2>
              <div className="mt-2 flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((r) => (
                  <Star
                    key={r}
                    className={`h-5 w-5 ${
                      r <= issue.feedback!.rating ? "fill-[#f59e0b] text-[#f59e0b]" : "text-silver"
                    }`}
                    aria-hidden
                  />
                ))}
                <span className="ml-1 text-sm text-slate">{issue.feedback.rating}/5</span>
              </div>
              {issue.feedback.comment && <p className="mt-2 text-sm text-slate">{issue.feedback.comment}</p>}
              {issue.feedback.autoClosed && (
                <p className="mt-2 text-xs text-slate">Closed automatically after the feedback grace period.</p>
              )}
            </div>
          )}

          {issue.rejection && (
            <div className="card">
              <h2 className="font-display text-lg font-semibold text-ink">Rejected</h2>
              <p className="mt-2 text-sm text-slate">{issue.rejection.reason}</p>
              <p className="mt-1 text-xs text-slate">by {issue.rejection.by?.name} · {formatDateTime(issue.rejection.at)}</p>
            </div>
          )}

          {issue.completion && (
            <div className="card">
              <h2 className="font-display text-lg font-semibold text-ink">Completion</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate">{issue.completion.report}</p>
              <p className="mt-1 text-xs text-slate">{formatDateTime(issue.completion.completedAt)}</p>
            </div>
          )}
        </div>
      </div>

      <CloseIssueModal
        issue={closeOpen ? issue : null}
        onClose={() => setCloseOpen(false)}
        onClosed={() => void reload()}
      />
    </div>
  );
}

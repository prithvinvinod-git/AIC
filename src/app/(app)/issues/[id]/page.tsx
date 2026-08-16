"use client";

import { useCallback, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CircleCheckBig, Clock3, Download, MapPin } from "lucide-react";
import { downloadIssueReceipt } from "@/lib/receiptPdf";
import { useIssue } from "@/hooks/useIssue";
import { useAuth } from "@/components/auth/AuthProvider";
import { Loading, EmptyState } from "@/components/ui/States";
import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import { IssuePhotos } from "@/components/ui/IssuePhotos";
import { FeedbackStars } from "@/components/ui/FeedbackStars";
import { AISuggestionCard } from "@/components/issues/AISuggestionCard";
import { CloseIssueModal } from "@/components/issues/CloseIssueModal";
import { CommentsSection } from "@/components/issues/CommentsSection";
import { IssueActions, RequirementsPanel } from "@/components/issues/IssueActions";
import { deadlineLabel, formatDateTime, timeAgo } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/constants";
import type { TimelineEntry } from "@/lib/types";

const dotClass = (t: TimelineEntry): string => {
  if (!t.from) return "bg-danger";
  if (t.to === "APPROVED") return "bg-warning";
  if (t.to === "CLOSED") return "bg-success";
  return t.isAuto ? "bg-accent" : "bg-ink";
};

export default function IssueDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const { issue, timeline, comments, error, reload } = useIssue(id);
  const { claims, user } = useAuth();

  const [closeOpen, setCloseOpen] = useState(false);
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
    issue.sla?.resolutionDeadline && ["ASSIGNED", "ONGOING", "PENDING", "COMPLETED", "INSPECTED", "HEAD_APPROVED"].includes(issue.status)
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
          <h1 className="mt-1 font-display text-2xl max-md:text-xl font-semibold leading-tight text-ink">{issue.title}</h1>
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
                ? "bg-danger-soft!"
                : slaDeadline.tone === "warn"
                  ? "bg-warning-soft!"
                  : ""
            }`}
          >
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate">
              <Clock3 className="h-3.5 w-3.5" aria-hidden /> Resolution SLA
            </p>
            <p
              className={`mt-1.5 font-display text-lg max-md:text-base font-semibold ${
                slaDeadline.tone === "over" ? "text-danger" : slaDeadline.tone === "warn" ? "text-warning" : "text-ink"
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
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-lg max-md:text-base font-semibold text-ink">Description</h2>
              {issue.feedback?.rating ? (
                <FeedbackStars rating={issue.feedback.rating} size={20} />
              ) : null}
            </div>
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
                <IssuePhotos images={issue.images} size={148} mobileSize={100} />
              </div>
            )}
          </div>

          <AISuggestionCard issue={issue} onTriaged={() => void reload()} />

          <RequirementsPanel issue={issue} onChanged={() => void reload()} />

          <IssueActions issue={issue} onChanged={() => void reload()} />

          <CommentsSection issueId={id} comments={comments ?? []} onReload={() => void reload()} />
        </div>

        <div className="flex flex-col gap-4">
          {issue.status === "VERIFIED" && claims?.role === "reporter" && issue.reporter?.uid === user?.uid && (
            <button
              type="button"
              className="btn btn-primary lg:-mt-[40px]"
              onClick={() => setCloseOpen(true)}
            >
              <CircleCheckBig className="h-3.5 w-3.5" aria-hidden /> Close issue
            </button>
          )}

          <div className="card">
            <h2 className="font-display text-lg max-md:text-base font-semibold text-ink">Timeline</h2>
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
                      {t.isAuto && <span className="ml-1 text-xs text-accent">auto</span>}
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

          {issue.rejection && (
            <div className="card">
              <h2 className="font-display text-lg max-md:text-base font-semibold text-ink">Rejected</h2>
              <p className="mt-2 text-sm text-slate">{issue.rejection.reason}</p>
              <p className="mt-1 text-xs text-slate">by {issue.rejection.by?.name} · {formatDateTime(issue.rejection.at)}</p>
            </div>
          )}

          {issue.completion && (
            <div className="card">
              <h2 className="font-display text-lg max-md:text-base font-semibold text-ink">Completion</h2>
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

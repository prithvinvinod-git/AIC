"use client";

import Link from "next/link";
import { CheckCheck, Clock3 } from "lucide-react";
import type { Issue } from "@/lib/types";
import { deadlineLabel, timeAgo } from "@/lib/format";
import { PriorityBadge, StatusBadge } from "./Badge";
import { IssuePhotos } from "./IssuePhotos";
import { FeedbackStars } from "./FeedbackStars";

export function IssueCard({ issue, onClose }: { issue: Issue; onClose?: () => void }) {
  const sla = issue.sla;
  const deadline =
    sla?.resolutionDeadline && ["ASSIGNED", "ONGOING", "PENDING", "COMPLETED", "INSPECTED", "HEAD_APPROVED"].includes(issue.status)
      ? deadlineLabel(sla.resolutionDeadline)
      : null;
  const canClose = issue.status === "VERIFIED" && !!onClose;

  return (
    <div className="card flex flex-col gap-3 transition-shadow hover:shadow-[var(--shadow-card-hover)]">
      <Link href={`/issues/${issue.id}`} className="flex flex-1 flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-slate">{issue.issueNo}</p>
            <h3 className="mt-0.5 truncate font-display text-[15px] font-medium text-graphite">
              {issue.title}
            </h3>
          </div>
          <StatusBadge status={issue.status} />
        </div>

        <p className="line-clamp-2 text-sm text-slate">{issue.description}</p>

        <div className="mt-auto flex flex-wrap items-center gap-2 text-xs text-slate">
          <PriorityBadge priority={issue.priority} />
          <span className="tag tag-outline">{issue.routing?.categoryName || issue.department}</span>
          {issue.location?.name && <span className="tag tag-outline">{issue.location.name}</span>}
        </div>

        <div className="divider" />

        <div className="flex items-center justify-between text-xs text-slate">
          <span>Reported {timeAgo(issue.createdAt)}</span>
          {issue.status === "CLOSED" && issue.feedback?.rating ? (
            <FeedbackStars rating={issue.feedback.rating} size={15} />
          ) : deadline ? (
            <span
              className={
                deadline.tone === "over"
                  ? "font-medium text-danger"
                  : deadline.tone === "warn"
                    ? "font-medium text-warning"
                    : "text-slate"
              }
            >
              <Clock3 className="mr-1 inline h-3.5 w-3.5" aria-hidden />
              {deadline.text}
            </span>
          ) : null}
        </div>
      </Link>

      <IssuePhotos images={issue.images} placeholder />

      {canClose && (
        <button type="button" className="btn btn-primary btn-sm self-start" onClick={onClose}>
          <CheckCheck className="h-3.5 w-3.5" aria-hidden /> Close issue
        </button>
      )}
    </div>
  );
}

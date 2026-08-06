"use client";

import Link from "next/link";
import { Clock3 } from "lucide-react";
import type { Issue } from "@/lib/types";
import { deadlineLabel, timeAgo } from "@/lib/format";
import { PriorityBadge, StatusBadge } from "./Badge";

export function IssueCard({ issue }: { issue: Issue }) {
  const sla = issue.sla;
  const deadline =
    sla?.resolutionDeadline && ["ASSIGNED", "ONGOING", "PENDING", "COMPLETED"].includes(issue.status)
      ? deadlineLabel(sla.resolutionDeadline)
      : null;

  return (
    <Link
      href={`/issues/${issue.id}`}
      className="card flex flex-col gap-3 transition-shadow hover:shadow-[var(--shadow-card-hover)]"
    >
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
        {deadline && (
          <span
            className={
              deadline.tone === "over"
                ? "font-medium text-[#c0392b]"
                : deadline.tone === "warn"
                  ? "font-medium text-[#d97706]"
                  : "text-slate"
            }
          >
            <Clock3 className="mr-1 inline h-3.5 w-3.5" aria-hidden />
            {deadline.text}
          </span>
        )}
      </div>
    </Link>
  );
}

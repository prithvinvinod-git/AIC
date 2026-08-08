import Link from "next/link";
import { StatusBadge, PriorityBadge } from "@/components/ui/Badge";
import { timeAgo } from "@/lib/format";
import type { Issue } from "@/lib/types";

/** Compact single-row issue entry used by the dashboard boards and panels. */
export default function CompactIssueRow({ issue }: { issue: Issue }) {
  return (
    <Link
      href={`/issues/${issue.id}`}
      className="group flex items-center gap-4 border-b border-silver px-5 py-3.5 last:border-0 hover:bg-paper"
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate">{issue.issueNo}</p>
        <p className="truncate font-medium text-ink group-hover:text-primary">{issue.title}</p>
        <p className="mt-0.5 truncate text-xs text-slate">
          {issue.department}
          {issue.reporter?.name ? ` · ${issue.reporter.name}` : ""} · {timeAgo(issue.createdAt)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <StatusBadge status={issue.status} />
        <PriorityBadge priority={issue.priority} />
      </div>
    </Link>
  );
}

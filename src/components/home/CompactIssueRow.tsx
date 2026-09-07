import Link from "next/link";
import { StatusBadge, PriorityBadge } from "@/components/ui/Badge";
import { timeAgo } from "@/lib/format";
import type { Issue } from "@/lib/types";

/** Compact single-row issue entry used by the dashboard boards and panels.
 *  Pass `bordered` to render as a separate rounded card (latest-issues panel). */
export default function CompactIssueRow({
  issue,
  bordered = false,
}: {
  issue: Issue;
  bordered?: boolean;
}) {
  return (
    <Link
      href={`/issues/${issue.id}`}
      className={`group flex items-center justify-between gap-3 transition-colors hover:bg-paper sm:gap-4 ${
        bordered ? "rounded-lg border border-silver px-2 py-2.5" : "px-1 py-2"
      }`}
    >
      <div className="min-w-0 space-y-1">
        {issue.issueNo && (
          <p className="font-mono text-[11px] tracking-wider text-slate">{issue.issueNo}</p>
        )}
        <h3 className="truncate text-sm font-medium tracking-tight text-ink transition-colors group-hover:text-accent">
          {issue.title}
        </h3>
        <p className="truncate font-sans text-xs text-slate">
          {issue.department}
          {issue.reporter?.name ? ` · ${issue.reporter.name}` : ""} · {timeAgo(issue.createdAt)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <StatusBadge status={issue.status} />
        <span className="max-[480px]:hidden">
          <PriorityBadge priority={issue.priority} />
        </span>
      </div>
    </Link>
  );
}

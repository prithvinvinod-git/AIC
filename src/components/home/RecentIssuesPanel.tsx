"use client";

import { useMemo } from "react";
import Link from "next/link";
import { CirclePlus } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { portalRoles } from "@/lib/nav";
import { feedFor, MAX_RECENT } from "@/lib/roleFeeds";
import { useIssues } from "@/hooks/useIssues";
import { Loading } from "@/components/ui/States";
import CompactIssueRow from "@/components/home/CompactIssueRow";

/** Right-side dashboard panel — a role-aware feed of the latest issues. */
export default function RecentIssuesPanel() {
  const { claims } = useAuth();
  const activeRole = claims ? portalRoles(claims)[0] : "reporter";
  const feed = feedFor(activeRole, claims?.department);
  const { issues, error } = useIssues(feed.params ?? {});

  const recent = useMemo(() => {
    const list = issues ?? [];
    const picked = feed.pick ? feed.pick(list) : list;
    return picked.slice(0, MAX_RECENT);
  }, [issues, feed]);

  const canReport = claims ? portalRoles(claims).includes("reporter") : false;

  return (
    <div className="card flex h-full min-h-[460px] max-md:min-h-[380px] flex-col overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <div>
          <h2 className="font-display text-base font-semibold text-ink">{feed.title}</h2>
          <p className="mt-0.5 text-xs text-slate">{feed.subtitle}</p>
        </div>
        <Link href={feed.ctaHref} className="btn btn-ghost btn-sm">
          {feed.ctaLabel}
        </Link>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {error ? (
          <div className="px-5 py-10 text-center text-sm text-slate">{error}</div>
        ) : !issues ? (
          <Loading label="Loading…" />
        ) : recent.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
            <CirclePlus className="h-8 w-8 text-slate" aria-hidden />
            <div>
              <p className="font-medium text-graphite">{feed.emptyTitle}</p>
              <p className="mt-1 text-sm text-slate">{feed.emptyBody}</p>
            </div>
            {canReport && (
              <Link href="/new" className="btn btn-primary">
                <CirclePlus className="h-3.5 w-3.5" aria-hidden /> Report new issue
              </Link>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-[10px] p-[10px]">
            {recent.map((issue) => (
              <CompactIssueRow key={issue.id} issue={issue} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

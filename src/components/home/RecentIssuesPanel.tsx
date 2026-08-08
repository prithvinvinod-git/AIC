"use client";

import { useMemo } from "react";
import Link from "next/link";
import { CirclePlus } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { portalRoles } from "@/lib/nav";
import { useIssues } from "@/hooks/useIssues";
import { Loading } from "@/components/ui/States";
import CompactIssueRow from "@/components/home/CompactIssueRow";

const MAX_RECENT = 3;

/** Right-side dashboard panel — the latest issues the user reported. */
export default function RecentIssuesPanel() {
  const { claims } = useAuth();
  const { issues, error } = useIssues({ mine: true });

  const recent = useMemo(() => (issues ?? []).slice(0, MAX_RECENT), [issues]);
  const canReport = claims ? portalRoles(claims).includes("reporter") : false;

  return (
    <div className="card flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <div>
          <h2 className="font-display text-base font-semibold text-ink">Your recent issues</h2>
          <p className="mt-0.5 text-xs text-slate">The latest {MAX_RECENT} you have reported.</p>
        </div>
        {canReport && (
          <Link href="/dashboard" className="btn btn-ghost btn-sm">
            My issues
          </Link>
        )}
      </div>

      {error ? (
        <div className="px-5 py-10 text-center text-sm text-slate">{error}</div>
      ) : !issues ? (
        <Loading label="Loading your issues…" />
      ) : recent.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
          <CirclePlus className="h-8 w-8 text-slate" aria-hidden />
          <div>
            <p className="font-medium text-graphite">Nothing reported by you yet</p>
            <p className="mt-1 text-sm text-slate">
              {canReport
                ? "Report your first maintenance issue and follow it to closure."
                : "Issues you report as a reporter will appear here."}
            </p>
          </div>
          {canReport && (
            <Link href="/new" className="btn btn-primary">
              <CirclePlus className="h-3.5 w-3.5" aria-hidden /> Report new issue
            </Link>
          )}
        </div>
      ) : (
        <div className="flex-1">{recent.map((issue) => <CompactIssueRow key={issue.id} issue={issue} />)}</div>
      )}
    </div>
  );
}

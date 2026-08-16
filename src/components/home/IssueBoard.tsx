"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, LayoutGrid, RefreshCw } from "lucide-react";
import { api, ApiError } from "@/lib/clientApi";
import { useAuth } from "@/components/auth/AuthProvider";
import { portalRoles } from "@/lib/nav";
import { EmptyState, Loading } from "@/components/ui/States";
import CompactIssueRow from "@/components/home/CompactIssueRow";
import type { Issue } from "@/lib/types";

const HISTORY_ROLES = ["admin", "principal"];

/** Cross-user board — the same P1–P3 issues for every role, curated by admin/principal. */
export default function IssueBoard() {
  const { claims } = useAuth();
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api<{ issues: Issue[] }>("/api/issues?scope=board")
      .then((res) => {
        if (!cancelled) {
          setIssues(res.issues);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : "Failed to load the board.");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const canViewAll = claims
    ? portalRoles(claims).some((r) => HISTORY_ROLES.includes(r))
    : false;

  return (
    <div className="card flex min-h-[55svh] max-md:min-h-[42svh] flex-col overflow-hidden lg:min-h-[70svh]">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 -mt-[5px] items-center justify-center text-graphite">
            <LayoutGrid className="h-[20px] w-[20px]" aria-hidden />
          </span>
          <div>
            <h2 className="font-display text-base font-semibold text-ink">Issue board</h2>
            <p className="mt-0.5 text-xs text-slate">
              Priority P1–P3 issues across all departments.
            </p>
          </div>
        </div>
        <button type="button" onClick={reload} className="btn btn-ghost btn-sm" aria-label="Refresh board">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {error ? (
          <div className="px-5 py-10 text-center text-sm text-slate">{error}</div>
        ) : !issues ? (
          <Loading label="Loading board…" />
        ) : issues.length === 0 ? (
          <EmptyState
            icon={<LayoutGrid className="h-8 w-8" aria-hidden />}
            title="No high-priority issues"
            body="Nothing at P1–P3 right now — new important reports will appear here."
          />
        ) : (
          <div className="flex flex-col gap-[10px] p-[10px]">
            {issues.map((issue) => (
              <CompactIssueRow key={issue.id} issue={issue} />
            ))}
          </div>
        )}
      </div>

      {issues && issues.length > 0 && (
        <div className="flex shrink-0 items-center justify-between border-t border-silver px-5 py-3">
          <p className="text-xs text-slate">
            {issues.length} issue{issues.length === 1 ? "" : "s"} on the board
          </p>
          {canViewAll && (
            <Link href="/issue-history" className="btn btn-ghost btn-sm">
              View all <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

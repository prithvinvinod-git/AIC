"use client";

import { useCallback, useEffect, useState } from "react";
import { LayoutGrid, RefreshCw } from "lucide-react";
import { api, ApiError } from "@/lib/clientApi";
import { EmptyState, Loading } from "@/components/ui/States";
import CompactIssueRow from "@/components/home/CompactIssueRow";
import type { Issue } from "@/lib/types";

/** Cross-user board — the same P1–P3 issues for every role, curated by admin/principal. */
export default function IssueBoard() {
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

  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-paper text-graphite">
            <LayoutGrid className="h-4 w-4" aria-hidden />
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
        <div>{issues.map((issue) => <CompactIssueRow key={issue.id} issue={issue} />)}</div>
      )}
    </div>
  );
}

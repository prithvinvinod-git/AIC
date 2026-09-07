"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, LayoutGrid, RefreshCw } from "lucide-react";
import { api, ApiError } from "@/lib/clientApi";
import { useAuth } from "@/components/auth/AuthProvider";
import { portalRoles } from "@/lib/nav";
import { EmptyState, Loading } from "@/components/ui/States";
import CompactIssueRow from "@/components/home/CompactIssueRow";
import type { Issue } from "@/lib/types";

const HISTORY_ROLES = ["admin", "principal"];

/** Exactly this many cards fill the first viewport of the board; extras scroll. */
const BOARD_ROWS_VISIBLE = 5;

/** Cross-user board — the same P1–P3 issues for every role, curated by admin/principal. */
export default function IssueBoard() {
  const { claims } = useAuth();
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const [rowHeight, setRowHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const measure = () => {
      const rowH = Math.max(56, Math.floor((el.clientHeight - (BOARD_ROWS_VISIBLE - 1)) / BOARD_ROWS_VISIBLE));
      setRowHeight((prev) => (prev === rowH ? prev : rowH));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
    <div className="card flex h-[600px] flex-col overflow-hidden p-6 sm:p-8 max-md:h-[545px]">
      <header className="flex items-center justify-between border-b border-silver pb-6">
        <div>
          <h2 className="font-display text-2xl font-normal leading-none tracking-tight text-ink">
            Issue board
          </h2>
          <p className="mt-2 text-xs tracking-wide text-slate">
            Priority P1–P3 issues across all departments.
          </p>
        </div>
        <button
          type="button"
          onClick={reload}
          aria-label="Refresh issues"
          className="rounded-lg p-2.5 text-slate transition-colors hover:text-ink sm:hidden"
        >
          <RefreshCw className="h-5 w-5" aria-hidden />
        </button>
      </header>

      <div ref={listRef} className="custom-scroll min-h-0 -mr-6 flex-1 overflow-y-auto pr-6 sm:-mr-8 sm:pr-8">
        <div
          className="board-issue-rows h-full divide-y divide-silver"
          style={rowHeight ? { gridAutoRows: `${rowHeight}px` } : undefined}
        >
          {error ? (
            <div className="px-1 py-10 text-center text-sm text-slate">{error}</div>
          ) : !issues ? (
            <Loading label="Loading board…" />
          ) : issues.length === 0 ? (
            <EmptyState
              icon={<LayoutGrid className="h-8 w-8" aria-hidden />}
              title="No high-priority issues"
              body="Nothing at P1–P3 right now — new important reports will appear here."
            />
          ) : (
            issues.map((issue) => <CompactIssueRow key={issue.id} issue={issue} />)
          )}
        </div>
      </div>

      {issues && issues.length > 0 && (
        <footer className="mt-4 flex shrink-0 items-center justify-between border-t border-silver pt-4">
          <p className="font-mono text-xs text-slate">
            {issues.length} issue{issues.length === 1 ? "" : "s"} on the board
          </p>
          {canViewAll && (
            <Link href="/issue-history" className="btn btn-ghost btn-sm">
              View all <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          )}
        </footer>
      )}
    </div>
  );
}

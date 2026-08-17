"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, History, Search, SlidersHorizontal, X } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { api, ApiError } from "@/lib/clientApi";
import { useToast } from "@/components/ui/Toast";
import { Loading, EmptyState } from "@/components/ui/States";
import { StatusBadge, PriorityBadge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/format";
import { DEPARTMENTS, STATUS_LABEL } from "@/lib/constants";
import { STATUSES } from "@/lib/types";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import type { Category, Issue, IssueStatus } from "@/lib/types";

const HISTORY_ROLES = ["admin", "principal"];

/** Issues at P3 or above (priority number ≤ 3) are board-eligible. */
const BOARD_MAX_PRIORITY = 3;

const STATUS_GROUPS: { key: string; label: string; statuses: IssueStatus[] }[] = [
  { key: "resolved", label: "Resolved", statuses: ["COMPLETED", "VERIFIED", "CLOSED"] },
  {
    key: "unresolved",
    label: "Unresolved",
    statuses: [
      "NEW",
      "VALIDATED",
      "ESCALATED",
      "APPROVED",
      "ASSIGNED",
      "ONGOING",
      "PENDING",
      "REJECTED",
    ],
  },
  { key: "in-progress", label: "In progress", statuses: ["ASSIGNED", "ONGOING", "PENDING"] },
];

interface Filters {
  from: string;
  to: string;
  department: string;
  category: string;
  statuses: IssueStatus[];
}

const DEFAULT_FILTERS: Filters = { from: "", to: "", department: "", category: "", statuses: [] };

export default function IssueHistoryPage() {
  const { claims } = useAuth();
  const toast = useToast();
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const reqRef = useRef(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [applied, setApplied] = useState<Filters>(DEFAULT_FILTERS);
  const [draft, setDraft] = useState<Filters>(DEFAULT_FILTERS);
  const [open, setOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useFocusTrap(dialogRef, open);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    api<{ categories: Category[] }>("/api/categories")
      .then((res) => setCategories(res.categories.map((c) => c.name)))
      .catch(() => setCategories([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const reqId = ++reqRef.current;
    try {
      const params = new URLSearchParams();
      if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());
      if (applied.from) params.set("from", applied.from);
      if (applied.to) params.set("to", applied.to);
      if (applied.department) params.set("department", applied.department);
      if (applied.category) params.set("category", applied.category);
      if (applied.statuses.length) params.set("statuses", applied.statuses.join(","));
      const res = await api<{ issues: Issue[]; truncated: boolean }>(
        `/api/issue-history?${params.toString()}`
      );
      if (reqId === reqRef.current) {
        setIssues(res.issues);
        setError(null);
      }
    } catch (e) {
      if (reqId === reqRef.current) {
        setError(e instanceof ApiError ? e.message : "Failed to load issue history.");
      }
    } finally {
      if (reqId === reqRef.current) setLoading(false);
    }
  }, [applied, debouncedQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of STATUSES) counts[s] = 0;
    for (const i of issues ?? []) if (i.status in counts) counts[i.status] += 1;
    const resolved = counts.COMPLETED + counts.VERIFIED + counts.CLOSED;
    const inProgress = counts.ASSIGNED + counts.ONGOING + counts.PENDING;
    return { total: issues?.length ?? 0, resolved, inProgress, unresolved: (issues?.length ?? 0) - resolved };
  }, [issues]);

  const activeFilterCount =
    [applied.from, applied.to, applied.department, applied.category].filter(Boolean).length +
    applied.statuses.length;

  if (!claims) return null;
  if (!HISTORY_ROLES.includes(claims.role)) {
    return (
      <EmptyState title="Role restricted" body="Admins and the Principal can view the full issue history." />
    );
  }
  if (error) return <EmptyState title="Couldn't load history" body={error} />;
  if (!issues) return <Loading label="Loading issue history…" />;

  const openFilters = () => {
    setDraft(applied);
    setOpen(true);
  };

  const applyFilters = () => {
    setApplied(draft);
    setOpen(false);
  };

  const resetFilters = () => {
    setDraft(DEFAULT_FILTERS);
    setApplied(DEFAULT_FILTERS);
    setOpen(false);
  };

  const toggleStatus = (s: IssueStatus) => {
    setDraft((d) =>
      d.statuses.includes(s) ? { ...d, statuses: d.statuses.filter((x) => x !== s) } : { ...d, statuses: [...d.statuses, s] }
    );
  };

  const boardEligible = (i: Issue) => i.priority >= 1 && i.priority <= BOARD_MAX_PRIORITY;

  const toggleBoard = async (issue: Issue) => {
    if (togglingId) return;
    setTogglingId(issue.id ?? "");
    try {
      const hidden = !issue.boardHidden;
      await api<{ ok: boolean; boardHidden: boolean }>(
        `/api/issues/${issue.id}/board-visibility`,
        { method: "POST", body: JSON.stringify({ hidden }) }
      );
      setIssues((prev) =>
        prev ? prev.map((x) => (x.id === issue.id ? { ...x, boardHidden: hidden } : x)) : prev
      );
      toast.show({
        type: "success",
        title: hidden ? "Hidden from board" : "Shown on board",
        message: hidden
          ? "This issue no longer appears on the shared dashboard board."
          : "This issue now appears on the shared dashboard board.",
      });
    } catch (e) {
      toast.showError(e, { title: "Couldn't update board visibility" });
    } finally {
      setTogglingId(null);
    }
  };

  const kpis = [
    { label: "Total", value: summary.total },
    { label: "Resolved", value: summary.resolved },
    { label: "Unresolved", value: summary.unresolved },
    { label: "In progress", value: summary.inProgress },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="font-display text-2xl max-md:text-xl font-semibold text-ink">Issue history</h1>
          <p className="mt-1 text-sm text-slate">
            Every reported issue, searchable and filterable — {summary.total} shown
            {applied.statuses.length || applied.from || applied.to || applied.department || applied.category
              ? " (filtered)"
              : ""}
            .
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {kpis.map((k) => (
            <div key={k.label} className="card flex flex-1 flex-col gap-0.5 px-4 py-3 max-md:px-3 max-md:py-2 sm:max-w-[150px]">
              <span className="text-xl font-semibold text-ink">{k.value}</span>
              <span className="text-xs text-slate">{k.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title…"
            aria-label="Search issues by title"
            className="input pl-9"
          />
        </div>
        {loading && (
          <span className="inline-flex items-center gap-2 text-xs text-slate" role="status" aria-live="polite">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-silver border-t-ink" aria-hidden />
            Searching…
          </span>
        )}
        <button type="button" className="btn btn-secondary" onClick={openFilters} aria-haspopup="dialog" aria-expanded={open}>
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
          Filters
          {activeFilterCount > 0 && (
            <span className="tag bg-ink text-white">{activeFilterCount}</span>
          )}
        </button>
      </div>

      <div className="card overflow-x-auto">
        {issues.length === 0 ? (
          <EmptyState
            icon={<History className="h-8 w-8" aria-hidden />}
            title="No issues match"
            body="Try clearing the search or filters, or widening the date range."
          />
        ) : (
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-silver text-xs uppercase tracking-wide text-slate">
                <th className="px-4 py-3 max-md:px-3 max-md:py-2 font-medium">Issue</th>
                <th className="px-4 py-3 max-md:px-3 max-md:py-2 font-medium">Department</th>
                <th className="px-4 py-3 max-md:px-3 max-md:py-2 font-medium">Category</th>
                <th className="px-4 py-3 max-md:px-3 max-md:py-2 font-medium">Status</th>
                <th className="px-4 py-3 max-md:px-3 max-md:py-2 font-medium">Priority</th>
                <th className="px-4 py-3 max-md:px-3 max-md:py-2 font-medium">Board</th>
                <th className="px-4 py-3 max-md:px-3 max-md:py-2 font-medium">Reported</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((i) => (
                <tr key={i.id} className="border-b border-silver last:border-0 hover:bg-paper">
                  <td className="max-w-[260px] px-4 py-3 max-md:px-3 max-md:py-2">
                    <Link href={`/issues/${i.id}`} className="group block">
                      <span className="text-xs text-slate">{i.issueNo}</span>
                      <span className="block truncate font-medium text-ink group-hover:text-primary">
                        {i.title}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 max-md:px-3 max-md:py-2 text-graphite">{i.department}</td>
                  <td className="px-4 py-3 max-md:px-3 max-md:py-2 text-slate">{i.routing?.categoryName || "—"}</td>
                  <td className="px-4 py-3 max-md:px-3 max-md:py-2">
                    <StatusBadge status={i.status} />
                  </td>
                  <td className="px-4 py-3 max-md:px-3 max-md:py-2">
                    <PriorityBadge priority={i.priority} />
                  </td>
                  <td className="px-4 py-3 max-md:px-3 max-md:py-2">
                    {boardEligible(i) ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void toggleBoard(i)}
                          disabled={togglingId === i.id}
                          aria-label={
                            i.boardHidden
                              ? `Show ${i.issueNo} on the dashboard board`
                              : `Hide ${i.issueNo} from the dashboard board`
                          }
                          aria-pressed={!!i.boardHidden}
                          className="btn btn-ghost btn-sm"
                        >
                          {i.boardHidden ? (
                            <EyeOff className="h-3.5 w-3.5" aria-hidden />
                          ) : (
                            <Eye className="h-3.5 w-3.5" aria-hidden />
                          )}
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-stone">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 max-md:px-3 max-md:py-2">
                    <span className="block text-graphite">{formatDate(i.createdAt)}</span>
                    <span className="block text-xs text-slate">{i.reporter?.name || "Unknown"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Filters" ref={dialogRef}>
          <div className="animate-overlay-in absolute inset-0 bg-black/40 backdrop-blur-sm dark:bg-black/60" onClick={() => setOpen(false)} aria-hidden />
          <div className="animate-panel-in card relative w-full max-w-lg">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg max-md:text-base font-semibold text-ink">Filters</h2>
                <p className="mt-1 text-sm text-slate">Narrow the history below.</p>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)} aria-label="Close">
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="filter-from">From</label>
                <input
                  id="filter-from"
                  type="date"
                  value={draft.from}
                  onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
                  className="input"
                />
              </div>
              <div>
                <label className="label" htmlFor="filter-to">To</label>
                <input
                  id="filter-to"
                  type="date"
                  value={draft.to}
                  onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
                  className="input"
                />
              </div>
              <div>
                <label className="label" htmlFor="filter-department">Department</label>
                <select
                  id="filter-department"
                  value={draft.department}
                  onChange={(e) => setDraft((d) => ({ ...d, department: e.target.value }))}
                  className="input"
                >
                  <option value="">All departments</option>
                  {DEPARTMENTS.map((dep) => (
                    <option key={dep} value={dep}>{dep}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="filter-category">Category</label>
                <select
                  id="filter-category"
                  value={draft.category}
                  onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                  className="input"
                >
                  <option value="">All categories</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-5">
              <p className="label">Status</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`btn btn-sm ${draft.statuses.length === 0 ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setDraft((d) => ({ ...d, statuses: [] }))}
                >
                  All
                </button>
                {STATUS_GROUPS.map((g) => (
                  <button
                    key={g.key}
                    type="button"
                    className={`btn btn-sm ${
                      draft.statuses.length > 0 &&
                      g.statuses.every((s) => draft.statuses.includes(s))
                        ? "btn-primary"
                        : "btn-ghost"
                    }`}
                    onClick={() => setDraft((d) => ({ ...d, statuses: g.statuses }))}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {STATUSES.map((s) => {
                  const active = draft.statuses.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleStatus(s)}
                      aria-pressed={active}
                      className={`tag cursor-pointer select-none transition-colors ${
                        active ? "bg-ink text-white" : "text-slate hover:bg-paper"
                      }`}
                    >
                      {STATUS_LABEL[s]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn btn-ghost" onClick={resetFilters}>
                Reset
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={applyFilters}>
                Apply filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

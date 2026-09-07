"use client";

import { useState } from "react";
import { useIssues } from "@/hooks/useIssues";
import { useAuth } from "@/components/auth/AuthProvider";
import { Loading, EmptyState, BoardErrorState } from "@/components/ui/States";
import { MaintenanceJobCard } from "@/components/issues/MaintenanceJobCard";
import { assertRouteAccess } from "@/lib/roleGuards";
import type { IssueStatus } from "@/lib/types";

const TABS: { key: IssueStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "ASSIGNED", label: "To do" },
  { key: "ONGOING", label: "In progress" },
  { key: "PENDING", label: "Pending" },
  { key: "COMPLETED", label: "Done" },
  { key: "INSPECTED", label: "Inspected" },
  { key: "VERIFIED", label: "Verified" },
];

export default function JobsPage() {
  const { claims } = useAuth();
  const { issues, error, reload } = useIssues({});
  const [tab, setTab] = useState<IssueStatus | "all">("ASSIGNED");

  assertRouteAccess(claims, ["maintenance"]);

  if (!issues) return <Loading label="Loading jobs…" />;
  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl max-md:text-xl font-semibold text-ink">Jobs</h1>
          <p className="mt-1 text-sm text-slate">Your team&apos;s assignments across the campus.</p>
        </div>
        <BoardErrorState message={error} onRetry={() => void reload()} />
      </div>
    );
  }

  const count = (s: IssueStatus) => issues.filter((i) => i.status === s).length;
  const visible = issues.filter((i) => tab === "all" || i.status === tab);
  const showDone = ["COMPLETED", "INSPECTED", "VERIFIED"].includes(tab);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl max-md:text-xl font-semibold text-ink">Jobs</h1>
        <p className="mt-1 text-sm text-slate">Your team&apos;s assignments across the campus.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`btn btn-sm ${tab === t.key ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setTab(t.key)}
          >
            {t.label} <span className="opacity-60">({t.key === "all" ? issues.length : count(t.key)})</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={`No ${tab === "all" ? "" : TABS.find((t) => t.key === tab)?.label.toLowerCase() + " "}jobs`}
          body="New assignments from your department validator will appear here."
        />
      ) : (
        <div className="grid items-stretch gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-3">
          {visible.map((issue) => (
            <MaintenanceJobCard key={issue.id} issue={issue} onRefresh={() => void reload()} />
          ))}
        </div>
      )}

      {!showDone && (
        <button onClick={() => void reload()} className="btn btn-ghost btn-sm self-start">
          Refresh board
        </button>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { CornerDownRight } from "lucide-react";
import { useIssues } from "@/hooks/useIssues";
import { useAuth } from "@/components/auth/AuthProvider";
import { Loading, EmptyState, BoardErrorState } from "@/components/ui/States";
import { DispatchCard } from "@/components/issues/DispatchCard";
import { assertRouteAccess } from "@/lib/roleGuards";
import { HEAD_ROLES } from "@/lib/nav";
import type { IssueStatus } from "@/lib/types";

const TABS: { key: IssueStatus; label: string }[] = [
  { key: "ROUTED", label: "To dispatch" },
  { key: "PENDING_ASSIGN", label: "To assign" },
  { key: "ASSIGNED", label: "Assigned" },
  { key: "ONGOING", label: "In progress" },
  { key: "PENDING", label: "Pending" },
];

export default function DispatchPage() {
  const { claims } = useAuth();
  const { issues, error, reload } = useIssues({});
  const [tab, setTab] = useState<IssueStatus | "all">("all");

  if (!claims) return null;
  if (!issues) return <Loading label="Loading dispatch…" />;

  const role = claims.role as "maintenance_head" | "category_head";
  assertRouteAccess(claims, HEAD_ROLES);

  const isMaintHead = role === "maintenance_head";
  const defaultTab: IssueStatus = isMaintHead ? "ROUTED" : "PENDING_ASSIGN";
  const reviewTabs: { key: IssueStatus; label: string }[] = isMaintHead
    ? []
    : [{ key: "COMPLETED", label: "To verify" }];
  const tabs = [...TABS, ...reviewTabs];
  const activeTab: IssueStatus = tab === "all" ? defaultTab : tab;
  const queue = issues.filter((i) => i.status === activeTab);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl max-md:text-xl font-semibold text-ink">
          {isMaintHead ? "Dispatch" : "Assign jobs"}
        </h1>
        <p className="mt-1 text-sm text-slate">
          {isMaintHead
            ? `${claims.categoryName || "No category"} · Forward validated work to the right maintenance team.`
            : `${claims.categoryName || "No category"} · Pick teams and workers for forwarded jobs.`}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className={`btn btn-sm ${tab === "all" || tab === defaultTab ? "btn-primary" : "btn-ghost"}`}
          onClick={() => setTab(defaultTab)}
        >
          {isMaintHead ? "To dispatch" : "To assign"}{" "}
          <span className="opacity-60">
            ({issues.filter((i) => i.status === defaultTab).length})
          </span>
        </button>
        {tabs.filter((t) => t.key !== defaultTab).map((t) => (
          <button
            key={t.key}
            className={`btn btn-sm ${tab === t.key ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setTab(t.key)}
          >
            {t.label} <span className="opacity-60">({issues.filter((i) => i.status === t.key).length})</span>
          </button>
        ))}
      </div>

      {error ? (
        <BoardErrorState message={error} onRetry={() => void reload()} />
      ) : queue.length === 0 ? (
        <EmptyState
          icon={<CornerDownRight className="h-8 w-8" aria-hidden />}
          title={`No ${(tabs.find((t) => t.key === tab)?.label || "issues").toLowerCase()}`}
          body={
            isMaintHead
              ? "Validated P3–5 issues will land here for you to forward to a category team."
              : "Forwarded issues will land here for you to assign a team and workers."
          }
        />
      ) : (
        <div className="grid items-stretch gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-3">
          {queue.map((issue) => (
            <DispatchCard key={issue.id} issue={issue} role={role} onRefresh={() => void reload()} />
          ))}
        </div>
      )}

      <button onClick={() => void reload()} className="btn btn-ghost btn-sm self-start">
        Refresh board
      </button>
    </div>
  );
}

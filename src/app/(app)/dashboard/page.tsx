"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock, CircleCheck, Plus, TriangleAlert } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useIssues } from "@/hooks/useIssues";
import { IssueCard } from "@/components/ui/IssueCard";
import { CloseIssueModal } from "@/components/issues/CloseIssueModal";
import { Loading, EmptyState } from "@/components/ui/States";
import type { Issue } from "@/lib/types";

const OPEN_STATUSES = ["NEW", "VALIDATED", "ESCALATED", "APPROVED", "ASSIGNED", "ONGOING", "PENDING"];

export default function DashboardPage() {
  const { claims } = useAuth();
  const { issues, error, reload } = useIssues({ mine: true });
  const [closeIssue, setCloseIssue] = useState<Issue | null>(null);

  if (error) {
    return (
      <EmptyState
        title="Couldn't load your issues"
        body={error}
      />
    );
  }
  if (!issues) return <Loading label="Loading your issues…" />;

  const open = issues.filter((i) => OPEN_STATUSES.includes(i.status)).length;
  const ongoing = issues.filter((i) => ["ASSIGNED", "ONGOING"].includes(i.status)).length;
  const resolved = issues.filter((i) => ["VERIFIED", "CLOSED"].includes(i.status)).length;

  const kpis = [
    { label: "Open", value: open, icon: TriangleAlert, tone: "text-danger" },
    { label: "In progress", value: ongoing, icon: Clock, tone: "text-warning" },
    { label: "Resolved", value: resolved, icon: CircleCheck, tone: "text-success" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">
            Hello, {claims?.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-slate">Track everything you have reported on campus.</p>
        </div>
        <Link href="/new" className="btn btn-primary">
          <Plus className="h-3.5 w-3.5" aria-hidden /> Report an issue
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="kpi !px-[12px] !py-[16px] sm:!px-[24px] sm:!py-[20px]">
            <div className={`flex items-center gap-2 ${k.tone}`}>
              <k.icon className="h-4 w-4" aria-hidden />
              <span className="text-xs font-medium uppercase tracking-wide">{k.label}</span>
            </div>
            <p className="mt-2 font-display text-3xl font-semibold text-ink">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-ink">My issues</h2>
        <button onClick={() => void reload()} className="btn btn-ghost btn-sm">
          Refresh
        </button>
      </div>

      {issues.length === 0 ? (
        <EmptyState
          title="No issues yet"
          body="Report your first maintenance issue and follow it through to closure."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {issues.map((issue) => (
            <IssueCard key={issue.id} issue={issue} onClose={() => setCloseIssue(issue)} />
          ))}
        </div>
      )}

      <CloseIssueModal
        issue={closeIssue}
        onClose={() => setCloseIssue(null)}
        onClosed={() => void reload()}
      />
    </div>
  );
}

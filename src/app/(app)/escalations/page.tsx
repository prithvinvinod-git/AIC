"use client";

import { BarChart3 } from "lucide-react";
import { useIssues } from "@/hooks/useIssues";
import { useAuth } from "@/components/auth/AuthProvider";
import { Loading, EmptyState, BoardErrorState } from "@/components/ui/States";
import { EscalationCard } from "@/components/issues/EscalationCard";
import { WeeklyInsightsCard } from "@/components/ai/WeeklyInsightsCard";

export default function HodPage() {
  const { claims } = useAuth();
  const { issues, error, reload } = useIssues({ status: "ESCALATED" });

  if (!claims) return null;
  if (!issues) return <Loading label="Loading escalations…" />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl max-md:text-xl font-semibold text-ink">Escalations</h1>
        <p className="mt-1 text-sm text-slate">
          {claims.name} · Critical issues awaiting your approval before execution.
        </p>
      </div>

      <WeeklyInsightsCard />

      {error ? (
        <BoardErrorState message={error} onRetry={() => void reload()} />
      ) : issues.length === 0 ? (
        <EmptyState
          icon={<BarChart3 className="h-8 w-8" aria-hidden />}
          title="No escalations pending"
          body="Approved critical issues will flow here from department validation."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {issues.map((issue) => (
            <EscalationCard
              key={issue.id}
              issue={issue}
              onAction={() => void reload()}
            />
          ))}
        </div>
      )}
    </div>
  );
}

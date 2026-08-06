"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import { BarChart3, TrendingUp } from "lucide-react";
import { useIssues } from "@/hooks/useIssues";
import { useAuth } from "@/components/auth/AuthProvider";
import { Loading, EmptyState } from "@/components/ui/States";
import { EscalationCard } from "@/components/issues/EscalationCard";
import { api } from "@/lib/clientApi";

interface Insight {
  executiveSummary: string;
  slaBreaches: string[];
  topConcerns: string[];
  recommendations: string[];
}

export default function HodPage() {
  const { claims } = useAuth();
  const { issues, reload } = useIssues({ status: "ESCALATED" });
  const [insight, setInsight] = useState<Insight | null>(null);
  const [insightBusy, setInsightBusy] = useState(false);

  const loadInsight = useCallback(async () => {
    setInsightBusy(true);
    try {
      const res = await api<{ insight: Insight }>("/api/ai/weekly-insights");
      setInsight(res.insight);
    } catch {
      setInsight(null);
    } finally {
      setInsightBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadInsight();
  }, [loadInsight]);

  if (!claims) return null;
  if (!issues) return <Loading label="Loading escalations…" />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Escalations</h1>
        <p className="mt-1 text-sm text-slate">
          {claims.name} · Critical issues awaiting your approval before execution.
        </p>
      </div>

      <div className="card">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-action-blue" aria-hidden />
            <p className="font-medium text-graphite">Weekly insights</p>
          </div>
          <button onClick={() => void loadInsight()} disabled={insightBusy} className="btn btn-ghost btn-sm">
            {insightBusy ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        {insight ? (
          <div className="mt-3 flex flex-col gap-2 text-sm text-slate">
            <p>{insight.executiveSummary}</p>
            {insight.topConcerns.length > 0 && (
              <ul className="flex flex-col gap-1">
                {insight.topConcerns.map((c, i) => (
                  <li key={i}>• {c}</li>
                ))}
              </ul>
            )}
            {insight.slaBreaches.length > 0 && (
              <ul className="flex flex-col gap-1 text-[#d97706]">
                {insight.slaBreaches.map((b, i) => (
                  <li key={i}>• {b}</li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate">No insight data yet this week.</p>
        )}
      </div>

      {issues.length === 0 ? (
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

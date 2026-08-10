"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { AlertTriangle, CheckCircle2, RefreshCw, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { api } from "@/lib/clientApi";
import type { WeeklyInsight } from "@/lib/ai/insights";

const WeeklyInsightsCharts = dynamic(
  () => import("./WeeklyInsightsCharts").then((m) => m.WeeklyInsightsCharts),
  { ssr: false }
);

export function WeeklyInsightsCard() {
  const [insight, setInsight] = useState<WeeklyInsight | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ insight: WeeklyInsight }>("/api/ai/weekly-insights");
      setInsight(res.insight);
    } catch {
      setError("Failed to load weekly insights. Please try again.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <div className="card">
        <p className="text-sm text-danger">{error}</p>
      </div>
    );
  }

  if (!insight) {
    return (
      <div className="card">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-accent" aria-hidden />
          <p className="font-medium text-graphite">Weekly insights</p>
        </div>
        <p className="mt-3 text-sm text-slate">Loading this week&apos;s governance picture…</p>
      </div>
    );
  }

  const t = insight.totals;
  const periodLabel = `${format(new Date(insight.period.start), "MMM d")} – ${format(new Date(insight.period.end), "MMM d, yyyy")}`;

  const kpis = [
    { label: "Reported", value: t.created, tone: "text-ink" },
    { label: "Resolved", value: t.closed, tone: "text-success" },
    { label: "Still open", value: t.open, tone: "text-warning" },
    { label: "SLA compliance", value: `${t.slaCompliancePct}%`, tone: t.slaCompliancePct >= 90 ? "text-success" : "text-warning" },
    { label: "Avg resolution", value: `${t.avgResolutionHours}h`, tone: "text-ink" },
    { label: "SLA breaches", value: t.breached, tone: t.breached > 0 ? "text-danger" : "text-success" },
  ];

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-accent" aria-hidden />
          <div>
            <p className="font-medium text-graphite">Weekly insights</p>
            <p className="text-xs text-slate">{periodLabel}</p>
          </div>
        </div>
        <button onClick={() => void load()} disabled={busy} className="btn btn-ghost btn-sm">
          <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} aria-hidden />
          {busy ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {insight.executiveSummary && (
        <p className="mt-4 rounded-lg bg-paper px-4 py-3 text-sm text-graphite">{insight.executiveSummary}</p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-6">
        {kpis.map((k) => (
          <div key={k.label} className="kpi">
            <p className="text-xs font-medium uppercase tracking-wide text-slate">{k.label}</p>
            <p className={`mt-2 font-display text-3xl font-semibold ${k.tone}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {t.breached > 0 && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            {t.breached} issue{t.breached === 1 ? "" : "s"} missed {t.breached === 1 ? "its" : "their"} resolution
            SLA this week — review the unresolved backlog.
          </p>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <WeeklyInsightsCharts insight={insight} />

        <div className="flex flex-col gap-4">
          <div>
            <p className="font-medium text-graphite">Top concerns</p>
            {insight.topConcerns.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-1.5 text-sm text-slate">
                {insight.topConcerns.map((c, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                    {c}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate">No concerns to flag.</p>
            )}
          </div>

          <div>
            <p className="font-medium text-graphite">Recommendations</p>
            {insight.recommendations.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-1.5 text-sm text-slate">
                {insight.recommendations.map((r, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                    {r}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate">No recommendations yet.</p>
            )}
          </div>

          <div>
            <p className="font-medium text-graphite">SLA status</p>
            <ul className="mt-2 flex flex-col gap-1.5 text-sm">
              {insight.slaBreaches.map((b, i) => (
                <li
                  key={i}
                  className={`flex items-start gap-2 ${b.toLowerCase().includes("no sla") ? "text-success" : "text-warning"}`}
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden />
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

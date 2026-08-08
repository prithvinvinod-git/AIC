"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";
import { api } from "@/lib/clientApi";
import type { WeeklyInsight } from "@/lib/ai/insights";

const PIE_COLORS = [
  "#0099ff",
  "#101010",
  "#f59e0b",
  "#10b981",
  "#8b5cf6",
  "#ef4444",
  "#06b6d4",
  "#f97316",
  "#64748b",
];

function formatDay(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : format(d, "EEE");
}

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
        <p className="text-sm text-[#c0392b]">{error}</p>
      </div>
    );
  }

  if (!insight) {
    return (
      <div className="card">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-action-blue" aria-hidden />
          <p className="font-medium text-graphite">Weekly insights</p>
        </div>
        <p className="mt-3 text-sm text-slate">Loading this week&apos;s governance picture…</p>
      </div>
    );
  }

  const t = insight.totals;
  const periodLabel = `${format(new Date(insight.period.start), "MMM d")} – ${format(new Date(insight.period.end), "MMM d, yyyy")}`;
  const totalCat = insight.byCategory.reduce((s, c) => s + c.value, 0);

  const kpis = [
    { label: "Reported", value: t.created, tone: "text-ink" },
    { label: "Resolved", value: t.closed, tone: "text-[#10b981]" },
    { label: "Still open", value: t.open, tone: "text-[#f59e0b]" },
    { label: "SLA compliance", value: `${t.slaCompliancePct}%`, tone: t.slaCompliancePct >= 90 ? "text-[#10b981]" : "text-[#d97706]" },
    { label: "Avg resolution", value: `${t.avgResolutionHours}h`, tone: "text-ink" },
    { label: "SLA breaches", value: t.breached, tone: t.breached > 0 ? "text-[#ef4444]" : "text-[#10b981]" },
  ];

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-action-blue" aria-hidden />
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
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-[#fef2f2] px-4 py-3 text-sm text-[#be123c]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            {t.breached} issue{t.breached === 1 ? "" : "s"} missed {t.breached === 1 ? "its" : "their"} resolution
            SLA this week — review the unresolved backlog.
          </p>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <p className="font-medium text-graphite">Complaints by category</p>
          {insight.byCategory.length > 0 ? (
            <div className="mt-2 flex flex-col items-center gap-4 sm:flex-row">
              <div className="h-52 w-full sm:w-1/2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={insight.byCategory}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={72}
                      paddingAngle={2}
                    >
                      {insight.byCategory.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip
                      formatter={(value, name) => [`${value ?? 0} issue${value === 1 ? "" : "s"}`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="flex w-full flex-col gap-1.5 text-sm sm:w-1/2">
                {insight.byCategory.map((c, i) => (
                  <li key={c.name} className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                      aria-hidden
                    />
                    <span className="flex-1 text-slate">{c.name}</span>
                    <span className="font-medium text-graphite">{c.value}</span>
                    <span className="w-10 text-right text-xs text-slate">
                      {totalCat ? Math.round((c.value / totalCat) * 100) : 0}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate">No issues reported this week.</p>
          )}
        </div>

        <div>
          <p className="font-medium text-graphite">Daily trend</p>
          <div className="mt-2 h-52">
            {insight.trend.some((d) => d.created > 0 || d.closed > 0 || d.unresolved > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={insight.trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="#898989" tickFormatter={formatDay} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#898989" />
                  <ChartTooltip labelFormatter={(label) => formatDay(String(label))} />
                  <Line type="monotone" dataKey="created" name="Reported" stroke="#0099ff" strokeWidth={2} />
                  <Line type="monotone" dataKey="closed" name="Resolved" stroke="#10b981" strokeWidth={2} />
                  <Line type="monotone" dataKey="unresolved" name="Still open" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 3" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate">No activity recorded this week.</p>
            )}
          </div>
        </div>

        <div>
          <p className="font-medium text-graphite">Complaints by priority</p>
          <div className="mt-2 h-52">
            {insight.byPriority.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={insight.byPriority}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#898989" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#898989" />
                  <ChartTooltip
                    formatter={(value, name) => [`${value ?? 0} issue${value === 1 ? "" : "s"}`, name]}
                  />
                  <Bar dataKey="value" name="Issues" fill="#0099ff" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate">No priority data this week.</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <p className="font-medium text-graphite">Top concerns</p>
            {insight.topConcerns.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-1.5 text-sm text-slate">
                {insight.topConcerns.map((c, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-action-blue" aria-hidden />
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
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#10b981]" aria-hidden />
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
                  className={`flex items-start gap-2 ${b.toLowerCase().includes("no sla") ? "text-[#10b981]" : "text-[#d97706]"}`}
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

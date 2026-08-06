"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@/components/auth/AuthProvider";
import { api, ApiError } from "@/lib/clientApi";
import { Loading, EmptyState } from "@/components/ui/States";
import { ANALYTICS_ROLES } from "@/lib/nav";

interface SummaryResponse {
  summary: {
    range: number;
    totals: {
      issues: number;
      totalAllTime: number;
      open: number;
      closed: number;
      avgResolutionHours: number;
      slaCompliancePct: number;
      byStatus: Record<string, number>;
      byCategory: Record<string, number>;
      byDepartment: Record<string, number>;
      byPriority: Record<number, number>;
    };
    trend: { day: string; created: number; closed: number; unresolved: number }[];
  };
}

export default function AnalyticsPage() {
  const { claims } = useAuth();
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [range, setRange] = useState(7);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setData(null);
    try {
      const res = await api<SummaryResponse>(`/api/analytics/summary?range=${range}`);
      setData(res);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load analytics.");
    }
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!claims) return null;
  if (!ANALYTICS_ROLES.includes(claims.role)) {
    return (
      <EmptyState title="Analytics are role-gated" body="HODs, the Principal, the Maintenance Head and admins can view analytics." />
    );
  }
  if (error) return <EmptyState title="Couldn't load analytics" body={error} />;
  if (!data) return <Loading label="Crunching numbers…" />;

  const t = data.summary.totals;
  const statusData = Object.entries(t.byStatus).map(([name, value]) => ({ name, value }));
  const categoryData = Object.entries(t.byCategory).map(([name, value]) => ({ name, value }));

  const kpis = [
    { label: "Issues (window)", value: t.issues },
    { label: "Still unresolved", value: t.open },
    { label: "Resolved (all-time)", value: t.closed },
    { label: "Avg resolution", value: `${t.avgResolutionHours}h` },
    { label: "SLA compliance", value: `${t.slaCompliancePct}%` },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Analytics</h1>
          <p className="mt-1 text-sm text-slate">Last {range} days of campus maintenance activity.</p>
        </div>
        <div className="flex gap-2">
          {[7, 30].map((r) => (
            <button
              key={r}
              className={`btn btn-sm ${range === r ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setRange(r)}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className="kpi">
            <p className="text-xs font-medium uppercase tracking-wide text-slate">{k.label}</p>
            <p className="mt-2 font-display text-3xl font-semibold text-ink">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <p className="font-medium text-graphite">Created vs resolved vs still unresolved</p>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.summary.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="#898989" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#898989" />
              <Tooltip />
              <Line type="monotone" dataKey="created" name="Created" stroke="#101010" strokeWidth={2} />
              <Line type="monotone" dataKey="closed" name="Resolved" stroke="#0099ff" strokeWidth={2} />
              <Line type="monotone" dataKey="unresolved" name="Still unresolved" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 3" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <p className="font-medium text-graphite">By status</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#898989" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#898989" />
                <Tooltip />
                <Bar dataKey="value" name="Issues" fill="#0099ff" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <p className="font-medium text-graphite">By category</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#898989" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#898989" />
                <Tooltip />
                <Bar dataKey="value" name="Issues" fill="#101010" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

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
import type { WeeklyInsight } from "@/lib/ai/insights";
import { CATEGORY_COLORS } from "@/lib/chartColors";

function formatDay(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : format(d, "EEE");
}

export function WeeklyInsightsCharts({ insight }: { insight: WeeklyInsight }) {
  const totalCat = insight.byCategory.reduce((s, c) => s + c.value, 0);

  return (
    <>
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
                      <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
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
                    style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
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
                <CartesianGrid strokeDasharray="3 3" stroke="#e6e2d8" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="#a8a29e" tickFormatter={formatDay} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#a8a29e" />
                <ChartTooltip labelFormatter={(label) => formatDay(String(label))} />
                <Line type="monotone" dataKey="created" name="Reported" stroke="#c1452e" strokeWidth={2} />
                <Line type="monotone" dataKey="closed" name="Resolved" stroke="#3e7d4b" strokeWidth={2} />
                <Line type="monotone" dataKey="unresolved" name="Still open" stroke="#eab308" strokeWidth={2} strokeDasharray="5 3" />
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
                <CartesianGrid strokeDasharray="3 3" stroke="#e6e2d8" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#a8a29e" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#a8a29e" />
                <ChartTooltip
                  formatter={(value, name) => [`${value ?? 0} issue${value === 1 ? "" : "s"}`, name]}
                />
                <Bar dataKey="value" name="Issues" fill="#c1452e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate">No priority data this week.</p>
          )}
        </div>
      </div>
    </>
  );
}

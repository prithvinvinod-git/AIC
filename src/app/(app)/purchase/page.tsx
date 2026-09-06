"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Banknote,
  ChartColumn,
  ReceiptText,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { useIssues } from "@/hooks/useIssues";
import { Loading, EmptyState, BoardErrorState } from "@/components/ui/States";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/Badge";
import { api, ApiError } from "@/lib/clientApi";
import { useActionError } from "@/components/ui/Toast";
import { CATEGORY_COLORS } from "@/lib/chartColors";
import type { Issue, Requirement } from "@/lib/types";

type Tab = "queue" | "history" | "analytics";

interface PurchaseRecord {
  id?: string;
  item: string;
  qty: number;
  unitPrice: number;
  total: number;
  categoryName: string;
  college: string;
  department: string;
  issueNo: string;
  title: string;
  approvedAt: string;
  approvedBy?: { uid: string; name: string };
  source?: "purchase" | "senior";
  seniorApproved?: boolean;
}

interface AnalyticsResponse {
  analytics: {
    year: number;
    total: number;
    count: number;
    avg: number;
    byMonth: { label: string; total: number; count: number }[];
    byCategory: { name: string; total: number }[];
    byCollege: { name: string; total: number }[];
    byDepartment: { name: string; total: number }[];
  };
}

const inr = (n: number) => `₹${Math.round(n || 0).toLocaleString("en-IN")}`;

const sourceLabel = (s?: string) => (s === "senior" ? "Senior" : "Purchase");

export default function PurchasePage() {
  const { issues, error, reload } = useIssues({});
  const { showError } = useActionError();
  const [tab, setTab] = useState<Tab>("queue");
  const [limit, setLimit] = useState<number | null>(null);
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [rejecting, setRejecting] = useState<{ issue: Issue; req: Requirement } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const [history, setHistory] = useState<PurchaseRecord[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  useEffect(() => {
    api<{ purchaseApprovalLimit: number }>("/api/config/purchase-limit")
      .then((res) => setLimit(res.purchaseApprovalLimit))
      .catch(() => setLimit(null));
  }, []);

  const loadHistory = useCallback(async () => {
    setHistory(null);
    try {
      const res = await api<{ purchases: PurchaseRecord[] }>(`/api/purchases/history?year=${year}`);
      setHistory(res.purchases);
      setHistoryError(null);
    } catch (e) {
      setHistoryError(e instanceof ApiError ? e.message : "Failed to load purchase history.");
      setHistory([]);
    }
  }, [year]);

  const loadAnalytics = useCallback(async () => {
    setAnalytics(null);
    try {
      const res = await api<AnalyticsResponse>(`/api/purchases/analytics?year=${year}`);
      setAnalytics(res);
      setAnalyticsError(null);
    } catch (e) {
      setAnalyticsError(e instanceof ApiError ? e.message : "Failed to load purchase analytics.");
      setAnalytics(null);
    }
  }, [year]);

  useEffect(() => {
    if (tab === "history") void loadHistory();
    if (tab === "analytics") void loadAnalytics();
  }, [tab, loadHistory, loadAnalytics]);

  const approve = useCallback(
    async (issue: Issue, req: Requirement) => {
      setBusy(true);
      const price = Math.max(0, Number(prices[req.id ?? ""] ?? "") || 0);
      try {
        await api(`/api/issues/${issue.id}/requirements/${req.id}/approve`, {
          method: "POST",
          body: JSON.stringify({ price }),
        });
        void reload();
      } catch (e) {
        showError(e);
      } finally {
        setBusy(false);
      }
    },
    [prices, reload, showError]
  );

  const submitReject = useCallback(async () => {
    if (!rejecting) return;
    if (reason.trim().length < 3) {
      showError("A rejection reason (at least 3 characters) is required.");
      return;
    }
    setBusy(true);
    try {
      await api(`/api/issues/${rejecting.issue.id}/requirements/${rejecting.req.id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() }),
      });
      setRejecting(null);
      setReason("");
      void reload();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  }, [rejecting, reason, reload, showError]);

  const tabs: [Tab, string, React.ReactNode][] = [
    ["queue", "Queue", <Banknote key="q" className="h-4 w-4" aria-hidden />],
    ["history", "History", <ReceiptText key="h" className="h-4 w-4" aria-hidden />],
    ["analytics", "Analytics", <ChartColumn key="a" className="h-4 w-4" aria-hidden />],
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl max-md:text-xl font-semibold text-ink">Purchases</h1>
          <p className="mt-1 text-sm text-slate">
            {tab === "queue"
              ? "Approve or reject purchase requests. Approved items are marked resolved on the job automatically."
              : tab === "history"
                ? "Approved purchases recorded on campus."
                : "Spend breakdown across approved purchases."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tabs.map(([t, label, icon]) => (
            <button
              key={t}
              className={`btn btn-sm ${tab === t ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setTab(t)}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      </div>

      {limit !== null && typeof limit === "number" && (
        <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
          Items whose total exceeds <span className="font-semibold">{inr(limit)}</span> go to HOD/Principal for approval.
        </p>
      )}

      {tab === "queue" && (
        <QueueTab
          issues={issues}
          error={error}
          reload={reload}
          prices={prices}
          setPrices={setPrices}
          busy={busy}
          approve={approve}
          onReject={setRejecting}
        />
      )}

      {tab === "history" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium uppercase tracking-wide text-slate" htmlFor="historyYear">
              Year
            </label>
            <YearSelect id="historyYear" value={year} onChange={setYear} currentYear={currentYear} />
          </div>
          {historyError ? (
            <BoardErrorState message={historyError} onRetry={() => void loadHistory()} />
          ) : history === null ? (
            <Loading label="Loading purchase history…" />
          ) : history.length === 0 ? (
            <EmptyState
              icon={<ReceiptText className="h-8 w-8" aria-hidden />}
              title={`No purchases in ${year}`}
              body="Approved purchases will appear here once the purchase team or a senior approves an item."
            />
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-silver text-left text-xs font-medium uppercase tracking-wide text-slate">
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2">Qty</th>
                    <th className="px-3 py-2">Unit</th>
                    <th className="px-3 py-2">Total</th>
                    <th className="px-3 py-2">Issue</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">College</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Approved by</th>
                    <th className="px-3 py-2">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((p) => (
                    <tr key={p.id} className="border-b border-silver last:border-0">
                      <td className="px-3 py-2.5 font-medium text-graphite">{p.item}</td>
                      <td className="px-3 py-2.5 text-slate">×{p.qty}</td>
                      <td className="px-3 py-2.5 text-slate">{inr(p.unitPrice)}</td>
                      <td className="px-3 py-2.5 font-semibold text-graphite">{inr(p.total)}</td>
                      <td className="px-3 py-2.5 text-slate">
                        <span className="whitespace-nowrap">{p.issueNo}</span>
                      </td>
                      <td className="px-3 py-2.5 text-slate">{p.categoryName || "—"}</td>
                      <td className="px-3 py-2.5 text-slate">{p.college || "—"}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-slate">
                        {new Date(p.approvedAt).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2.5 text-slate">{p.approvedBy?.name || "—"}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`tag ${p.source === "senior" ? "bg-warning-soft text-warning" : "bg-success-soft text-success"}`}
                        >
                          {sourceLabel(p.source)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "analytics" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium uppercase tracking-wide text-slate" htmlFor="analyticsYear">
              Year
            </label>
            <YearSelect id="analyticsYear" value={year} onChange={setYear} currentYear={currentYear} />
          </div>
          {analyticsError ? (
            <BoardErrorState message={analyticsError} onRetry={() => void loadAnalytics()} />
          ) : analytics === null ? (
            <Loading label="Crunching purchase numbers…" />
          ) : analytics.analytics.count === 0 ? (
            <EmptyState
              icon={<Banknote className="h-8 w-8" aria-hidden />}
              title={`No purchase data for ${year}`}
              body="Approved purchases will be reflected here once items are approved."
            />
          ) : (
            <AnalyticsContent data={analytics.analytics} />
          )}
        </div>
      )}

      <Modal open={!!rejecting} onClose={() => setRejecting(null)} title="Reject purchase request">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate">
            {rejecting?.req.item} ×{rejecting?.req.qty} — why is this being rejected?
          </p>
          <textarea
            className="input resize-none"
            rows={3}
            required
            minLength={3}
            value={reason}
            placeholder="e.g. Out of scope / wrong spec / already in stock…"
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex gap-2">
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => void submitReject()}>
              Confirm rejection
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setRejecting(null)} disabled={busy}>
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function QueueTab({
  issues,
  error,
  reload,
  prices,
  setPrices,
  busy,
  approve,
  onReject,
}: {
  issues: Issue[] | null;
  error: string | null;
  reload: () => void;
  prices: Record<string, string>;
  setPrices: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  busy: boolean;
  approve: (issue: Issue, req: Requirement) => void;
  onReject: (v: { issue: Issue; req: Requirement }) => void;
}) {
  const router = useRouter();

  if (!issues) return <Loading label="Loading purchase requests…" />;
  if (error) return <BoardErrorState message={error} onRetry={() => void reload()} />;

  if (issues.length === 0) {
    return (
      <EmptyState
        title="No purchase requests"
        body="When maintenance staff flag a requirement for approval, it will appear here."
      />
    );
  }

  return (
    <div className="grid items-stretch gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-3">
      {issues.map((issue) => {
        const flagged = issue.requirements.filter((r) => r.needsApproval);
        const pending = flagged.filter(
          (r) => r.approvalStatus !== "approved" && r.approvalStatus !== "rejected"
        );
        return (
          <div key={issue.id} className="card flex h-full flex-col gap-3">
            <button
              type="button"
              className="flex w-full flex-col gap-2 text-left"
              onClick={() => router.push(`/issues/${issue.id}`)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate">{issue.issueNo}</p>
                  <h3 className="truncate font-display text-base font-medium text-graphite">{issue.title}</h3>
                </div>
                <StatusBadge status={issue.status} />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate">
                <span className="tag tag-outline">{issue.location.name}</span>
                <span className="tag tag-outline">{issue.routing?.categoryName}</span>
                <span className="tag tag-outline">{issue.department}</span>
              </div>
            </button>

            <ul className="flex flex-col gap-2">
              {flagged.map((r) =>
                r.approvalStatus === "approved" ? (
                  <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg bg-success-soft px-3 py-2 text-sm max-md:flex-wrap">
                    <span className="text-success">
                      {r.item} ×{r.qty}
                    </span>
                    <span className="text-xs font-medium text-success">
                      <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                      {inr((r.price ?? 0) * (r.qty || 1))}
                    </span>
                  </li>
                ) : r.approvalStatus === "rejected" ? (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm max-md:flex-wrap"
                    title={r.rejectReason}
                  >
                    <span className="text-danger">
                      {r.item} ×{r.qty}
                    </span>
                    <span className="text-xs font-medium text-danger">
                      <XCircle className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                      Rejected
                    </span>
                  </li>
                ) : r.seniorApprovalRequired ? (
                  <li key={r.id} className="rounded-lg bg-warning-soft px-3 py-2">
                    <p className="text-sm text-graphite">
                      {r.item} ×{r.qty}
                      <span className="ml-2 text-[10px] font-medium uppercase tracking-wide text-warning">
                        awaiting senior approval
                      </span>
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-warning">
                      <Clock className="h-3 w-3" aria-hidden />
                      {inr((r.price ?? 0) * (r.qty || 1))} · submitted{" "}
                      {r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : ""} — HOD/Principal will decide.
                    </p>
                  </li>
                ) : (
                  <li key={r.id} className="rounded-lg bg-warning-soft px-3 py-2">
                    <p className="text-sm text-graphite">
                      {r.item} ×{r.qty}
                      <span className="ml-2 text-[10px] font-medium uppercase tracking-wide text-warning">
                        pending approval
                      </span>
                    </p>
                    <div className="mt-2 flex items-center gap-2 max-md:flex-wrap">
                      <label className="flex items-center gap-1 text-xs text-slate">
                        ₹
                        <input
                          className="input h-8 w-24 text-sm"
                          type="number"
                          min={0}
                          step="any"
                          value={prices[r.id ?? ""] ?? ""}
                          placeholder="0"
                          onChange={(e) => setPrices((p) => ({ ...p, [r.id ?? ""]: e.target.value }))}
                        />
                      </label>
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={busy}
                        onClick={() => approve(issue, r)}
                      >
                        Approve
                      </button>
                      <button
                        className="btn btn-ghost btn-sm text-danger"
                        disabled={busy}
                        onClick={() => onReject({ issue, req: r })}
                      >
                        Reject
                      </button>
                      {(() => {
                        const pv = Math.max(0, Number(prices[r.id ?? ""] ?? "") || 0);
                        return pv > 0 ? (
                          <span className="text-xs font-medium text-graphite">
                            = {inr(pv * (r.qty || 1))}
                          </span>
                        ) : null;
                      })()}
                    </div>
                  </li>
                )
              )}
            </ul>

            {pending.length > 0 && (
              <p className="mt-auto text-xs text-slate">
                {pending.length} item(s) awaiting approval in this job.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function YearSelect({
  id,
  value,
  onChange,
  currentYear,
}: {
  id: string;
  value: number;
  onChange: (year: number) => void;
  currentYear: number;
}) {
  const years = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];
  return (
    <select id={id} className="input w-auto" value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {years.map((y) => (
        <option key={y} value={y}>
          {y}
        </option>
      ))}
    </select>
  );
}

function AnalyticsContent({ data }: { data: AnalyticsResponse["analytics"] }) {
  const catData = data.byCategory;
  const deptData = data.byDepartment;
  const kpis = [
    { label: "Total spend", value: inr(data.total), tone: "text-ink" },
    { label: "Purchases", value: data.count, tone: "text-ink" },
    { label: "Avg per purchase", value: inr(data.avg), tone: "text-ink" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className="kpi">
            <p className="text-xs font-medium uppercase tracking-wide text-slate">{k.label}</p>
            <p className={`mt-2 truncate font-display text-2xl max-md:text-xl font-semibold ${k.tone}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <p className="font-medium text-graphite">Monthly spend</p>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.byMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e6e2d8" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#a8a29e" />
              <YAxis tick={{ fontSize: 11 }} stroke="#a8a29e" />
              <Tooltip />
              <Bar dataKey="total" name="Spend" fill="#d97757" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
        <div className="card">
          <p className="font-medium text-graphite">By category</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={catData} dataKey="total" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                  {catData.map((_, i) => (
                    <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <p className="font-medium text-graphite">By department</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6e2d8" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#a8a29e" />
                <YAxis tick={{ fontSize: 11 }} stroke="#a8a29e" />
                <Tooltip />
                <Bar dataKey="total" name="Spend" radius={[6, 6, 0, 0]}>
                  {deptData.map((_, i) => (
                    <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
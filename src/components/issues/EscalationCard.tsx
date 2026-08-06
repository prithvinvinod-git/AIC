"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import type { Issue } from "@/lib/types";
import { api, ApiError } from "@/lib/clientApi";
import { StatusBadge, PriorityBadge } from "@/components/ui/Badge";

export function EscalationCard({
  issue,
  onAction,
  approveLabel = "Approve & route to head",
}: {
  issue: Issue;
  onAction: () => void;
  approveLabel?: string;
}) {
  const router = useRouter();
  const [priority, setPriority] = useState(String(issue.priority || 1));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approve = async () => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/issues/${issue.id}/approve`, {
        method: "POST",
        body: JSON.stringify({
          priority: Number(priority) === issue.priority ? undefined : Number(priority),
          note: "Approved for execution.",
        }),
      });
      onAction();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Approval failed.");
      setBusy(false);
    }
  };

  return (
    <div className="card">
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
          <div className="flex shrink-0 items-center gap-2">
            <PriorityBadge priority={issue.priority} />
            <StatusBadge status={issue.status} />
          </div>
        </div>
        <p className="line-clamp-2 text-sm text-slate">{issue.description}</p>
        <div className="flex flex-wrap gap-2 text-xs text-slate">
          <span className="tag tag-outline">{issue.routing?.categoryName}</span>
          <span className="tag tag-outline">{issue.location.name}</span>
          <span className="tag tag-outline">{issue.department}</span>
        </div>
      </button>

      <div className="mt-4 flex flex-col gap-3 border-t border-silver pt-4 sm:flex-row sm:items-end">
        <div>
          <label className="label" htmlFor={`rev-${issue.id}`}>
            Severity revision
          </label>
          <select
            id={`rev-${issue.id}`}
            className="input w-auto"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            {[1, 2, 3, 4, 5].map((p) => (
              <option key={p} value={p}>
                P{p}
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => void approve()}>
          <ShieldCheck className="h-4 w-4" aria-hidden />
          {busy ? "Approving…" : approveLabel}
        </button>
        {error && <p className="text-sm text-[#c0392b]">{error}</p>}
      </div>
    </div>
  );
}

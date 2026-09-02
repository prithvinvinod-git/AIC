"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { Issue } from "@/lib/types";
import { api } from "@/lib/clientApi";
import { StatusBadge, PriorityBadge } from "@/components/ui/Badge";
import { IssuePhotos } from "@/components/ui/IssuePhotos";
import { useActionError } from "@/components/ui/Toast";

export function RouteToHeadCard({
  issue,
  onRefresh,
  pending = false,
}: {
  issue: Issue;
  onRefresh: () => void;
  pending?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const { showError, errorEl } = useActionError();

  const forward = useCallback(async () => {
    setBusy(true);
    try {
      await api(`/api/issues/${issue.id}/forward`, {
        method: "POST",
        body: JSON.stringify({ to: pending ? "PENDING_ASSIGN" : "ROUTED" }),
      });
      onRefresh();
    } catch (e) {
      showError(e);
      setBusy(false);
    }
  }, [issue.id, pending, onRefresh, showError]);

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
        </div>
      </button>

      {issue.images.length > 0 && <IssuePhotos images={issue.images} />}

      <div className="mt-4 flex flex-col gap-2 border-t border-silver pt-4">
        <button className="btn btn-primary btn-sm self-start" disabled={busy} onClick={() => void forward()}>
          {busy ? "Sending…" : pending ? "Send back to category head" : "Route to maintenance head"}
        </button>
        {pending && (
          <p className="text-xs text-slate">
            The category head will pick a team and assign workers. Or{" "}
            <button className="link-blue" onClick={() => router.push(`/issues/${issue.id}`)}>
              assign directly
            </button>{" "}
            from the issue.
          </p>
        )}
        {errorEl}
      </div>
    </div>
  );
}

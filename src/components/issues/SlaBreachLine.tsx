"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import type { Issue } from "@/lib/types";
import { api } from "@/lib/clientApi";
import { slaBreachReason } from "@/lib/format";
import { useAuth } from "@/components/auth/AuthProvider";

const ALLOWED = ["validator", "hod", "principal", "admin"];
const inflight = new Set<string>();

/** F8 — one-liner explaining an SLA breach. Shows the persisted AI/rules
 *  explanation when present, else a client-side deterministic reason. When
 *  the viewer has permission, fire-and-forget generation enriches the copy
 *  so HODs stop asking "why is this late?". */
export function SlaBreachLine({ issue }: { issue: Issue }) {
  const { claims } = useAuth();
  const breached = issue.sla?.breachedFlags?.resolution || issue.sla?.breachedFlags?.response;
  const reason = issue.sla?.explanation || slaBreachReason(issue);

  useEffect(() => {
    if (!breached || issue.sla?.explanation || !issue.id || !claims || !ALLOWED.includes(claims.role)) return;
    if (inflight.has(issue.id)) return;
    inflight.add(issue.id);
    api("/api/ai/sla-explain", {
      method: "POST",
      body: JSON.stringify({ issueId: issue.id }),
    }).catch(() => {
      /* best-effort enrichment */
    });
  }, [breached, issue, claims]);

  if (!breached || !reason) return null;
  return (
    <p className="flex items-start gap-1.5 rounded-lg bg-danger-soft px-2.5 py-1.5 text-xs font-medium text-danger">
      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      {reason}
    </p>
  );
}
"use client";

import Link from "next/link";
import { useEffect } from "react";
import { CheckCheck } from "lucide-react";
import { useIssues } from "@/hooks/useIssues";
import { useAuth } from "@/components/auth/AuthProvider";
import { Loading, EmptyState, BoardErrorState } from "@/components/ui/States";
import { EscalationCard } from "@/components/issues/EscalationCard";
import { IssueCard } from "@/components/ui/IssueCard";

export default function PrincipalPage() {
  const { claims } = useAuth();
  const { issues: escalated, error: escalatedError, reload: reloadEscalated } = useIssues({ status: "ESCALATED" });
  const { issues: approved, error: approvedError, reload: reloadApproved } = useIssues({ status: "APPROVED" });

  useEffect(() => {
    const onFocus = () => {
      void reloadEscalated();
      void reloadApproved();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [reloadEscalated, reloadApproved]);

  if (!claims) return null;
  if (!escalated || !approved) return <Loading label="Loading approvals…" />;

  const refreshAll = () => {
    void reloadEscalated();
    void reloadApproved();
  };

  return (
    <div className="flex flex-col gap-8 max-md:gap-5">
      <div>
        <h1 className="font-display text-2xl max-md:text-xl font-semibold text-ink">Principal approvals</h1>
        <p className="mt-1 text-sm text-slate">Approve critical escalations and track approved work.</p>
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg max-md:text-base font-semibold text-ink">Awaiting your approval</h2>
          <Link href="/analytics" className="link-blue text-sm">
            Open analytics
          </Link>
        </div>
        {escalatedError ? (
          <BoardErrorState message={escalatedError} onRetry={() => void reloadEscalated()} />
        ) : escalated.length === 0 ? (
          <EmptyState
            icon={<CheckCheck className="h-8 w-8" aria-hidden />}
            title="Approval queue is clear"
            body="Critical issues will appear here once escalated by department validators."
          />
        ) : (
          escalated.map((issue) => (
            <EscalationCard key={issue.id} issue={issue} onAction={refreshAll} />
          ))
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-lg max-md:text-base font-semibold text-ink">Approved & in progress</h2>
        {approvedError ? (
          <BoardErrorState message={approvedError} onRetry={() => void reloadApproved()} />
        ) : approved.length === 0 ? (
          <EmptyState title="Nothing approved yet" body="Approved issues awaiting the department validator will appear here." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-3">
            {approved.map((issue) => (
              <IssueCard key={issue.id} issue={issue} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

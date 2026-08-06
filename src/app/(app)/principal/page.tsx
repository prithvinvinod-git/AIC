"use client";

import Link from "next/link";
import { CheckCheck } from "lucide-react";
import { useIssues } from "@/hooks/useIssues";
import { useAuth } from "@/components/auth/AuthProvider";
import { Loading, EmptyState } from "@/components/ui/States";
import { EscalationCard } from "@/components/issues/EscalationCard";
import { IssueCard } from "@/components/ui/IssueCard";

export default function PrincipalPage() {
  const { claims } = useAuth();
  const { issues: escalated, reload } = useIssues({ status: "ESCALATED" });
  const { issues: approved } = useIssues({ status: "APPROVED" });

  if (!claims) return null;
  if (!escalated || !approved) return <Loading label="Loading approvals…" />;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Principal approvals</h1>
        <p className="mt-1 text-sm text-slate">Approve critical escalations and track approved work.</p>
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">Awaiting your approval</h2>
          <Link href="/analytics" className="link-blue text-sm">
            Open analytics
          </Link>
        </div>
        {escalated.length === 0 ? (
          <EmptyState
            icon={<CheckCheck className="h-8 w-8" aria-hidden />}
            title="Approval queue is clear"
            body="Critical issues will appear here once escalated by department validators."
          />
        ) : (
          escalated.map((issue) => (
            <EscalationCard key={issue.id} issue={issue} onAction={() => void reload()} />
          ))
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-lg font-semibold text-ink">Approved & in progress</h2>
        {approved.length === 0 ? (
          <EmptyState title="Nothing approved yet" body="Approved issues awaiting the maintenance head will appear here." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {approved.map((issue) => (
              <IssueCard key={issue.id} issue={issue} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

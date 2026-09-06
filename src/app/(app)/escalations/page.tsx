"use client";

import { BarChart3, Banknote } from "lucide-react";
import { useIssues } from "@/hooks/useIssues";
import { useAuth } from "@/components/auth/AuthProvider";
import { Loading, EmptyState, BoardErrorState } from "@/components/ui/States";
import { EscalationCard } from "@/components/issues/EscalationCard";
import { SeniorPurchaseApprovalCard } from "@/components/purchases/SeniorPurchaseApprovalCard";
import { WeeklyInsightsCard } from "@/components/ai/WeeklyInsightsCard";

export default function HodPage() {
  const { claims } = useAuth();
  const { issues, error, reload } = useIssues({ status: "ESCALATED" });
  const { issues: purchases, error: purchaseError, reload: reloadPurchases } = useIssues({ pendingSenior: true });

  if (!claims) return null;
  if (!issues || !purchases) return <Loading label="Loading escalations…" />;

  const refreshAll = () => {
    void reload();
    void reloadPurchases();
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl max-md:text-xl font-semibold text-ink">Escalations</h1>
        <p className="mt-1 text-sm text-slate">
          {claims.name} · Critical issues awaiting your approval before execution.
        </p>
      </div>

      <WeeklyInsightsCard />

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-display text-lg max-md:text-base font-semibold text-ink">Over-limit purchase approvals</h2>
          <p className="mt-1 text-xs text-slate">Purchases above the configured limit awaiting your sign-off.</p>
        </div>
        {purchaseError ? (
          <BoardErrorState message={purchaseError} onRetry={() => void reloadPurchases()} />
        ) : purchases.length === 0 ? (
          <EmptyState
            icon={<Banknote className="h-8 w-8" aria-hidden />}
            title="No over-limit purchases pending"
            body="When the purchase team submits an amount above the limit, it will appear here for approval."
          />
        ) : (
          purchases.map((issue) => (
            <SeniorPurchaseApprovalCard key={issue.id} issue={issue} onAction={refreshAll} />
          ))
        )}
      </section>

      {error ? (
        <BoardErrorState message={error} onRetry={() => void reload()} />
      ) : issues.length === 0 ? (
        <EmptyState
          icon={<BarChart3 className="h-8 w-8" aria-hidden />}
          title="No escalations pending"
          body="Approved critical issues will flow here from department validation."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {issues.map((issue) => (
            <EscalationCard
              key={issue.id}
              issue={issue}
              onAction={() => void reload()}
            />
          ))}
        </div>
      )}
    </div>
  );
}
"use client";

import { useIssues } from "@/hooks/useIssues";
import { useAuth } from "@/components/auth/AuthProvider";
import { Loading, EmptyState } from "@/components/ui/States";
import { AssignCard, VerifyCard } from "@/components/issues/HeadCards";
import { MaintenanceJobCard } from "@/components/issues/MaintenanceJobCard";
import { RootCauseAnalysisCard } from "@/components/ai/RootCauseAnalysisCard";

export default function HeadPage() {
  const { issues, reload } = useIssues({});
  const { claims } = useAuth();
  const isHead = claims?.role === "head";

  if (!issues) return <Loading label="Loading job board…" />;

  const active = issues.filter((i) => ["ASSIGNED", "ONGOING"].includes(i.status));
  const assignQueue = issues.filter((i) => ["APPROVED", "ESCALATED"].includes(i.status));
  const verifyQueue = issues.filter((i) => i.status === "COMPLETED");
  const blocked = issues.filter((i) => i.status === "PENDING");

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Maintenance head board</h1>
        <p className="mt-1 text-sm text-slate">
          Route approved work, keep the SLA board honest, and verify completed jobs.
        </p>
      </div>

      <RootCauseAnalysisCard />

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-lg font-semibold text-ink">
          Active jobs <span className="text-sm font-normal text-slate">({active.length})</span>
        </h2>
        {active.length === 0 ? (
          <EmptyState title="No active jobs" body="Assigned jobs being worked on will appear here." />
        ) : (
          <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((issue) => (
              <MaintenanceJobCard key={issue.id} issue={issue} onRefresh={() => void reload()} readOnly />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-lg font-semibold text-ink">
          Assign queue <span className="text-sm font-normal text-slate">({assignQueue.length})</span>
        </h2>
        {assignQueue.length === 0 ? (
          <EmptyState title="Nothing to assign" body="Approved and escalated issues will land here." />
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-2">
            {assignQueue.map((issue) =>
              isHead ? (
                <AssignCard key={issue.id} issue={issue} onRefresh={() => void reload()} />
              ) : (
                <MaintenanceJobCard key={issue.id} issue={issue} onRefresh={() => void reload()} readOnly />
              )
            )}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-lg font-semibold text-ink">
          Verify queue <span className="text-sm font-normal text-slate">({verifyQueue.length})</span>
        </h2>
        {verifyQueue.length === 0 ? (
          <EmptyState title="Nothing to verify" body="Completed jobs awaiting your verification will appear here." />
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-2">
            {verifyQueue.map((issue) =>
              isHead ? (
                <VerifyCard key={issue.id} issue={issue} onRefresh={() => void reload()} />
              ) : (
                <MaintenanceJobCard key={issue.id} issue={issue} onRefresh={() => void reload()} readOnly />
              )
            )}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-lg font-semibold text-ink">
          Blocked <span className="text-sm font-normal text-slate">({blocked.length})</span>
        </h2>
        {blocked.length === 0 ? (
          <EmptyState title="No blocked jobs" body="Jobs awaiting parts or permissions will appear here." />
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-2">
            {blocked.map((issue) =>
              isHead ? (
                <AssignCard key={issue.id} issue={issue} onRefresh={() => void reload()} />
              ) : (
                <MaintenanceJobCard key={issue.id} issue={issue} onRefresh={() => void reload()} readOnly />
              )
            )}
          </div>
        )}
      </section>
    </div>
  );
}

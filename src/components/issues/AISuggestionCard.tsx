"use client";

import { useCallback, useState } from "react";
import { Sparkles } from "lucide-react";
import type { Issue } from "@/lib/types";
import { api } from "@/lib/clientApi";
import { useActionError } from "@/components/ui/Toast";

export function AISuggestionCard({ issue, onTriaged }: { issue: Issue; onTriaged?: () => void }) {
  const [running, setRunning] = useState(false);
  const { showError, errorEl } = useActionError();
  const suggestion = issue.aiSuggestion;

  const runTriage = useCallback(async () => {
    setRunning(true);
    try {
      await api(`/api/ai/triage`, { method: "POST", body: JSON.stringify({ issueId: issue.id }) });
      onTriaged?.();
    } catch (e) {
      showError(e);
      setRunning(false);
    }
  }, [issue.id, onTriaged, showError]);

  if (!suggestion || (!suggestion.category && suggestion.aiProcessed)) {
    return (
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-10 w-10 text-accent lg:h-16 lg:w-16" aria-hidden />
            <p className="font-medium text-graphite">AI triage</p>
          </div>
          <button onClick={() => void runTriage()} disabled={running} className="btn btn-ghost btn-sm">
            {running ? "Running…" : "Run triage"}
          </button>
        </div>
        {errorEl}
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center gap-2">
        <Sparkles className="h-10 w-10 text-accent lg:h-16 lg:w-16" aria-hidden />
        <p className="font-medium text-graphite">AI suggestion</p>
      </div>

      {suggestion.isSpam && (
        <div className="mt-3 rounded-lg bg-danger-soft px-3 py-2.5 text-sm text-danger">
          <p className="font-medium">Likely spam</p>
          {suggestion.spamReasons && suggestion.spamReasons.length > 0 && (
            <p className="mt-0.5 text-xs opacity-90">{suggestion.spamReasons.join(" · ")}</p>
          )}
        </div>
      )}

      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        {suggestion.category && (
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate">Category</dt>
            <dd className="mt-0.5 font-medium text-graphite">{suggestion.category}</dd>
          </div>
        )}
        {suggestion.suggestedPriority && (
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate">Suggested priority</dt>
            <dd className="mt-0.5 font-medium text-graphite">P{suggestion.suggestedPriority}</dd>
          </div>
        )}
        {suggestion.photoSummary && (
          <div className="col-span-2">
            <dt className="text-xs uppercase tracking-wide text-slate">Photo summary</dt>
            <dd className="mt-0.5 text-slate">{suggestion.photoSummary}</dd>
          </div>
        )}
        {suggestion.duplicateOf && (
          <div className="col-span-2">
            <dt className="text-xs uppercase tracking-wide text-slate">Possible duplicate</dt>
            <dd className="mt-0.5 font-medium text-warning">
              Matches {suggestion.duplicateIssueNo || suggestion.duplicateOf} ({(suggestion.matchScore ?? 0) * 100}%)
            </dd>
          </div>
        )}
      </dl>

      {suggestion.safetyFlags && suggestion.safetyFlags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestion.safetyFlags.map((f) => (
            <span key={f} className="tag bg-danger-soft text-danger">
              {f}
            </span>
          ))}
        </div>
      )}

      {suggestion.reasons && suggestion.reasons.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1 border-t border-silver pt-3 text-sm text-slate">
          {suggestion.reasons.map((r, i) => (
            <li key={i}>• {r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

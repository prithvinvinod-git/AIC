"use client";

import { useCallback, useState } from "react";
import { Sparkles } from "lucide-react";
import type { Issue } from "@/lib/types";
import { api, ApiError } from "@/lib/clientApi";

export function AISuggestionCard({ issue }: { issue: Issue }) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const suggestion = issue.aiSuggestion;

  const runTriage = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      await api(`/api/ai/triage`, { method: "POST", body: JSON.stringify({ issueId: issue.id }) });
      window.location.reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Triage failed.");
      setRunning(false);
    }
  }, [issue.id]);

  if (!suggestion || (!suggestion.category && suggestion.aiProcessed)) {
    return (
      <div className="card">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-16 w-16 text-action-blue" aria-hidden />
            <p className="font-medium text-graphite">AI triage</p>
          </div>
          <button onClick={() => void runTriage()} disabled={running} className="btn btn-ghost btn-sm">
            {running ? "Running…" : "Run triage"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-[#c0392b]">{error}</p>}
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center gap-2">
        <Sparkles className="h-16 w-16 text-action-blue" aria-hidden />
        <p className="font-medium text-graphite">AI suggestion</p>
      </div>

      {suggestion.isSpam && (
        <div className="mt-3 rounded-lg bg-[#fef2f2] px-3 py-2.5 text-sm text-[#be123c]">
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
            <dd className="mt-0.5 font-medium text-[#d97706]">
              Matches {suggestion.duplicateIssueNo || suggestion.duplicateOf} ({(suggestion.matchScore ?? 0) * 100}%)
            </dd>
          </div>
        )}
      </dl>

      {suggestion.safetyFlags && suggestion.safetyFlags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestion.safetyFlags.map((f) => (
            <span key={f} className="tag bg-[#fef2f2] text-[#c0392b]">
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

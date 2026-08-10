import { useState } from "react";
import { api } from "@/lib/clientApi";
import type { RootCauseResult } from "@/lib/ai/rootCause";

export function RootCauseAnalysisCard() {
  const [result, setResult] = useState<RootCauseResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ result: RootCauseResult }>("/api/ai/root-cause");
      setResult(res.result);
    } catch {
      setError("Failed to analyze issues. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-lg font-semibold text-ink">AI Root-Cause Analysis</h3>
        <button
          onClick={analyze}
          disabled={busy}
          className="btn btn-primary btn-sm"
        >
          {busy ? "Analyzing..." : "Analyze patterns"}
        </button>
      </div>
      
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      
      {result && (
        <div className="mt-3 space-y-2">
          <div className="rounded-lg bg-paper p-3">
            <h4 className="font-medium text-graphite">POSSIBLE ROOT CAUSE</h4>
            <p className="mt-1 text-sm text-slate">{result.summary}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-paper p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate">Likely area</p>
              <p className="mt-1 text-sm text-graphite">{result.likelyArea}</p>
            </div>
            <div className="rounded-lg bg-paper p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate">Confidence</p>
              <p className="mt-1 text-sm text-graphite">{result.confidence}</p>
            </div>
          </div>
          
          <div className="rounded-lg bg-paper p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate">Recommended</p>
            <p className="mt-1 text-sm text-slate">{result.recommendation}</p>
          </div>
        </div>
      )}
      
      {!result && !busy && (
        <p className="mt-3 text-sm text-slate">Click &quot;Analyze patterns&quot; to identify possible root causes from recent issues.</p>
      )}
    </div>
  );
}
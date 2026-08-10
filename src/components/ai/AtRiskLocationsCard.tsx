import { useState } from "react";
import { api } from "@/lib/clientApi";
import type { PredictiveResult } from "@/lib/ai/predictive";

export function AtRiskLocationsCard() {
  const [result, setResult] = useState<PredictiveResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ result: PredictiveResult }>("/api/ai/at-risk");
      setResult(res.result);
    } catch {
      setError("Failed to analyze locations. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-lg font-semibold text-ink">AI At-Risk Locations</h3>
        <button
          onClick={load}
          disabled={busy}
          className="btn btn-primary btn-sm"
        >
          {busy ? "Analyzing..." : "Check locations"}
        </button>
      </div>
      
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      
      {result && result.locations.length > 0 ? (
        <div className="mt-3 space-y-2">
          <div className="text-sm text-slate">
            {result.locations.map((loc, i) => {
              const riskTone =
                loc.risk === "High"
                  ? "bg-danger-soft text-danger"
                  : loc.risk === "Medium"
                    ? "bg-warning-soft text-warning"
                    : "bg-success-soft text-success";
              return (
                <div key={i} className="flex items-start gap-3 py-2 border-b border-silver last:border-0">
                  <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${riskTone}`}>
                    {loc.risk}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-graphite">{loc.location}</p>
                    <p className="text-xs text-slate">
                      {loc.category} • {loc.count} issue{loc.count === 1 ? "" : "s"}
                    </p>
                    <p className="text-xs text-slate mt-1">{loc.pattern}</p>
                    <p className="text-xs text-slate mt-1">
                      <span className="font-medium text-graphite">Recommendation:</span> {loc.recommendation}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : result && result.locations.length === 0 ? (
        <p className="mt-3 text-sm text-slate">No at-risk locations identified.</p>
      ) : !result && !busy ? (
        <p className="mt-3 text-sm text-slate">Click &quot;Check locations&quot; to identify areas at risk for future issues.</p>
      ) : null}
    </div>
  );
}
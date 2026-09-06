"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import { IndianRupee } from "lucide-react";
import { api } from "@/lib/clientApi";
import { useActionError } from "@/components/ui/Toast";
import { Loading } from "@/components/ui/States";

/** Editable ₹ purchase approval limit — shown to admin and the Principal.
 *  Values above it route to the senior approval queue. */
export function PurchaseLimitCard() {
  const [limit, setLimit] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const { showError } = useActionError();

  const load = useCallback(async () => {
    try {
      const res = await api<{ purchaseApprovalLimit: number }>("/api/config/purchase-limit");
      setLimit(String(res.purchaseApprovalLimit));
    } catch (e) {
      showError(e);
      setLimit("");
    }
  }, [showError]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSaved(false);
      const value = Number(limit);
      if (!Number.isFinite(value) || value < 0) {
        showError("Enter a valid non-negative amount.");
        return;
      }
      try {
        await api("/api/config/purchase-limit", {
          method: "PATCH",
          body: JSON.stringify({ purchaseApprovalLimit: value }),
        });
        setSaved(true);
      } catch (e2) {
        showError(e2);
      }
    },
    [limit, showError]
  );

  if (limit === null) return <Loading label="Loading purchase limit…" />;

  return (
    <form onSubmit={save} className="card flex max-w-md flex-col gap-3">
      <div>
        <p className="font-medium text-graphite">Purchase approval limit</p>
        <p className="mt-1 text-xs text-slate">
          Purchases above this amount require senior (HOD/Principal) approval instead of being approved directly.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <IndianRupee className="h-4 w-4 shrink-0 text-slate" aria-hidden />
        <input
          className="input"
          type="number"
          min={0}
          step="any"
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          aria-label="Purchase approval limit in rupees"
        />
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary btn-sm">
          Save limit
        </button>
        {saved && <span className="text-xs text-success">Limit saved.</span>}
      </div>
    </form>
  );
}
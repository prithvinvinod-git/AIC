"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Issue } from "@/lib/types";
import { api, ApiError } from "@/lib/clientApi";
import { onCacheChange } from "@/lib/offlineStore";

export function useIssues(params: { status?: string; mine?: boolean; pendingSenior?: boolean } = {}) {
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const path = useMemo(() => {
    const qs = new URLSearchParams();
    if (params.status && params.status !== "all") qs.set("status", params.status);
    if (params.mine) qs.set("mine", "true");
    if (params.pendingSenior) qs.set("pendingSenior", "true");
    return `/api/issues?${qs.toString()}`;
  }, [params.status, params.mine, params.pendingSenior]);

  const reload = useCallback(async () => {
    try {
      const res = await api<{ issues: Issue[] }>(path);
      setIssues(res.issues);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load issues.");
      setIssues([]);
    }
  }, [path]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Re-query when the cache entry for this list (or any issue list) changes —
  // e.g. after a background revalidate or an offline write is synced.
  useEffect(() => {
    return onCacheChange((changed) => {
      if (changed === path || changed === "/api/issues") void reload();
    });
  }, [path, reload]);

  return { issues, error, reload };
}
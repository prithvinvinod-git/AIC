"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import type { Issue } from "@/lib/types";
import { api, ApiError } from "@/lib/clientApi";

export function useIssues(params: { status?: string; mine?: boolean } = {}) {
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const qs = new URLSearchParams();
    if (params.status && params.status !== "all") qs.set("status", params.status);
    if (params.mine) qs.set("mine", "true");
    try {
      const res = await api<{ issues: Issue[] }>(`/api/issues?${qs.toString()}`);
      setIssues(res.issues);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load issues.");
      setIssues([]);
    }
  }, [params.status, params.mine]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { issues, error, reload };
}

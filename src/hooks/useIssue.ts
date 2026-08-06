"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import type { Comment, Issue, TimelineEntry } from "@/lib/types";
import { api } from "@/lib/clientApi";

export interface IssueDetail {
  issue: Issue;
  timeline: TimelineEntry[];
  comments: Comment[];
  attachments: { id: string; url: string; name: string; at: string }[];
}

export function useIssue(id: string) {
  const [data, setData] = useState<IssueDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await api<IssueDetail>(`/api/issues/${id}`);
      setData(res);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load issue.");
      setData(null);
    }
  }, [id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...data, error, reload };
}

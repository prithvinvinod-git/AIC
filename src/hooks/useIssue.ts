"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import type { Comment, Issue, TimelineEntry } from "@/lib/types";
import { api } from "@/lib/clientApi";
import { onCacheChange } from "@/lib/offlineStore";

export interface IssueDetail {
  issue: Issue;
  timeline: TimelineEntry[];
  comments: Comment[];
  attachments: { id: string; url: string; name: string; at: string }[];
}

export function useIssue(id: string) {
  const [data, setData] = useState<IssueDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pollTries, setPollTries] = useState(0);
  const [hidden, setHidden] = useState(false);

  const path = `/api/issues/${id}`;

  const reload = useCallback(
    async (force?: boolean) => {
      try {
        const res = await api<IssueDetail>(path, {}, { force: force === true });
        setData(res);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load issue.");
        setData(null);
      }
    },
    [path]
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  // Refresh when the store entry for this issue is replaced (background
  // revalidate, sync of an offline write) so the detail stays live.
  useEffect(() => {
    return onCacheChange((changed) => {
      if (changed === path || changed === "/api/issues") void reload();
    });
  }, [path, reload]);

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // The AI triage pipeline runs after submission; poll a few times so the
  // suggestion shows up on its own instead of requiring a manual refresh.
  // Pauses when the tab is hidden and stops once the issue is in a terminal
  // state or AI has finished. Polls bypass the read-through cache for fresh data.
  useEffect(() => {
    if (!data?.issue) return;
    if (hidden) return;
    if (["CLOSED", "VERIFIED", "REJECTED"].includes(data.issue.status)) return;
    if (data.issue.aiSuggestion?.aiProcessed) return;
    if (pollTries >= 8) return;
    const t = setTimeout(() => {
      setPollTries((n) => n + 1);
      void reload(true);
    }, 3500);
    return () => clearTimeout(t);
  }, [data, reload, pollTries, hidden]);

  return { ...data, error, reload };
}
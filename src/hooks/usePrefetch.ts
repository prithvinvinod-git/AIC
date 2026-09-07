"use client";

import { useEffect, useRef } from "react";
import { api } from "@/lib/clientApi";
import { isCacheFresh } from "@/lib/offlineStore";

/**
 * Warm the offline cache for the given GET paths, but only when the entry is
 * stale or missing and the device is online. Runs once on mount and again each
 * time connectivity returns (so a reconnect repopulates lists that went cold).
 * Everything is best-effort — failures are swallowed silently.
 */
export function usePrefetch(paths: string[] | null) {
  const attemptsRef = useRef(0);

  useEffect(() => {
    if (!paths || paths.length === 0) return;
    const run = async () => {
      if (!navigator.onLine) return;
      for (const p of paths) {
        try {
          const fresh = await isCacheFresh(p);
          if (fresh) continue;
          await api(p);
        } catch {
          // Not the end of the world — will retry on next online event/visit.
        }
      }
    };
    attemptsRef.current += 1;
    void run();
  }, [paths]);
}

/** Imperative variant for event handlers (reconnect, manual refresh). */
export async function prefetchIfStale(path: string): Promise<void> {
  if (!navigator.onLine) return;
  try {
    if (!(await isCacheFresh(path))) await api(path);
  } catch {
    // best-effort
  }
}
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useToast } from "@/components/ui/Toast";
import { flushPendingWrites } from "@/lib/clientApi";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { onCacheChange, pendingWriteCount } from "@/lib/offlineStore";

interface OfflineContextValue {
  online: boolean;
  pendingCount: number;
  /** Replay queued writes now (e.g. after the user acts on the banner). */
  flushNow: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextValue | null>(null);

/**
 * Global offline orchestration:
 *   - watches connectivity + the pending-write queue,
 *   - replays queued writes on reconnect / focus / visibilitychange (and a
 *     periodic nudge while the queue is non-empty).
 * The app-shell service worker itself is registered by ServiceWorkerRegistrar.
 */
export function OfflineModeProvider({ children }: { children: ReactNode }) {
  const online = useOnlineStatus();
  const { show, showError } = useToast();
  const [pendingCount, setPendingCount] = useState(0);
  const wasOfflineRef = useRef(false);
  const flushingRef = useRef(false);

  const refreshCount = useCallback(async () => {
    try {
      setPendingCount(await pendingWriteCount());
    } catch {
      // IndexedDB unavailable — 0 is fine.
    }
  }, []);

  useEffect(() => {
    // Defer the initial read so the effect body doesn't call setState
    // synchronously (avoids a cascading render at mount).
    const t = setTimeout(() => void refreshCount(), 0);
    return () => clearTimeout(t);
  }, [refreshCount]);

  useEffect(() => {
    const unsub = onCacheChange((path) => {
      if (path === "@writes") void refreshCount();
    });
    return unsub;
  }, [refreshCount]);

  const flushNow = useCallback(async () => {
    if (flushingRef.current) return;
    flushingRef.current = true;
    try {
      const { sent, dropped } = await flushPendingWrites();
      await refreshCount();
      if (sent > 0) {
        show({
          title: sent === 1 ? "Change synced" : `${sent} changes synced`,
          message: "Your offline actions were sent to the server.",
          type: "success",
        });
      }
      if (dropped > 0) {
        showError(new Error(`${dropped} change(s) were rejected by the server.`), {
          title: "Some changes weren't synced",
          type: "warning",
        });
      }
    } catch {
      // Queue still has items; next flush attempt (focus/online) retries.
    } finally {
      flushingRef.current = false;
    }
  }, [refreshCount, show, showError]);

  // Reconnect: transition offline → online triggers a flush.
  useEffect(() => {
    if (online) {
      if (wasOfflineRef.current) void flushNow();
      wasOfflineRef.current = false;
    } else {
      wasOfflineRef.current = true;
    }
  }, [online, flushNow]);

  // Focus + visibility: coming back to the tab is a good reconnection signal.
  useEffect(() => {
    const onFocus = () => {
      if (online) void flushNow();
    };
    const onVis = () => {
      if (!document.hidden && online) void flushNow();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [online, flushNow]);

  // Periodic nudge while the queue isn't empty (60s) in case events were missed.
  useEffect(() => {
    if (pendingCount === 0) return;
    const t = setInterval(() => {
      if (online) void flushNow();
    }, 60_000);
    return () => clearInterval(t);
  }, [pendingCount, online, flushNow]);

  const value: OfflineContextValue = { online, pendingCount, flushNow };

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOffline(): OfflineContextValue {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error("useOffline must be used within OfflineModeProvider");
  return ctx;
}
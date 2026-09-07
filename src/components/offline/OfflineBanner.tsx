"use client";

import { RefreshCw, WifiOff } from "lucide-react";
import { useOffline } from "./OfflineModeProvider";

/**
 * Slim global pill signaling the device is offline (cached data being shown)
 * or that queued changes are being synced back.
 */
export default function OfflineBanner() {
  const { online, pendingCount, flushNow } = useOffline();

  const offline = !online;

  if (offline) {
    return (
      <div className="pointer-events-auto fixed bottom-4 left-1/2 z-40 -translate-x-1/2">
        <div className="flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-paper shadow-card">
          <WifiOff className="h-4 w-4 shrink-0 text-accent" />
          <span className="text-sm font-medium">Offline — showing saved data</span>
        </div>
      </div>
    );
  }

  if (pendingCount === 0) return null;

  return (
    <button
      type="button"
      onClick={() => void flushNow()}
      className="pointer-events-auto fixed bottom-4 left-1/2 z-40 -translate-x-1/2"
      aria-label="Sync queued changes"
    >
      <div className="flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-paper shadow-card transition hover:bg-graphite">
        <RefreshCw className="h-4 w-4 shrink-0 animate-spin text-accent" />
        <span className="text-sm font-medium">
          {pendingCount === 1 ? "Syncing 1 change" : `Syncing ${pendingCount} changes`}
        </span>
      </div>
    </button>
  );
}
"use client";

import { useEffect, useState } from "react";

/**
 * Subscribes to the browser's online/offline events.
 *
 * The initial state is always `true` so the very first client render matches
 * the server HTML (which has no `navigator`); the real value is reconciled
 * right after mount. Otherwise a device that starts out offline would render
 * offline UI during hydration and desync the tree.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    // Snapshot the real connection state slightly after mount (deferred so the
    // effect body doesn't call setState synchronously); then subscribe.
    const settle = setTimeout(() => setOnline(navigator.onLine), 0);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      clearTimeout(settle);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return online;
}
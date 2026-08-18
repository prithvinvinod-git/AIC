"use client";

import { useEffect, useRef } from "react";
import { isPushSupported, requestFcmToken } from "@/lib/fcm";
import { api } from "@/lib/clientApi";

const DISMISSED_KEY = "push_prompt_dismissed";

function isPwa(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    !!(window.navigator as any).standalone
  );
}

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    localStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // noop
  }
}

/**
 * Fires the native OS notification permission prompt once on PWA login.
 * If the user grants, the FCM token is fetched and saved to the profile
 * automatically — no custom UI needed.
 */
export function useNativePushPrompt() {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    if (!isPwa() || !isPushSupported()) return;
    if (Notification.permission !== "default") return;
    if (wasDismissed()) return;

    fired.current = true;

    void (async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          const { token } = await requestFcmToken();
          if (token) {
            await api("/api/profile", {
              method: "PATCH",
              body: JSON.stringify({ fcmToken: token, pushEnabled: true }),
            }).catch(() => {});
          }
        } else {
          markDismissed();
        }
      } catch {
        markDismissed();
      }
    })();
  }, []);
}

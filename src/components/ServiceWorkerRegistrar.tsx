"use client";

import { useEffect } from "react";
import { registerServiceWorker, onForegroundMessage } from "@/lib/fcm";
import { useAuth } from "@/components/auth/AuthProvider";

/**
 * Registers the service worker once and subscribes to foreground FCM messages.
 * Foreground messages are forwarded as a window event so existing UI
 * (NotificationBell, Toast) can pick them up without tight coupling.
 */
export default function ServiceWorkerRegistrar() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    let unsub = () => {};

    void registerServiceWorker().then(() => {
      unsub = onForegroundMessage((payload) => {
        const title = payload.notification?.title || "Servox";
        const body  = payload.notification?.body  || "";
        const link  = payload.data?.link || "/dashboard";

        // Dispatch a custom event so the existing notification UI can handle it.
        window.dispatchEvent(
          new CustomEvent("fcm-message", {
            detail: { title, body, link, type: payload.data?.type || "issue" },
          })
        );
      });
    });

    return unsub;
  }, [user]);

  return null;
}

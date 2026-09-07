"use client";

import { useEffect } from "react";
import { registerServiceWorker, onForegroundMessage, isPushSupported, requestFcmToken } from "@/lib/fcm";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/clientApi";

/**
 * Registers the (single) service worker once at app load — even before login
 * so the app-shell offline cache is active — subscribes to foreground FCM
 * messages, and refreshes the FCM token on every login (tokens rotate).
 */
export default function ServiceWorkerRegistrar() {
  const { user } = useAuth();

  // Registration is auth-independent: the shell cache should work on the
  // login screen too. FCM config is injected by registerServiceWorker.
  useEffect(() => {
    let cancelled = false;
    let unsub = () => {};
    void registerServiceWorker().then(() => {
      if (cancelled) return;
      unsub = onForegroundMessage((payload) => {
        const title = payload.notification?.title || "Servox";
        const body  = payload.notification?.body  || "";
        const link  = payload.data?.link || "/dashboard";

        window.dispatchEvent(
          new CustomEvent("fcm-message", {
            detail: { title, body, link, type: payload.data?.type || "issue" },
          })
        );
      });
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  // Per-session: re-validate the FCM token on every login — tokens can rotate
  // after browser updates or Firebase auto-rotation.
  useEffect(() => {
    if (!user) return;
    if (!isPushSupported() || Notification.permission !== "granted") return;
    void requestFcmToken().then(({ token }) => {
      if (token) {
        void api("/api/profile", {
          method: "PATCH",
          body: JSON.stringify({ fcmToken: token, pushEnabled: true }),
        }).catch(() => {});
      }
    });
  }, [user]);

  return null;
}
"use client";

import { useEffect } from "react";
import { registerServiceWorker, onForegroundMessage, isPushSupported, requestFcmToken } from "@/lib/fcm";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/clientApi";

/**
 * Registers the service worker once, subscribes to foreground FCM messages,
 * and refreshes the FCM token on every login (tokens can rotate silently).
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

        window.dispatchEvent(
          new CustomEvent("fcm-message", {
            detail: { title, body, link, type: payload.data?.type || "issue" },
          })
        );
      });

      /* Re-validate FCM token on every session — tokens can rotate after
         browser updates or Firebase auto-rotation. If the new token differs
         from the stored one, re-save it so pushes keep arriving. */
      if (isPushSupported() && Notification.permission === "granted") {
        void requestFcmToken().then(({ token }) => {
          if (token) {
            void api("/api/profile", {
              method: "PATCH",
              body: JSON.stringify({ fcmToken: token, pushEnabled: true }),
            }).catch(() => {});
          }
        });
      }
    });

    return unsub;
  }, [user]);

  return null;
}

"use client";

import { getToken, onMessage, getMessaging, deleteToken, type MessagePayload } from "firebase/messaging";
import { getApp } from "@/lib/firebase";

let messagingInstance: ReturnType<typeof getMessaging> | null = null;

function getMessagingInstance() {
  if (messagingInstance) return messagingInstance;
  if (typeof window === "undefined") return null;
  try {
    messagingInstance = getMessaging(getApp());
    return messagingInstance;
  } catch {
    return null;
  }
}

/** Check if the browser supports notifications + service workers. */
export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
}

/** Current permission state. */
export function getPermissionState(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

/**
 * Register the service worker and inject the Firebase config it needs.
 * Returns a promise that resolves once the SW signals it is ready.
 */
let swRegistration: ServiceWorkerRegistration | null = null;

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  if (swRegistration) return swRegistration;

  const config = {
    apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  await navigator.serviceWorker.ready;

  // Wait for the SW to acknowledge config before returning.
  const ready = new Promise<void>((resolve) => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "SW_READY") {
        navigator.serviceWorker.removeEventListener("message", handler);
        resolve();
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    // Fallback: resolve after 3s if SW never acks (e.g. cached SW).
    setTimeout(resolve, 3000);
  });

  reg.active?.postMessage({ type: "SET_FIREBASE_CONFIG", config });
  await ready;

  swRegistration = reg;
  return reg;
}

/**
 * Request notification permission, get an FCM token, and return it.
 * Returns null on failure and sets `error` to a user-facing message.
 */
export async function requestFcmToken(): Promise<{ token: string | null; error: string | null }> {
  if (!isPushSupported()) return { token: null, error: "Push notifications are not supported on this device." };

  const messaging = getMessagingInstance();
  if (!messaging) return { token: null, error: "Could not initialize messaging." };

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) return { token: null, error: "Push notifications are not configured. Contact your admin." };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { token: null, error: "Permission denied. Enable notifications in your browser settings." };

  const reg = await registerServiceWorker();
  if (!reg) return { token: null, error: "Service worker failed to register." };

  try {
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: reg });
    return { token, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("messaging/unsupported-browser")) return { token: null, error: "Your browser doesn't support push notifications." };
    if (msg.includes("messaging/permission-blocked")) return { token: null, error: "Notifications are blocked. Enable them in browser settings." };
    if (msg.includes("messaging/failed-service-worker-registration")) return { token: null, error: "Service worker registration failed." };
    return { token: null, error: "Could not enable push notifications. Try again later." };
  }
}

/** Unsubscribe from push by deleting the current FCM token. */
export async function deleteFcmToken(): Promise<boolean> {
  const messaging = getMessagingInstance();
  if (!messaging) return false;
  try {
    return await deleteToken(messaging);
  } catch {
    return false;
  }
}

/**
 * Listen for foreground messages. Returns an unsubscribe function.
 * Only call when the app is in the foreground (not needed in the SW).
 */
export function onForegroundMessage(
  cb: (payload: MessagePayload) => void
): () => void {
  const messaging = getMessagingInstance();
  if (!messaging) return () => {};

  return onMessage(messaging, cb);
}

"use client";

import { getToken, onMessage, getMessaging, deleteToken, type MessagePayload } from "firebase/messaging";
import { getApp } from "@/lib/firebase";

/**
 * Returns the Firebase Messaging instance (lazy-initialized).
 * Returns null when the browser doesn't support FCM or the user denied permission.
 */
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
 * Call once on app mount.
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

  // Inject config into the SW scope so the compat scripts can read it.
  reg.active?.postMessage({ type: "SET_FIREBASE_CONFIG", config });

  swRegistration = reg;
  return reg;
}

/**
 * Request notification permission, get an FCM token, and return it.
 * Returns null if permission was denied or something failed.
 */
export async function requestFcmToken(): Promise<string | null> {
  const messaging = getMessagingInstance();
  if (!messaging) return null;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const reg = await registerServiceWorker();
  if (!reg) return null;

  try {
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: reg,
    });
    return token;
  } catch {
    return null;
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

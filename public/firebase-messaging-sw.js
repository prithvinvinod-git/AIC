/* firebase-messaging-sw.js — runs outside Next.js, plain JS only */
/* eslint-disable no-undef */

importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

self.__FIREBASE_CONFIG = {};
self.__FIREBASE_READY = false;

/* ------------------------------------------------------------------ *
 * Offline app-shell cache (plain JS, no framework).                  *
 *                                                                    *
 * Purpose: make the shell (HTML + hashed static assets + icons +     *
 * images) load on a flat connection. Authenticated JSON GETs are     *
 * intentionally NOT cached here — they are served per-user through   *
 * the IndexedDB read-through cache on the client (src/lib/jsonCache) *
 * and cleared on account switch. SW only stores public assets.       *
 * ------------------------------------------------------------------ */
const SHELL_CACHE = "servox-shell-v1";
/* In local dev, Turbopack reuses chunk URLs across recompiles while their
 * contents change. A cache-first strategy then serves a stale chunk and the
 * app dies with "module factory is not available". Never cache /_next/static
 * on localhost — let the browser handle it so HMR keeps working. */
const IS_LOCAL_DEV = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(self.location.hostname);
const PRECACHE_URLS = [
  "/",
  "/login",
  "/signup",
  "/manifest.json",
  "/servoxlogo.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => { /* offline install — runtime cache will fill in */ })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith("servox-shell-") && k !== SHELL_CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

/* Cache-first with background revalidate, for content-hashed/public assets. */
function staleWhileRevalidate(cache, request) {
  return caches.open(cache).then(async (c) => {
    const hit = await c.match(request);
    const network = fetch(request)
      .then((res) => {
        if (res && res.ok) c.put(request, res.clone());
        return res;
      })
      .catch(() => hit);
    return hit || network;
  });
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // let CDNs behave normally

  // Navigation: network first, fall back to the precached shell offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .catch(() =>
          caches.match("/").then((cached) => cached || caches.match("/login"))
        )
    );
    return;
  }

  // Public, content-hashed build assets + fonts + icons.
  if (
    url.pathname.startsWith("/_next/static") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname === "/servoxlogo.png" ||
    url.pathname === "/manifest.json"
  ) {
    // Bypass in local dev — see IS_LOCAL_DEV above.
    if (IS_LOCAL_DEV && url.pathname.startsWith("/_next/static")) return;
    event.respondWith(staleWhileRevalidate(SHELL_CACHE, request));
    return;
  }

  // Unguessable (UUID) image blobs — cache-first so cached attachments open
  // offline. Attachments are private but the URL is unguessable.
  if (url.pathname.startsWith("/api/images/")) {
    event.respondWith(staleWhileRevalidate(SHELL_CACHE, request));
    return;
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SET_FIREBASE_CONFIG") {
    self.__FIREBASE_CONFIG = event.data.config || {};
    if (!self.__FIREBASE_INIT) {
      self.__FIREBASE_INIT = true;
      initFirebase();
    }
  }
});

function initFirebase() {
  firebase.initializeApp(self.__FIREBASE_CONFIG);

  const messaging = firebase.messaging();
  self.__FIREBASE_READY = true;

  /* Notify client that SW is ready */
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => client.postMessage({ type: "SW_READY" }));
  });

  /* Background handler — called when the app is NOT in the foreground */
  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title || payload.data?.title || "Servox";
    const body  = payload.notification?.body  || payload.data?.body  || "";
    const link  = payload.data?.link || "/dashboard";

    self.registration.showNotification(title, {
      body,
      icon: "/servoxlogo.png",
      badge: "/servoxlogo.png",
      data: { link },
      tag: "servox-" + (payload.data?.type || "general"),
      renotify: true,
    });

    /* Increment badge count */
    self.registration.getNotifications({ silent: true }).then((notifications) => {
      const count = notifications.length;
      if (self.registration.setAppBadge) {
        self.registration.setAppBadge(count);
      }
    });
  });
}

/* Badge on notification show (covers both background and foreground) */
self.addEventListener("notificationshow", (event) => {
  event.waitUntil(
    self.registration.getNotifications({ silent: true }).then((notifications) => {
      const count = notifications.length;
      if (self.registration.setAppBadge) {
        self.registration.setAppBadge(count);
      }
    })
  );
});

/* Tap handler — opens the link embedded in the notification and clears badge */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link || "/dashboard";

  /* Clear badge */
  if (self.registration.clearAppBadge) {
    self.registration.clearAppBadge();
  }

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          client.navigate(link);
          return;
        }
      }
      return clients.openWindow(link);
    })
  );
});

/* Dismiss handler — update badge when user swipes away a notification */
self.addEventListener("notificationclose", (event) => {
  event.waitUntil(
    self.registration.getNotifications({ silent: true }).then((notifications) => {
      const count = notifications.length;
      if (count === 0 && self.registration.clearAppBadge) {
        self.registration.clearAppBadge();
      } else if (self.registration.setAppBadge) {
        self.registration.setAppBadge(count);
      }
    })
  );
});

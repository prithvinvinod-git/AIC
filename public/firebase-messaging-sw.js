/* firebase-messaging-sw.js — runs outside Next.js, plain JS only */
/* eslint-disable no-undef */

self.__FIREBASE_CONFIG = {};
self.__FIREBASE_READY = false;

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
  importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
  importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

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
  });
}

/* Tap handler — opens the link embedded in the notification */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link || "/dashboard";
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

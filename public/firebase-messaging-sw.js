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

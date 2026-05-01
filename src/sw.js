import { precacheAndRoute } from "workbox-precaching";

// Injected by vite-plugin-pwa — precaches all built assets
precacheAndRoute(self.__WB_MANIFEST);

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener("push", event => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? "VitalCenter", {
      body:    data.body   ?? "",
      icon:    "/pwa-192x192.png",
      badge:   "/pwa-64x64.png",
      tag:     data.tag    ?? "nf-general",
      vibrate: [200, 100, 200],
      data:  { url: data.url ?? "/" },
    })
  );
});

// ── Notification tap → open / focus app ──────────────────────────────────────
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = event.notification.data?.url ?? "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.startsWith(self.location.origin) && "focus" in c) return c.focus();
      }
      return clients.openWindow(target);
    })
  );
});

// ── In-app scheduled notification trigger (sent via postMessage) ──────────────
// The app sends { type: "SCHEDULE_NOTIFICATION", ... } when the user has the
// page open and a reminder time arrives. The SW then calls showNotification so
// it appears in the system tray even when the tab is backgrounded.
self.addEventListener("message", event => {
  if (event.data?.type !== "SCHEDULE_NOTIFICATION") return;
  const { title, body, tag } = event.data;
  self.registration.showNotification(title, {
    body,
    icon:    "/pwa-192x192.png",
    badge:   "/pwa-64x64.png",
    tag:     tag ?? "nf-reminder",
    vibrate: [200, 100, 200],
  });
});

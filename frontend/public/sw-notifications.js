/* global clients */
// Appended to the generated Workbox service worker via `workbox.importScripts`
// in vite.config.js. Keeps a tapped rest-timer notification from opening a
// second copy of the app.

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const scope = self.registration.scope;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.startsWith(scope) && 'focus' in client) return client.focus();
      }
      return clients.openWindow(scope);
    }),
  );
});

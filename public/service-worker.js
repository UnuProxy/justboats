// Retire the old custom service worker.
// It interfered with brochure and image requests, so on activate we clear caches
// and unregister the worker to return all requests to the network.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    await self.registration.unregister();

    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach((client) => {
      client.navigate(client.url);
    });
  })());
});

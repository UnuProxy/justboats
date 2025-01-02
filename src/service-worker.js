/* eslint-disable no-restricted-globals */

// This variable is required and should be first
self.__WB_MANIFEST = []; 

self.addEventListener('install', () => {
  console.log('Service worker installed');
});

self.addEventListener('activate', () => {
  console.log('Service worker activated');
});

self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .catch(() => {
        // Handle offline functionality here if needed
        return new Response('Offline');
      })
  );
});
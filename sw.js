const CACHE_NAME = 'opic-master-runtime-v5';
const BASE = '/Opics/';
const APP_SHELL = [
  BASE,
  BASE + 'index.html',
  BASE + 'styles.css',
  BASE + 'app.js',
  BASE + 'opic_questions_data.js',
  BASE + 'manifest.webmanifest',
  BASE + 'icons/icon-192.png',
  BASE + 'icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;

  // Online: always request the newest file. Offline: use the last cached copy.
  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then(cached =>
        cached || caches.match(BASE + 'index.html')
      ))
  );
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

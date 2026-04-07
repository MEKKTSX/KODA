const CACHE_NAME = 'koda-app-v1.15-beta';
const urlsToCache = [
  '/',
  '/index.html',
  '/watchlist.html',
  '/world-news.html',
  '/ai-ops.html',
  '/config.html',
  '/koda.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // ถัามีแคชให้ใช้แคช ถ้าไม่มีให้ไปโหลดจากเน็ต
        return response || fetch(event.request);
      })
  );
});

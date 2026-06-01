const CACHE_NAME = 'koda-app-v2.0-business';
const urlsToCache = [
  '/',
  '/index.html',
  '/watchlist.html',
  '/portfolio.html',
  '/world-news.html',
  '/ai-ops.html',
  '/config.html',
  '/css/koda-tokens.css',
  '/css/koda-shell.css',
  '/js/tailwind-config.js',
  '/js/layout.js',
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

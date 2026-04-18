const CACHE_NAME = 'badr-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
];

// تثبيت Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(ASSETS_TO_CACHE).catch(() => {
          console.log('Some assets could not be cached (expected for development)');
          return Promise.resolve();
        });
      })
      .then(() => self.skipWaiting()),
  );
});

// تفعيل Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName)),
      );
    }).then(() => self.clients.claim()),
  );
});

// معالجة الطلبات (Fetch)
self.addEventListener('fetch', (event) => {
  // تجاهل الطلبات غير GET
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches
      .match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request).then((response) => {
          // لا نخزن مؤقتاً API وطلبات ديناميكية بدون تحقق فقط
          if (
            !event.request.url.includes('/api/') &&
            response.status === 200 &&
            response.type === 'basic'
          ) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        });
      })
      .catch(() => {
        // إذا فشل الفرصة، نعود للصفحة الرئيسية
        return caches
          .match('/')
          .then((response) => response || new Response('Offline - No cached response available'));
      }),
  );
});

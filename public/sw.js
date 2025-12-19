// Service Worker מינימלי ל-PWA
// לא עושה caching - רק מאפשר התקנה כאפליקציה

const CACHE_NAME = 'eisenhower-app-v1';
const urlsToCache = [];

// התקנה
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker: Installing...');
  // לא נשמור מטמון - רק נוודא שה-SW מותקן
  self.skipWaiting();
});

// הפעלה
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker: Activated');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch - תמיד מהרשת, בלי caching
self.addEventListener('fetch', (event) => {
  // לא נשמור מטמון - תמיד מהרשת
  event.respondWith(fetch(event.request));
});


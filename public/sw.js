/**
 * Service Worker - PWA
 */

const CACHE_NAME = 'eisenhower-v1';
const OFFLINE_URL = '/offline.html';

// קבצים לשמירה במטמון
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// התקנה
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('SW: פתיחת מטמון');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// הפעלה
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      );
    }).then(() => self.clients.claim())
  );
});

// בקשות רשת
self.addEventListener('fetch', (event) => {
  // רק בקשות GET
  if (event.request.method !== 'GET') return;
  
  // דילוג על בקשות API
  if (event.request.url.includes('/api/') || 
      event.request.url.includes('supabase')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // מחזיר מהמטמון אם קיים
        if (response) {
          return response;
        }

        // אחרת, מביא מהרשת
        return fetch(event.request)
          .then((response) => {
            // בדיקה אם התשובה תקינה
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // שמירה במטמון
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          });
      })
      .catch(() => {
        // אם אין רשת ואין מטמון, מחזיר דף offline
        if (event.request.mode === 'navigate') {
          return caches.match(OFFLINE_URL);
        }
      })
  );
});

// התראות Push
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  
  const options = {
    body: data.body || 'יש לך משימה חדשה!',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    dir: 'rtl',
    lang: 'he',
    vibrate: [200, 100, 200],
    data: data.data || {},
    actions: data.actions || [
      { action: 'open', title: 'פתח' },
      { action: 'dismiss', title: 'סגור' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'מטריצת אייזנהאואר', options)
  );
});

// לחיצה על התראה
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then((clientList) => {
        // אם יש חלון פתוח, מתמקד בו
        for (const client of clientList) {
          if (client.url.includes('/dashboard') && 'focus' in client) {
            return client.focus();
          }
        }
        // אחרת, פותח חלון חדש
        if (clients.openWindow) {
          return clients.openWindow('/dashboard');
        }
      })
  );
});

// עדכון ברקע
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-tasks') {
    event.waitUntil(syncTasks());
  }
});

async function syncTasks() {
  // כאן ניתן להוסיף לוגיקה לסנכרון משימות שנשמרו offline
  console.log('SW: סנכרון משימות');
}


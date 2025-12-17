/**
 * Service Worker - PWA
 */

const CACHE_NAME = 'eisenhower-v2-20241217'; // עדכון גרסה
const OFFLINE_URL = '/offline.html';

// קבצים לשמירה במטמון
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// התקנה
self.addEventListener('install', (event) => {
  console.log('SW: התקנה - גרסה חדשה');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('SW: פתיחת מטמון חדש');
        return cache.addAll(urlsToCache).catch(err => {
          console.warn('SW: שגיאה בהוספת קבצים למטמון:', err);
          // ממשיכים גם אם יש שגיאה
          return Promise.resolve();
        });
      })
      .then(() => {
        console.log('SW: קפיצה לגרסה חדשה');
        return self.skipWaiting();
      })
  );
});

// הפעלה - מנקה מטמונים ישנים
self.addEventListener('activate', (event) => {
  console.log('SW: הפעלה - ניקוי מטמונים ישנים');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      console.log('SW: מטמונים קיימים:', cacheNames);
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            const isOldCache = cacheName !== CACHE_NAME;
            if (isOldCache) {
              console.log('SW: מוחק מטמון ישן:', cacheName);
            }
            return isOldCache;
          })
          .map((cacheName) => caches.delete(cacheName))
      );
    }).then(() => {
      console.log('SW: תופס שליטה על כל הלקוחות');
      return self.clients.claim();
    }).then(() => {
      // שליחת הודעה לכל הלקוחות שיש גרסה חדשה
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_UPDATED',
            message: 'גרסה חדשה זמינה!'
          });
        });
      });
    })
  );
});

// בקשות רשת - Network First עם Fallback למטמון
self.addEventListener('fetch', (event) => {
  // רק בקשות GET
  if (event.request.method !== 'GET') return;
  
  // דילוג על בקשות API - תמיד מהרשת
  if (event.request.url.includes('/api/') || 
      event.request.url.includes('supabase.co') ||
      event.request.url.includes('chrome-extension://')) {
    return;
  }

  // עבור קבצי HTML/JS/CSS - Network First (תמיד הגרסה החדשה)
  if (event.request.url.includes('.html') || 
      event.request.url.includes('.js') || 
      event.request.url.includes('.css') ||
      event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // אם הרשת עובדת, שומר במטמון ומחזיר
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // אם אין רשת, נסה מטמון
          return caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
              console.log('SW: משתמש במטמון עבור:', event.request.url);
              return cachedResponse;
            }
            // אם אין כלום, דף offline
            if (event.request.mode === 'navigate') {
              return caches.match(OFFLINE_URL);
            }
          });
        })
    );
    return;
  }

  // עבור שאר הקבצים (תמונות וכו') - Cache First
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request)
          .then((response) => {
            if (response && response.status === 200) {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache);
              });
            }
            return response;
          });
      })
      .catch(() => {
        console.warn('SW: שגיאה בטעינת:', event.request.url);
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


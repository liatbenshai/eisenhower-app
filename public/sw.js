// Service Worker מינימלי ל-PWA
// לא עושה caching - רק מאפשר התקנה כאפליקציה
// לא חוסם רענון - תמיד מהרשת

// מחיקת כל המטמונים בהתקנה
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker: Installing...');
  self.skipWaiting();
  
  // מחיקת כל המטמונים
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          console.log('🗑️ Service Worker: Deleting cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    })
  );
});

// הפעלה - מחיקת מטמונים ישנים
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker: Activated');
  event.waitUntil(
    Promise.all([
      // מחיקת כל המטמונים
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            console.log('🗑️ Service Worker: Deleting cache:', cacheName);
            return caches.delete(cacheName);
          })
        );
      }),
      // הפעלה מיידית
      self.clients.claim()
    ])
  );
});

// Fetch - תמיד מהרשת, בלי caching, בלי חסימה
self.addEventListener('fetch', (event) => {
  // רק בקשות HTML - נבדוק אם יש עדכון
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        // אם אין אינטרנט, נחזיר תגובה ריקה
        return new Response('אין חיבור לאינטרנט', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      })
    );
  } else {
    // כל שאר הבקשות - תמיד מהרשת
    event.respondWith(fetch(event.request));
  }
});


/**
 * Service Worker - Disabled Version
 * Service Worker זה לא עושה כלום - פשוט מבטל את כל המטמון
 * גרסה זו פותרת את בעיית הרענון
 */

const VERSION = 'v5-disabled';

console.log('🟢 [SW] Service Worker מותקן - מצב מושבת');

// התקנה - מחיקת כל המטמונים הישנים
self.addEventListener('install', (event) => {
  console.log('📦 [SW] Install - מוחק מטמונים ישנים');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        console.log('🗑️ [SW] מוחק', cacheNames.length, 'מטמונים');
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      })
      .then(() => {
        console.log('✅ [SW] מטמונים נמחקו');
        return self.skipWaiting();
      })
  );
});

// הפעלה - השתלטות מיידית
self.addEventListener('activate', (event) => {
  console.log('⚡ [SW] Activate - משתלט על דף');
  
  event.waitUntil(
    Promise.all([
      // מחיקת כל המטמונים (שוב, למקרה שנשארו)
      caches.keys().then((names) => 
        Promise.all(names.map((name) => caches.delete(name)))
      ),
      // השתלטות מיידית
      self.clients.claim()
    ]).then(() => {
      console.log('✅ [SW] מוכן - ללא מטמון');
    })
  );
});

// בקשות - לא עושה CACHE בכלל, תמיד מהרשת
self.addEventListener('fetch', (event) => {
  // פשוט תן לדפדפן לטפל בזה - ללא מטמון
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // החזר תשובה מהרשת ישירות, ללא שמירה במטמון
        return response;
      })
      .catch((error) => {
        console.error('[SW] Fetch failed:', error);
        // אם אין אינטרנט, פשוט תחזיר את השגיאה
        throw error;
      })
  );
});

console.log('✅ [SW] מוכן - ללא מטמון, תמיד מהרשת');

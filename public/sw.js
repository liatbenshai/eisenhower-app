/**
 * Service Worker - Self-Destruct Version
 * גרסה זו מוחקת את עצמה ואת כל המטמונים
 */

const SELF_DESTRUCT_VERSION = 'v4-self-destruct';

console.log('🔴 Service Worker: מצב מחיקה עצמית מופעל!');

// התקנה - מחיקת מטמונים
self.addEventListener('install', (event) => {
  console.log('🗑️ [SW Install] מתחיל מחיקה...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        console.log('🗑️ [SW] מוצא מטמונים:', cacheNames);
        return Promise.all(
          cacheNames.map((cacheName) => {
            console.log('🗑️ [SW] מוחק:', cacheName);
            return caches.delete(cacheName);
          })
        );
      })
      .then(() => {
        console.log('✅ [SW] כל המטמונים נמחקו');
        return self.skipWaiting();
      })
  );
});

// הפעלה - הסרת רישום
self.addEventListener('activate', (event) => {
  console.log('💀 [SW Activate] מוחק את עצמי...');
  
  event.waitUntil(
    Promise.all([
      // מחיקת כל המטמונים (שוב, למקרה שנשארו)
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            console.log('🗑️ [SW] מוחק מטמון:', cacheName);
            return caches.delete(cacheName);
          })
        );
      }),
      // השתלטות על לקוחות
      self.clients.claim()
    ])
    .then(() => {
      console.log('📢 [SW] שולח הודעה ללקוחות');
      return self.clients.matchAll();
    })
    .then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: 'SW_REMOVED',
          message: 'Service Worker נמחק - רענן את הדף'
        });
      });
      console.log('💀 [SW] מסיר רישום...');
      // הסרת עצמית
      return self.registration.unregister();
    })
    .then((success) => {
      if (success) {
        console.log('✅ [SW] הוסר בהצלחה!');
      } else {
        console.warn('⚠️ [SW] לא הצליח להסיר את עצמו');
      }
    })
  );
});

// בקשות - לא עושה כלום, רק מעביר ישר לרשת
self.addEventListener('fetch', (event) => {
  // לא מטפלים בבקשות - תן לדפדפן לטפל בזה רגיל
  return;
});

console.log('🔴 Service Worker: מוכן למחיקה עצמית');

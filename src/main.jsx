// מחיקת Service Workers ומטמונים לפני טעינת React - זה קריטי!
if (typeof window !== 'undefined') {
  // מניעת רישום Service Workers - override של register
  if ('serviceWorker' in navigator) {
    // שמירת הפונקציה המקורית (אם יש)
    const originalRegister = navigator.serviceWorker.register;
    
    // override מלא - מחזיר Promise שנדחה תמיד
    navigator.serviceWorker.register = function(...args) {
      console.warn('🚫 נחסם ניסיון לרישום Service Worker:', args[0]);
      // מחזיר Promise שנדחה מיד
      return Promise.reject(new Error('Service Worker registration is disabled for refresh compatibility'));
    };
    
    // גם override של ready - מחזיר Promise שנדחה
    if (navigator.serviceWorker.ready) {
      const originalReady = navigator.serviceWorker.ready;
      Object.defineProperty(navigator.serviceWorker, 'ready', {
        get: function() {
          console.warn('🚫 נחסם גישה ל-serviceWorker.ready');
          return Promise.reject(new Error('Service Worker is disabled'));
        },
        configurable: true
      });
    }
  }
  
  // מחיקה מיידית - לפני כל דבר אחר
  (async () => {
    try {
      if ('serviceWorker' in navigator) {
        // מחיקת כל ה-Service Workers - עם retry
        let attempts = 0;
        const maxAttempts = 5;
        
        while (attempts < maxAttempts) {
          attempts++;
          try {
            const registrations = await Promise.race([
              navigator.serviceWorker.getRegistrations(),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
            ]);
            
            if (registrations.length > 0) {
              console.log(`🗑️ מוחק ${registrations.length} Service Workers (ניסיון ${attempts})...`);
              await Promise.all(registrations.map(reg => reg.unregister()));
              console.log('✅ כל ה-Service Workers נמחקו');
              break;
            } else {
              console.log('✅ אין Service Workers לניקוי');
              break;
            }
          } catch (err) {
            console.warn(`⚠️ שגיאה בניסיון ${attempts}:`, err);
            if (attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        }
        
        // listener למניעת רישום חדש - עם debounce
        let controllerChangeTimeout = null;
        navigator.serviceWorker.addEventListener('controllerchange', async () => {
          if (controllerChangeTimeout) {
            clearTimeout(controllerChangeTimeout);
          }
          controllerChangeTimeout = setTimeout(async () => {
            console.warn('⚠️ Service Worker controller changed - מוחק שוב...');
            try {
              const newRegistrations = await navigator.serviceWorker.getRegistrations();
              if (newRegistrations.length > 0) {
                await Promise.all(newRegistrations.map(reg => reg.unregister()));
                console.log('✅ Service Workers נמחקו שוב');
              }
            } catch (err) {
              console.warn('⚠️ שגיאה במחיקת Service Workers:', err);
            }
          }, 100);
        });
      }
      
      // מחיקת כל המטמונים
      if ('caches' in window) {
        try {
          const cacheNames = await Promise.race([
            caches.keys(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
          ]);
          
          if (cacheNames.length > 0) {
            console.log('🗑️ מוחק', cacheNames.length, 'מטמונים...');
            await Promise.all(cacheNames.map(name => caches.delete(name)));
            console.log('✅ כל המטמונים נמחקו');
          } else {
            console.log('✅ אין מטמונים לניקוי');
          }
        } catch (err) {
          console.warn('⚠️ שגיאה במחיקת מטמונים:', err);
        }
      }
      
      console.log('✨ האפליקציה פועלת ללא Service Worker - רענון חופשי!');
      
      // בדיקה נוספת אחרי 2 שניות - למקרה ש-Service Worker נרשם מאוחר יותר
      setTimeout(async () => {
        if ('serviceWorker' in navigator) {
          const lateRegistrations = await navigator.serviceWorker.getRegistrations();
          if (lateRegistrations.length > 0) {
            console.warn('⚠️ נמצא Service Worker שנרשם מאוחר - מוחק...');
            await Promise.all(lateRegistrations.map(reg => reg.unregister()));
            console.log('✅ Service Workers מאוחרים נמחקו');
          }
        }
      }, 2000);
    } catch (error) {
      console.warn('⚠️ שגיאה במחיקת Service Workers:', error);
    }
  })();
  
  // מניעת תקיעות - אם הדף לא נטען תוך 10 שניות, נציג הודעה
  setTimeout(() => {
    if (document.readyState !== 'complete') {
      console.warn('⚠️ הדף לוקח יותר מדי זמן לטעון - ייתכן שיש Service Worker חוסם');
      // נציג הודעה למשתמש
      const warning = document.createElement('div');
      warning.style.cssText = 'position:fixed;top:0;left:0;right:0;background:red;color:white;padding:10px;text-align:center;z-index:99999;';
      warning.textContent = '⚠️ הדף נתקע! אנא מחקי Service Workers: F12 → Application → Service Workers → Unregister';
      document.body.appendChild(warning);
    }
  }, 10000);
}

console.log('⚡ main.jsx loading...');
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { TaskProvider } from './context/TaskContext';
import { NotificationProvider } from './context/NotificationContext';
import './styles/globals.css';

// בדיקה שהסשן נשמר ב-localStorage לפני טעינת האפליקציה
if (typeof window !== 'undefined') {
  // בדיקה עם המפתח החדש
  const newKey = 'eisenhower-auth';
  const oldKeyPattern = 'sb-';
  
  // בדיקת מפתח חדש
  const newSession = localStorage.getItem(newKey);
  if (newSession) {
    console.log('✅ נמצא סשן שמור ב-localStorage (מפתח חדש)');
  } else {
    // בדיקת מפתחות ישנים
    let foundOldKey = false;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(oldKeyPattern)) {
        foundOldKey = true;
        console.log('✅ נמצא סשן שמור ב-localStorage (מפתח ישן):', key);
        break;
      }
    }
    if (!foundOldKey) {
      console.log('ℹ️ אין סשן שמור ב-localStorage');
    }
  }
}

console.log('🚀 Starting app render...');

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AuthProvider>
      <TaskProvider>
        <NotificationProvider>
          <App />
        </NotificationProvider>
      </TaskProvider>
    </AuthProvider>
  </BrowserRouter>
);

console.log('🚀 Render called');

// מניעת תקיעות - בדיקת תקינות כל כמה דקות
if (typeof window !== 'undefined') {
  // בדיקה שהדפדפן עדיין פעיל
  setInterval(() => {
    // בדיקה פשוטה שהדף עדיין מגיב
    if (document.visibilityState === 'visible') {
      // אם הדף פעיל, נבדוק שהכל תקין
      const hasError = document.querySelector('.error-message');
      if (hasError) {
        console.warn('⚠️ נמצאה שגיאה בדף, מנסה לרענן...');
        // לא נרענן אוטומטית, רק נדווח
      }
    }
  }, 2 * 60 * 1000); // כל 2 דקות
}


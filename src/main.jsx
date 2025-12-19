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

// רישום Service Worker מינימלי ל-PWA (בלי caching, לא חוסם רענון)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      // מחיקת Service Workers ישנים (אם יש)
      const oldRegistrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of oldRegistrations) {
        // אם זה לא ה-SW שלנו, נמחק אותו
        if (!registration.active?.scriptURL.includes('/sw.js')) {
          await registration.unregister();
          console.log('🗑️ Service Worker ישן הוסר:', registration.scope);
        }
      }

      // רישום Service Worker חדש (מינימלי, בלי caching)
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none' // לא לשמור מטמון של ה-SW עצמו
      });

      console.log('✅ Service Worker נרשם ל-PWA:', registration.scope);

      // עדכון אוטומטי - אם יש עדכון, נטען מחדש
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('🔄 Service Worker עודכן - רענני את הדף');
              // לא נרענן אוטומטית - המשתמש יכול לרענן בעצמו
            }
          });
        }
      });
      
      // בדיקה תקופתית לעדכונים
      setInterval(async () => {
        try {
          await registration.update();
        } catch (err) {
          console.warn('⚠️ שגיאה בעדכון Service Worker:', err);
        }
      }, 60 * 1000); // כל דקה
      
    } catch (error) {
      console.warn('⚠️ לא ניתן לרשום Service Worker:', error);
      // זה לא קריטי - האפליקציה תעבוד גם בלי
    }
  });
  
  // אפשרות למחיקת Service Worker אם יש בעיה
  if (typeof window !== 'undefined') {
    // אם המשתמש לוחץ Ctrl+Shift+R, נמחק את ה-SW
    window.addEventListener('keydown', async (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'R') {
        console.log('🔄 Hard refresh - מוחק Service Worker...');
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map(reg => reg.unregister()));
          console.log('✅ Service Workers נמחקו');
        } catch (err) {
          console.error('❌ שגיאה במחיקת Service Workers:', err);
        }
      }
    });
  }
}

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


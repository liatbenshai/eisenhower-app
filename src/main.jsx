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
  const supabaseSession = localStorage.getItem('sb-' + (import.meta.env.VITE_SUPABASE_URL?.split('//')[1]?.split('.')[0] || 'default') + '-auth-token');
  if (supabaseSession) {
    console.log('✅ נמצא סשן שמור ב-localStorage');
  } else {
    console.log('ℹ️ אין סשן שמור ב-localStorage');
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

// ניקוי אגרסיבי של Service Worker ומטמונים - מונע בעיות רענון
// קוד זה ירוץ בכל טעינה ויסיר את כל השאריות
(async () => {
  try {
    // מחיקת כל ה-Service Workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations.length > 0) {
        console.log('🧹 מוחק', registrations.length, 'Service Workers...');
        await Promise.all(registrations.map(reg => {
          return reg.unregister().then(success => {
            if (success) {
              console.log('✅ Service Worker הוסר:', reg.scope);
            }
            return success;
          });
        }));
      }
    }

    // מחיקת כל המטמונים
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      if (cacheNames.length > 0) {
        console.log('🧹 מוחק', cacheNames.length, 'מטמונים...');
        await Promise.all(cacheNames.map(name => {
          return caches.delete(name).then(success => {
            if (success) {
              console.log('✅ מטמון הוסר:', name);
            }
            return success;
          });
        }));
      }
    }

    console.log('✨ האפליקציה פועלת ללא Service Worker - רענון חופשי!');
  } catch (error) {
    console.error('שגיאה בניקוי Service Workers ומטמונים:', error);
  }
})();

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


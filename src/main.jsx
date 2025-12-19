// מחיקת Service Workers ומטמונים לפני טעינת React - זה קריטי!
if (typeof window !== 'undefined') {
  // מחיקה מיידית - לפני כל דבר אחר
  (async () => {
    try {
      if ('serviceWorker' in navigator) {
        // מחיקת כל ה-Service Workers
        const registrations = await navigator.serviceWorker.getRegistrations();
        if (registrations.length > 0) {
          console.log('🗑️ מוחק', registrations.length, 'Service Workers...');
          await Promise.all(registrations.map(reg => reg.unregister()));
          console.log('✅ כל ה-Service Workers נמחקו');
        } else {
          console.log('✅ אין Service Workers לניקוי');
        }
      }
      
      // מחיקת כל המטמונים
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        if (cacheNames.length > 0) {
          console.log('🗑️ מוחק', cacheNames.length, 'מטמונים...');
          await Promise.all(cacheNames.map(name => caches.delete(name)));
          console.log('✅ כל המטמונים נמחקו');
        } else {
          console.log('✅ אין מטמונים לניקוי');
        }
      }
      
      console.log('✨ האפליקציה פועלת ללא Service Worker - רענון חופשי!');
    } catch (error) {
      console.warn('⚠️ שגיאה במחיקת Service Workers:', error);
    }
  })();
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


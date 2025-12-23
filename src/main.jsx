// מחיקת Service Workers ו-cache - גיבוי (הקוד הראשי ב-index.html)
// זה רק גיבוי למקרה שהקוד ב-index.html לא רץ
if (typeof window !== 'undefined') {
  // פונקציה למחיקת Service Workers ו-cache
  const clearServiceWorkersAndCache = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(reg => {
          reg.unregister().catch(() => {});
        });
      }).catch(() => {});
    }
    
    if ('caches' in window) {
      caches.keys().then(cacheNames => {
        cacheNames.forEach(cacheName => {
          caches.delete(cacheName).catch(() => {});
        });
      }).catch(() => {});
    }
  };
  
  // מחיקה לפני רענון/סגירה
  window.addEventListener('beforeunload', clearServiceWorkersAndCache);
  
  // וידוא שחסימת Service Workers עדיין פעילה
  if ('serviceWorker' in navigator && !navigator.serviceWorker.register.toString().includes('disabled')) {
    navigator.serviceWorker.register = function() {
      return Promise.reject(new Error('Service Workers disabled'));
    };
  }
  
  // ניקוי מפתחות טיימר ישנים (פורמט ישן)
  // זה רץ פעם אחת כשהאפליקציה נטענת
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('timer_') && !key.startsWith('timer_state_')) {
        keysToRemove.push(key);
      }
    }
    if (keysToRemove.length > 0) {
      console.log('🧹 מנקה מפתחות טיימר ישנים:', keysToRemove.length);
      keysToRemove.forEach(key => localStorage.removeItem(key));
    }
  } catch (e) {
    console.warn('⚠️ שגיאה בניקוי מפתחות ישנים:', e);
  }
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

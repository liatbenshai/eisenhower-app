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

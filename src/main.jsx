// מחיקת Service Workers ו-cache - אגרסיבי מאוד + לפני רענון
if (typeof window !== 'undefined') {
  // פונקציה למחיקת כל ה-Service Workers ו-cache
  const clearServiceWorkersAndCache = () => {
    // מחיקת Service Workers
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(reg => {
          reg.unregister().then(() => {
            console.log('✅ Service Worker נמחק');
          }).catch(() => {});
        });
      }).catch(() => {});
    }
    
    // מחיקת כל ה-cache
    if ('caches' in window) {
      caches.keys().then(cacheNames => {
        cacheNames.forEach(cacheName => {
          caches.delete(cacheName).then(() => {
            console.log('✅ Cache נמחק:', cacheName);
          }).catch(() => {});
        });
      }).catch(() => {});
    }
    
    // מחיקת localStorage ו-sessionStorage של Service Workers
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.includes('service-worker') || key.includes('sw-') || key.includes('workbox')) {
          localStorage.removeItem(key);
        }
      });
      Object.keys(sessionStorage).forEach(key => {
        if (key.includes('service-worker') || key.includes('sw-') || key.includes('workbox')) {
          sessionStorage.removeItem(key);
        }
      });
    } catch (e) {}
  };
  
  // מחיקה מיד בטעינה
  clearServiceWorkersAndCache();
  
  // מחיקה לפני רענון/סגירה
  window.addEventListener('beforeunload', () => {
    clearServiceWorkersAndCache();
  });
  
  // מחיקה גם ב-visibilitychange (כשהדף נסגר/נפתח)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearServiceWorkersAndCache();
    }
  });
  
  // מניעת יצירת Service Workers חדשים - חזק יותר
  if ('serviceWorker' in navigator) {
    const originalRegister = navigator.serviceWorker.register;
    navigator.serviceWorker.register = function() {
      console.warn('🚫 נחסם ניסיון לרישום Service Worker');
      return Promise.reject(new Error('Service Workers disabled'));
    };
    
    // חסימת ready
    Object.defineProperty(navigator.serviceWorker, 'ready', {
      get: function() {
        return Promise.reject(new Error('Service Workers disabled'));
      },
      configurable: true
    });
    
    // חסימת getRegistration
    const originalGetRegistration = navigator.serviceWorker.getRegistration;
    navigator.serviceWorker.getRegistration = function() {
      return Promise.resolve(null);
    };
    
    // חסימת getRegistrations
    const originalGetRegistrations = navigator.serviceWorker.getRegistrations;
    navigator.serviceWorker.getRegistrations = function() {
      return Promise.resolve([]);
    };
  }
  
  // הוספת version ל-URL כדי למנוע cache ישן
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = args[0];
    if (typeof url === 'string' && url.includes('/src/')) {
      args[0] = url + (url.includes('?') ? '&' : '?') + '_v=' + Date.now();
    }
    return originalFetch.apply(this, args);
  };
  
  console.log('✨ Service Workers ו-Cache מושבתים - רענון חופשי!');
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

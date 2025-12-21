// מחיקת Service Workers ו-cache - אגרסיבי מאוד + לפני רענון
if (typeof window !== 'undefined') {
  // פונקציה למחיקת כל ה-Service Workers ו-cache - חזקה מאוד
  const clearServiceWorkersAndCache = () => {
    // מחיקת Service Workers - חזק יותר
    if ('serviceWorker' in navigator) {
      // נסיון 1: דרך getRegistrations
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(reg => {
          reg.unregister().then(() => {
            console.log('✅ Service Worker נמחק');
          }).catch(() => {});
        });
      }).catch(() => {});
      
      // נסיון 2: דרך getRegistration לכל URL אפשרי
      ['/', '/index.html', '/sw.js', '/service-worker.js'].forEach(url => {
        navigator.serviceWorker.getRegistration(url).then(reg => {
          if (reg) {
            reg.unregister().then(() => {
              console.log('✅ Service Worker נמחק:', url);
            }).catch(() => {});
          }
        }).catch(() => {});
      });
    }
    
    // מחיקת כל ה-cache - חזק יותר
    if ('caches' in window) {
      caches.keys().then(cacheNames => {
        cacheNames.forEach(cacheName => {
          caches.delete(cacheName).then(() => {
            console.log('✅ Cache נמחק:', cacheName);
          }).catch(() => {});
        });
      }).catch(() => {});
    }
    
    // מחיקת כל ה-localStorage ו-sessionStorage
    try {
      // מחיקת כל המפתחות שקשורים ל-Service Workers
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('service-worker') || key.includes('sw-') || key.includes('workbox') || key.includes('cache'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (key.includes('service-worker') || key.includes('sw-') || key.includes('workbox') || key.includes('cache'))) {
          sessionStorage.removeItem(key);
        }
      }
    } catch (e) {}
  };
  
  // מחיקה מיד בטעינה - כמה פעמים
  clearServiceWorkersAndCache();
  setTimeout(clearServiceWorkersAndCache, 100);
  setTimeout(clearServiceWorkersAndCache, 500);
  
  // מחיקה לפני רענון/סגירה
  window.addEventListener('beforeunload', () => {
    clearServiceWorkersAndCache();
  });
  
  // מחיקה גם ב-visibilitychange (כשהדף נסגר/נפתח)
  document.addEventListener('visibilitychange', () => {
    clearServiceWorkersAndCache();
  });
  
  // מחיקה גם ב-focus (כשהדף חוזר להיות פעיל)
  window.addEventListener('focus', () => {
    clearServiceWorkersAndCache();
  });
  
  // מניעת יצירת Service Workers חדשים - חזק מאוד
  if ('serviceWorker' in navigator) {
    // שמירת הפונקציות המקוריות (אם צריך)
    if (!window._originalServiceWorkerRegister) {
      window._originalServiceWorkerRegister = navigator.serviceWorker.register;
    }
    
    // חסימת register
    navigator.serviceWorker.register = function() {
      console.warn('🚫 נחסם ניסיון לרישום Service Worker');
      return Promise.reject(new Error('Service Workers disabled'));
    };
    
    // חסימת ready
    Object.defineProperty(navigator.serviceWorker, 'ready', {
      get: function() {
        return Promise.reject(new Error('Service Workers disabled'));
      },
      configurable: true,
      enumerable: false
    });
    
    // חסימת getRegistration
    navigator.serviceWorker.getRegistration = function() {
      return Promise.resolve(null);
    };
    
    // חסימת getRegistrations
    navigator.serviceWorker.getRegistrations = function() {
      return Promise.resolve([]);
    };
  }
  
  // הוספת version ל-URL כדי למנוע cache ישן - חזק יותר
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = args[0];
    if (typeof url === 'string') {
      // הוספת timestamp לכל בקשה
      const separator = url.includes('?') ? '&' : '?';
      args[0] = url + separator + '_v=' + Date.now() + '&_r=' + Math.random();
    }
    return originalFetch.apply(this, args);
  };
  
  // מניעת cache גם ב-XMLHttpRequest
  const originalXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    if (typeof url === 'string') {
      const separator = url.includes('?') ? '&' : '?';
      url = url + separator + '_v=' + Date.now();
    }
    return originalXHROpen.call(this, method, url, ...rest);
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

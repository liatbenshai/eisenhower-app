// מחיקת Service Workers ו-cache - אגרסיבי מאוד
if (typeof window !== 'undefined') {
  // מחיקת Service Workers - אגרסיבי
  if ('serviceWorker' in navigator) {
    // מחיקת כל ה-Service Workers מיד
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(reg => {
        reg.unregister().then(() => {
          console.log('✅ Service Worker נמחק');
        }).catch(() => {});
      });
    }).catch(() => {});
    
    // מניעת יצירת Service Workers חדשים - חזק יותר
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
  }
  
  // מחיקת כל ה-cache - אגרסיבי
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
      if (key.includes('service-worker') || key.includes('sw-')) {
        localStorage.removeItem(key);
      }
    });
    Object.keys(sessionStorage).forEach(key => {
      if (key.includes('service-worker') || key.includes('sw-')) {
        sessionStorage.removeItem(key);
      }
    });
  } catch (e) {}
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

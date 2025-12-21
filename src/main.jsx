// מחיקת Service Workers ו-cache - חזק יותר
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  // מחיקת כל ה-Service Workers
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(reg => {
      reg.unregister();
      console.log('✅ Service Worker נמחק');
    });
  });
  
  // מחיקת כל ה-cache
  if ('caches' in window) {
    caches.keys().then(cacheNames => {
      cacheNames.forEach(cacheName => {
        caches.delete(cacheName);
        console.log('✅ Cache נמחק:', cacheName);
      });
    });
  }
  
  // מניעת יצירת Service Workers חדשים
  navigator.serviceWorker.register = () => Promise.reject(new Error('Service Workers disabled'));
  navigator.serviceWorker.ready = Promise.reject(new Error('Service Workers disabled'));
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

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { TaskProvider } from './context/TaskContext';
import { NotificationProvider } from './context/NotificationContext';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <TaskProvider>
          <NotificationProvider>
            <App />
          </NotificationProvider>
        </TaskProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// רישום Service Worker שמוחק את עצמו
if ('serviceWorker' in navigator) {
  console.log('🔧 מנסה להסיר Service Worker ישן...');
  
  // האזנה להודעות מה-SW
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SW_REMOVED') {
      console.log('✅ Service Worker הוסר! מרענן את הדף בעוד 2 שניות...');
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    }
  });
  
  // רישום ה-SW החדש (המוחק את עצמו)
  navigator.serviceWorker.register('/sw.js')
    .then((registration) => {
      console.log('🔴 Service Worker נרשם (גרסת מחיקה עצמית)');
      
      // בדיקה אם יש עדכון
      registration.update();
      
      // אם זה עדכון, מחכים שהגרסה החדשה תיכנס
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      
      // האזנה לעדכונים
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        console.log('🔄 Service Worker חדש מותקן...');
        
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'activated') {
            console.log('✅ Service Worker חדש הופעל');
          }
        });
      });
    })
    .catch((err) => {
      console.warn('⚠️ שגיאה ברישום SW:', err);
      // גם אם נכשל, ננסה למחוק ידנית
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((reg) => {
          reg.unregister();
          console.log('🗑️ הוסר ידנית:', reg);
        });
      });
    });
  
  // ניקוי מטמונים במקביל
  if ('caches' in window) {
    caches.keys().then((names) => {
      names.forEach((name) => {
        caches.delete(name);
        console.log('🗑️ מטמון נמחק:', name);
      });
    });
  }
}


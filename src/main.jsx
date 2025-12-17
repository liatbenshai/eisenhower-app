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

// רישום Service Worker עם טיפול בעדכונים
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('✅ Service Worker נרשם בהצלחה');
        
        // בדיקת עדכונים כל 60 שניות
        setInterval(() => {
          registration.update();
        }, 60000);
        
        // האזנה לעדכון
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          console.log('🔄 Service Worker חדש נמצא');
          
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('✨ גרסה חדשה זמינה!');
              // הצג הודעה למשתמש
              if (confirm('יש גרסה חדשה! לחצ/י OK לרענן את האפליקציה')) {
                window.location.reload();
              }
            }
          });
        });
      })
      .catch((err) => {
        console.warn('⚠️ Service Worker לא נרשם:', err);
      });
  });

  // האזנה להודעות מה-Service Worker
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SW_UPDATED') {
      console.log('📢 Service Worker עודכן:', event.data.message);
      // רענון אוטומטי אחרי 3 שניות
      setTimeout(() => {
        console.log('🔄 מרענן את האפליקציה...');
        window.location.reload();
      }, 3000);
    }
  });
}


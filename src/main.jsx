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

// ביטול Service Worker זמני - עד לתיקון הבעיות
if ('serviceWorker' in navigator) {
  // מחיקת כל Service Workers קיימים
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister();
      console.log('🗑️ Service Worker הוסר:', registration);
    });
  });
  
  // ניקוי כל המטמונים
  if ('caches' in window) {
    caches.keys().then((names) => {
      names.forEach((name) => {
        caches.delete(name);
        console.log('🗑️ מטמון הוסר:', name);
      });
    });
  }
  
  console.log('✅ Service Worker מבוטל - האפליקציה תעבוד ללא מטמון');
}


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

// ניקוי Service Worker ישן ומטמונים - פעם אחת בלבד
if ('serviceWorker' in navigator) {
  // מחיקת כל ה-Service Workers הישנים
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    if (registrations.length > 0) {
      console.log('🧹 מוחק', registrations.length, 'Service Workers ישנים...');
      registrations.forEach((reg) => {
        reg.unregister().then(() => {
          console.log('✅ Service Worker נמחק');
        });
      });
    }
  });
  
  // מחיקת כל המטמונים הישנים
  if ('caches' in window) {
    caches.keys().then((names) => {
      if (names.length > 0) {
        console.log('🧹 מוחק', names.length, 'מטמונים...');
        names.forEach((name) => {
          caches.delete(name).then(() => {
            console.log('✅ מטמון נמחק:', name);
          });
        });
      }
    });
  }
  
  console.log('✨ אפליקציה פועלת ללא Service Worker - ללא בעיות רענון!');
}


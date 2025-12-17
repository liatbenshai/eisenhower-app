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

// ניקוי חד-פעמי של Service Worker ומטמונים ישנים
// קוד זה ירוץ פעם אחת ויסיר את כל השאריות
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    if (registrations.length > 0) {
      console.log('🧹 מוחק', registrations.length, 'Service Workers ישנים...');
      registrations.forEach((reg) => {
        reg.unregister().then(() => {
          console.log('✅ Service Worker הוסר');
        });
      });
    } else {
      console.log('✅ אין Service Workers לניקוי');
    }
  });
}

// ניקוי מטמונים ישנים
if ('caches' in window) {
  caches.keys().then((names) => {
    if (names.length > 0) {
      console.log('🧹 מוחק', names.length, 'מטמונים ישנים...');
      names.forEach((name) => {
        caches.delete(name).then(() => {
          console.log('✅ מטמון הוסר:', name);
        });
      });
    } else {
      console.log('✅ אין מטמונים לניקוי');
    }
  });
}

console.log('✨ האפליקציה פועלת ללא Service Worker - רענון חופשי!');


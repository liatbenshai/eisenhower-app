/**
 * שירות התראות Push
 */

// בדיקה אם הדפדפן תומך בהתראות
export function isNotificationSupported() {
  return 'Notification' in window && 'serviceWorker' in navigator;
}

// בדיקת סטטוס הרשאה
export function getNotificationPermission() {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * בקשת הרשאה להתראות
 */
export async function requestNotificationPermission() {
  if (!isNotificationSupported()) {
    console.warn('התראות לא נתמכות בדפדפן זה');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (error) {
    console.error('שגיאה בבקשת הרשאה להתראות:', error);
    return false;
  }
}

/**
 * שליחת התראה מקומית
 */
export function sendLocalNotification(title, options = {}) {
  if (getNotificationPermission() !== 'granted') {
    console.warn('אין הרשאה להתראות');
    return null;
  }

  const defaultOptions = {
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    dir: 'rtl',
    lang: 'he',
    vibrate: [200, 100, 200],
    requireInteraction: false,
    ...options
  };

  try {
    const notification = new Notification(title, defaultOptions);
    
    notification.onclick = () => {
      window.focus();
      notification.close();
      if (options.onClick) options.onClick();
    };

    return notification;
  } catch (error) {
    console.error('שגיאה בשליחת התראה:', error);
    return null;
  }
}

/**
 * התראת משימה
 */
export function notifyTask(task) {
  return sendLocalNotification(`תזכורת: ${task.title}`, {
    body: task.description || 'הגיע הזמן לטפל במשימה זו',
    tag: `task-${task.id}`,
    data: { taskId: task.id },
    onClick: () => {
      window.location.href = '/dashboard';
    }
  });
}

/**
 * תזמון התראה עתידית
 */
export function scheduleNotification(task, minutesBefore = 15) {
  if (!task.due_date) return null;

  const dueDateTime = new Date(`${task.due_date}T${task.due_time || '09:00'}`);
  const notifyAt = new Date(dueDateTime.getTime() - minutesBefore * 60 * 1000);
  const now = new Date();

  // אם הזמן כבר עבר, לא מתזמנים
  if (notifyAt <= now) return null;

  const delay = notifyAt.getTime() - now.getTime();

  // שמירת ה-timeout ID לביטול אפשרי
  const timeoutId = setTimeout(() => {
    notifyTask(task);
  }, delay);

  return timeoutId;
}

/**
 * ביטול התראה מתוזמנת
 */
export function cancelScheduledNotification(timeoutId) {
  if (timeoutId) {
    clearTimeout(timeoutId);
  }
}

/**
 * רישום ל-Push Notifications דרך Service Worker
 */
export async function subscribeToPush() {
  if (!isNotificationSupported()) return null;

  try {
    // בדיקה שאין Service Workers - אם יש, לא נמשיך
    // נשתמש בפונקציה המקורית אם יש, אחרת נבדוק ישירות
    if ('serviceWorker' in navigator) {
      let registrations = [];
      try {
        // ננסה להשתמש בפונקציה המקורית אם יש
        if (window._originalGetRegistrations) {
          registrations = await window._originalGetRegistrations.call(navigator.serviceWorker);
        } else {
          // אם אין, ננסה דרך אחרת
          registrations = await navigator.serviceWorker.getRegistrations();
        }
      } catch (e) {
        // אם יש שגיאה, אין Service Workers
        console.log('ℹ️ אין Service Worker - Push Notifications לא זמינים');
        return null;
      }
      
      if (registrations.length === 0) {
        console.log('ℹ️ אין Service Worker - Push Notifications לא זמינים');
        return null;
      }
    }
    
    // ננסה לגשת ל-ready - אם זה נחסם, נחזיר null
    let registration;
    try {
      registration = await navigator.serviceWorker.ready;
    } catch (e) {
      console.log('ℹ️ Service Worker לא זמין - Push Notifications לא זמינים');
      return null;
    }
    
    // בדיקה אם כבר רשום
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      // יצירת רישום חדש
      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      
      if (!vapidPublicKey) {
        console.warn('חסר VAPID public key');
        return null;
      }

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });
    }

    return subscription;
  } catch (error) {
    console.error('שגיאה ברישום ל-Push:', error);
    return null;
  }
}

/**
 * ביטול רישום Push
 */
export async function unsubscribeFromPush() {
  try {
    // בדיקה שאין Service Workers
    if ('serviceWorker' in navigator) {
      let registrations = [];
      try {
        // ננסה להשתמש בפונקציה המקורית אם יש
        if (window._originalGetRegistrations) {
          registrations = await window._originalGetRegistrations.call(navigator.serviceWorker);
        } else {
          registrations = await navigator.serviceWorker.getRegistrations();
        }
      } catch (e) {
        // אם יש שגיאה, אין Service Workers
        return false;
      }
      
      if (registrations.length === 0) {
        return false;
      }
    }
    
    // ננסה לגשת ל-ready - אם זה נחסם, נחזיר false
    let registration;
    try {
      registration = await navigator.serviceWorker.ready;
    } catch (e) {
      return false;
    }
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await subscription.unsubscribe();
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('שגיאה בביטול רישום Push:', error);
    return false;
  }
}

// המרת VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  
  return outputArray;
}

export default {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  sendLocalNotification,
  notifyTask,
  scheduleNotification,
  cancelScheduledNotification,
  subscribeToPush,
  unsubscribeFromPush
};


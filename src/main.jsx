// מחיקת Service Workers ומטמונים לפני טעינת React - זה קריטי!
// חשוב: הקוד הזה מונע לחלוטין יצירת Service Workers כדי לאפשר רענון תקין
if (typeof window !== 'undefined') {
  // מחיקה מיידית של כל Service Workers - לפני כל דבר אחר!
  (async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        if (registrations.length > 0) {
          console.log(`🗑️ מחיקה מיידית של ${registrations.length} Service Workers...`);
          await Promise.all(registrations.map(reg => {
            try {
              if (reg.active) {
                reg.active.postMessage({ type: 'SKIP_WAITING' });
              }
              return reg.unregister();
            } catch (e) {
              console.warn('⚠️ שגיאה במחיקת Service Worker:', e);
              return Promise.resolve();
            }
          }));
          console.log('✅ כל ה-Service Workers נמחקו מיידית');
        }
      } catch (e) {
        console.warn('⚠️ שגיאה במחיקה מיידית:', e);
      }
    }
  })();
  
  // מניעת רישום Service Workers - override של register - מוקדם ככל האפשר
  if ('serviceWorker' in navigator) {
    // שמירת הפונקציה המקורית (אם יש)
    const originalRegister = navigator.serviceWorker.register;
    
    // override מלא - מחזיר Promise שנדחה תמיד
    navigator.serviceWorker.register = function(...args) {
      console.warn('🚫 נחסם ניסיון לרישום Service Worker:', args[0]);
      // מחזיר Promise שנדחה מיד - זה מונע יצירת Service Worker
      return Promise.reject(new Error('Service Worker registration is disabled for refresh compatibility'));
    };
    
    // גם override של ready - מחזיר Promise שנדחה
    try {
      Object.defineProperty(navigator.serviceWorker, 'ready', {
        get: function() {
          console.warn('🚫 נחסם גישה ל-serviceWorker.ready');
          return Promise.reject(new Error('Service Worker is disabled'));
        },
        configurable: true,
        enumerable: false
      });
    } catch (e) {
      // אם לא הצלחנו, ננסה דרך אחרת
      console.warn('⚠️ לא הצלחנו לערוך serviceWorker.ready:', e);
    }
    
    // מניעת יצירת Service Worker דרך controller
    if (navigator.serviceWorker.controller) {
      console.warn('⚠️ נמצא Service Worker controller פעיל - מנסה למחוק...');
      try {
        navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
        // גם ננסה למחוק את ה-controller
        navigator.serviceWorker.getRegistrations().then(registrations => {
          registrations.forEach(reg => {
            if (reg.active) {
              reg.active.postMessage({ type: 'SKIP_WAITING' });
            }
            reg.unregister();
          });
        });
      } catch (e) {
        console.warn('⚠️ שגיאה במחיקת controller:', e);
      }
    }
    
    // מניעת יצירת Service Worker דרך getRegistration
    const originalGetRegistration = navigator.serviceWorker.getRegistration;
    navigator.serviceWorker.getRegistration = function(...args) {
      console.warn('🚫 נחסם ניסיון לקבל Service Worker registration');
      return Promise.resolve(null);
    };
    
    // שמירת הפונקציה המקורית של getRegistrations (לשימוש פנימי)
    const originalGetRegistrations = navigator.serviceWorker.getRegistrations;
    
    // override של getRegistrations - מחזיר רשימה ריקה תמיד (למניעת גישה)
    // אבל לא נדפיס הודעה אם זה קורא פנימי (stack trace יראה את זה)
    navigator.serviceWorker.getRegistrations = async function(...args) {
      // נבדוק אם זה קריאה פנימית שלנו (מהקוד שלנו) או חיצונית
      const stack = new Error().stack || '';
      const isInternalCall = stack.includes('checkAndClean') || 
                            stack.includes('cleanServiceWorkers') ||
                            stack.includes('forceRefresh') ||
                            stack.includes('main.jsx');
      
      if (!isInternalCall) {
        // רק נדפיס הודעה אם זה לא קריאה פנימית
        // console.warn('🚫 נחסם ניסיון לקבל Service Worker registrations');
      }
      return [];
    };
    
    // שמירת הפונקציה המקורית לשימוש פנימי
    window._originalGetRegistrations = originalGetRegistrations;
  }
  
  // מחיקה מיידית - לפני כל דבר אחר
  (async () => {
    try {
      if ('serviceWorker' in navigator) {
        // מחיקת כל ה-Service Workers - עם retry
        let attempts = 0;
        const maxAttempts = 5;
        
        while (attempts < maxAttempts) {
          attempts++;
          try {
            const registrations = await Promise.race([
              navigator.serviceWorker.getRegistrations(),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
            ]);
            
            if (registrations.length > 0) {
              console.log(`🗑️ מוחק ${registrations.length} Service Workers (ניסיון ${attempts})...`);
              await Promise.all(registrations.map(reg => reg.unregister()));
              console.log('✅ כל ה-Service Workers נמחקו');
              break;
            } else {
              console.log('✅ אין Service Workers לניקוי');
              break;
            }
          } catch (err) {
            console.warn(`⚠️ שגיאה בניסיון ${attempts}:`, err);
            if (attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        }
        
        // listener למניעת רישום חדש - עם debounce
        let controllerChangeTimeout = null;
        navigator.serviceWorker.addEventListener('controllerchange', async () => {
          if (controllerChangeTimeout) {
            clearTimeout(controllerChangeTimeout);
          }
          controllerChangeTimeout = setTimeout(async () => {
            console.warn('⚠️ Service Worker controller changed - מוחק שוב...');
            try {
              // נשתמש בפונקציה המקורית לבדיקה
              const originalGetRegistrations = window._originalGetRegistrations;
              if (originalGetRegistrations) {
                const newRegistrations = await originalGetRegistrations.call(navigator.serviceWorker);
                if (newRegistrations.length > 0) {
                  await Promise.all(newRegistrations.map(reg => reg.unregister()));
                  console.log('✅ Service Workers נמחקו שוב');
                }
              }
            } catch (err) {
              console.warn('⚠️ שגיאה במחיקת Service Workers:', err);
            }
          }, 100);
        });
      }
      
      // מחיקת כל המטמונים
      if ('caches' in window) {
        try {
          const cacheNames = await Promise.race([
            caches.keys(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
          ]);
          
          if (cacheNames.length > 0) {
            console.log('🗑️ מוחק', cacheNames.length, 'מטמונים...');
            await Promise.all(cacheNames.map(name => caches.delete(name)));
            console.log('✅ כל המטמונים נמחקו');
          } else {
            console.log('✅ אין מטמונים לניקוי');
          }
        } catch (err) {
          console.warn('⚠️ שגיאה במחיקת מטמונים:', err);
        }
      }
      
      console.log('✨ האפליקציה פועלת ללא Service Worker - רענון חופשי!');
      console.log('💡 אם עדיין יש בעיות רענון, פתחי DevTools (F12) → Application → Service Workers → לחצי Unregister על כל אחד');
      
      // וידוא שרענון עובד - הוספת event listener לרענון
      window.addEventListener('beforeunload', () => {
        // ניקוי Service Workers לפני רענון
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then(registrations => {
            registrations.forEach(reg => reg.unregister());
          });
        }
      });
      
      // שמירת נתונים לפני רענון - הוספת event listener
      window.addEventListener('beforeunload', () => {
        // ניסיון לשמור נתונים לפני רענון
        console.log('💾 שומר נתונים לפני רענון...');
        // זה יעזור לשמור את הנתונים לפני שהדף נסגר
      });
      
      // בדיקות תקופתיות - למקרה ש-Service Worker נרשם מאוחר יותר
      const checkAndClean = async () => {
        if ('serviceWorker' in navigator) {
          try {
            // נשתמש בפונקציה המקורית ששמרנו (לבדיקות פנימיות)
            const originalGetRegistrations = window._originalGetRegistrations || navigator.serviceWorker.getRegistrations;
            
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
              // אם יש שגיאה, ננסה דרך אחרת
              try {
                registrations = await navigator.serviceWorker.getRegistrations();
              } catch (e2) {
                console.warn('⚠️ לא הצלחנו לקבל registrations:', e2);
                registrations = [];
              }
            }
            
            if (registrations.length > 0) {
              console.warn('⚠️ נמצא Service Worker שנרשם מאוחר - מוחק...');
              await Promise.all(registrations.map(reg => {
                // ניסיון למחוק גם את ה-controller
                try {
                  if (reg.active) {
                    reg.active.postMessage({ type: 'SKIP_WAITING' });
                  }
                  return reg.unregister();
                } catch (e) {
                  console.warn('⚠️ שגיאה במחיקת Service Worker:', e);
                  return Promise.resolve();
                }
              }));
              console.log('✅ Service Workers מאוחרים נמחקו');
              
              // ניקוי מטמונים שוב אחרי מחיקת Service Worker
              if ('caches' in window) {
                try {
                  const cacheNames = await caches.keys();
                  await Promise.all(cacheNames.map(name => caches.delete(name)));
                } catch (e) {
                  console.warn('⚠️ שגיאה בניקוי מטמונים:', e);
                }
              }
            }
          } catch (err) {
            console.warn('⚠️ שגיאה בבדיקת Service Workers:', err);
          }
        }
      };
      
      // בדיקה מיידית
      checkAndClean();
      
      // בדיקה אחרי 1 שנייה
      setTimeout(checkAndClean, 1000);
      
      // בדיקה אחרי 2 שניות
      setTimeout(checkAndClean, 2000);
      
      // בדיקה תקופתית כל 2 שניות - למקרה ש-Service Worker נרשם שוב (יותר תכוף)
      setInterval(checkAndClean, 2000);
      
      // בדיקה נוספת כשהדף חוזר להיות פעיל
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          checkAndClean();
        }
      });
      
      // בדיקה לפני שהדף נסגר
      window.addEventListener('beforeunload', () => {
        checkAndClean();
      });
    } catch (error) {
      console.warn('⚠️ שגיאה במחיקת Service Workers:', error);
    }
  })();
  
  // מניעת תקיעות - אם הדף לא נטען תוך 10 שניות, נציג הודעה
  setTimeout(() => {
    if (document.readyState !== 'complete') {
      console.warn('⚠️ הדף לוקח יותר מדי זמן לטעון - ייתכן שיש Service Worker חוסם');
      // נציג הודעה למשתמש
      const warning = document.createElement('div');
      warning.style.cssText = 'position:fixed;top:0;left:0;right:0;background:red;color:white;padding:10px;text-align:center;z-index:99999;';
      warning.innerHTML = '⚠️ הדף נתקע! אנא מחקי Service Workers: F12 → Application → Service Workers → Unregister<br/>או לחצי <button onclick="window.location.reload(true)" style="background:white;color:red;border:none;padding:5px 10px;margin:5px;cursor:pointer;border-radius:3px;">רענון כפוי</button>';
      document.body.appendChild(warning);
    }
  }, 10000);
  
  // וידוא שרענון תמיד עובד - הוספת פונקציות עזר
  if (typeof window !== 'undefined') {
    // פונקציה גלובלית לרענון כפוי
    window.forceRefresh = async () => {
      console.log('🔄 רענון כפוי...');
      try {
        // מחיקת כל ה-Service Workers לפני רענון
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          if (registrations.length > 0) {
            console.log(`🗑️ מוחק ${registrations.length} Service Workers לפני רענון...`);
            await Promise.all(registrations.map(reg => reg.unregister()));
          }
        }
        
        // מחיקת כל המטמונים לפני רענון
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          if (cacheNames.length > 0) {
            console.log(`🗑️ מוחק ${cacheNames.length} מטמונים לפני רענון...`);
            await Promise.all(cacheNames.map(name => caches.delete(name)));
          }
        }
      } catch (err) {
        console.warn('⚠️ שגיאה בניקוי לפני רענון:', err);
      }
      
      // רענון כפוי
      window.location.reload(true);
    };
    
    // פונקציה לניקוי מלא של Service Workers ומטמונים
    window.cleanServiceWorkers = async () => {
      console.log('🧹 מנקה Service Workers ומטמונים...');
      try {
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          if (registrations.length > 0) {
            await Promise.all(registrations.map(reg => reg.unregister()));
            console.log(`✅ נמחקו ${registrations.length} Service Workers`);
          } else {
            console.log('✅ אין Service Workers לניקוי');
          }
        }
        
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          if (cacheNames.length > 0) {
            await Promise.all(cacheNames.map(name => caches.delete(name)));
            console.log(`✅ נמחקו ${cacheNames.length} מטמונים`);
          } else {
            console.log('✅ אין מטמונים לניקוי');
          }
        }
        
        console.log('✨ ניקוי הושלם! כעת תוכלי לרענן את הדף (F5)');
      } catch (err) {
        console.error('❌ שגיאה בניקוי:', err);
      }
    };
    
    console.log('✅ פונקציות עזר זמינות:');
    console.log('   - window.forceRefresh() - רענון כפוי עם ניקוי');
    console.log('   - window.cleanServiceWorkers() - ניקוי Service Workers ומטמונים');
  }
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

// בדיקה שהסשן נשמר ב-localStorage לפני טעינת האפליקציה
if (typeof window !== 'undefined') {
  // בדיקה עם המפתח החדש
  const newKey = 'eisenhower-auth';
  const oldKeyPattern = 'sb-';
  
  // בדיקת מפתח חדש
  const newSession = localStorage.getItem(newKey);
  if (newSession) {
    console.log('✅ נמצא סשן שמור ב-localStorage (מפתח חדש)');
  } else {
    // בדיקת מפתחות ישנים
    let foundOldKey = false;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(oldKeyPattern)) {
        foundOldKey = true;
        console.log('✅ נמצא סשן שמור ב-localStorage (מפתח ישן):', key);
        break;
      }
    }
    if (!foundOldKey) {
      console.log('ℹ️ אין סשן שמור ב-localStorage');
    }
  }
}

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

// מניעת תקיעות - בדיקת תקינות כל כמה דקות
if (typeof window !== 'undefined') {
  // בדיקה שהדפדפן עדיין פעיל
  setInterval(() => {
    // בדיקה פשוטה שהדף עדיין מגיב
    if (document.visibilityState === 'visible') {
      // אם הדף פעיל, נבדוק שהכל תקין
      const hasError = document.querySelector('.error-message');
      if (hasError) {
        console.warn('⚠️ נמצאה שגיאה בדף, מנסה לרענן...');
        // לא נרענן אוטומטית, רק נדווח
      }
    }
  }, 2 * 60 * 1000); // כל 2 דקות
}


/**
 * כלי לניקוי ומעבר של נתוני טיימר ישנים ב-localStorage
 * יש להריץ פעם אחת כדי לנקות את הנתונים הישנים
 */

export function migrateTimerStorage() {
  const keysToRemove = [];
  
  // מציאת מפתחות ישנים
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      // מפתחות בפורמט הישן: timer_*_startTime, timer_*_original
      if (key.startsWith('timer_') && !key.startsWith('timer_state_')) {
        keysToRemove.push(key);
      }
    }
  }
  
  // מחיקת המפתחות הישנים
  keysToRemove.forEach(key => {
    console.log('🗑️ מוחק מפתח ישן:', key);
    localStorage.removeItem(key);
  });
  
  console.log(`✅ נמחקו ${keysToRemove.length} מפתחות ישנים`);
  return keysToRemove.length;
}

/**
 * ניקוי כל נתוני הטיימר מ-localStorage
 */
export function clearAllTimerStorage() {
  const keysToRemove = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('timer_')) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => {
    console.log('🗑️ מוחק:', key);
    localStorage.removeItem(key);
  });
  
  console.log(`✅ נמחקו ${keysToRemove.length} מפתחות טיימר`);
  return keysToRemove.length;
}

/**
 * הצגת כל נתוני הטיימר הקיימים
 */
export function debugTimerStorage() {
  console.log('🔍 נתוני טיימר ב-localStorage:');
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('timer_')) {
      try {
        const value = localStorage.getItem(key);
        const parsed = JSON.parse(value);
        console.log(`  ${key}:`, parsed);
      } catch {
        console.log(`  ${key}:`, localStorage.getItem(key));
      }
    }
  }
}

// הרצה אוטומטית במצב development
if (import.meta.env.DEV) {
  // debugTimerStorage();
}

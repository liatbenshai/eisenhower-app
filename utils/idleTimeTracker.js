/**
 * מעקב זמן מת - זמן בין משימות
 * 
 * עוקב אחרי זמן שעובר כשאין משימה פעילה
 */

const STORAGE_KEY = 'idle_time_tracking';
const IDLE_START_KEY = 'idle_start_time';

/**
 * קבלת תאריך היום בפורמט ISO
 */
function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

/**
 * טעינת נתוני זמן מת מ-localStorage
 */
export function loadIdleData() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch (err) {
    console.error('שגיאה בטעינת נתוני זמן מת:', err);
    return {};
  }
}

/**
 * שמירת נתוני זמן מת
 */
function saveIdleData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('שגיאה בשמירת נתוני זמן מת:', err);
  }
}

/**
 * התחלת מעקב זמן מת (כשמשהים משימה)
 */
export function startIdleTracking() {
  const now = new Date().toISOString();
  localStorage.setItem(IDLE_START_KEY, now);
  console.log('⏸️ התחלת מעקב זמן מת:', now);
}

/**
 * עצירת מעקב זמן מת (כשמתחילים משימה)
 * @returns {number} - מספר הדקות שעברו
 */
export function stopIdleTracking() {
  const startTimeStr = localStorage.getItem(IDLE_START_KEY);
  
  if (!startTimeStr) {
    return 0;
  }
  
  const startTime = new Date(startTimeStr);
  const now = new Date();
  const idleMinutes = Math.floor((now - startTime) / (1000 * 60));
  
  // שמור רק אם עבר לפחות דקה
  if (idleMinutes >= 1) {
    const todayKey = getTodayKey();
    const data = loadIdleData();
    
    if (!data[todayKey]) {
      data[todayKey] = {
        totalMinutes: 0,
        periods: []
      };
    }
    
    data[todayKey].totalMinutes += idleMinutes;
    data[todayKey].periods.push({
      start: startTimeStr,
      end: now.toISOString(),
      minutes: idleMinutes
    });
    
    saveIdleData(data);
    console.log(`⏱️ נוסף זמן מת: ${idleMinutes} דקות. סה"כ היום: ${data[todayKey].totalMinutes} דקות`);
  }
  
  // נקה את זמן ההתחלה
  localStorage.removeItem(IDLE_START_KEY);
  
  return idleMinutes;
}

/**
 * בדיקה אם יש מעקב זמן מת פעיל
 */
export function isIdleTrackingActive() {
  return !!localStorage.getItem(IDLE_START_KEY);
}

/**
 * קבלת זמן מת נוכחי (אם פעיל)
 * @returns {number} - דקות מאז תחילת הזמן המת
 */
export function getCurrentIdleMinutes() {
  const startTimeStr = localStorage.getItem(IDLE_START_KEY);
  
  if (!startTimeStr) {
    return 0;
  }
  
  const startTime = new Date(startTimeStr);
  const now = new Date();
  return Math.floor((now - startTime) / (1000 * 60));
}

/**
 * קבלת סטטיסטיקות זמן מת להיום
 */
export function getTodayIdleStats() {
  const todayKey = getTodayKey();
  const data = loadIdleData();
  
  const todayData = data[todayKey] || { totalMinutes: 0, periods: [] };
  
  // הוסף זמן מת נוכחי אם פעיל
  const currentIdle = getCurrentIdleMinutes();
  
  return {
    totalMinutes: todayData.totalMinutes + currentIdle,
    savedMinutes: todayData.totalMinutes,
    currentIdleMinutes: currentIdle,
    periodsCount: todayData.periods.length,
    periods: todayData.periods,
    isCurrentlyIdle: isIdleTrackingActive()
  };
}

/**
 * קבלת סטטיסטיקות לתאריך ספציפי
 */
export function getIdleStatsForDate(dateStr) {
  const data = loadIdleData();
  return data[dateStr] || { totalMinutes: 0, periods: [] };
}

/**
 * קבלת סטטיסטיקות לשבוע האחרון
 */
export function getWeeklyIdleStats() {
  const data = loadIdleData();
  const stats = [];
  
  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const dayData = data[dateStr] || { totalMinutes: 0, periods: [] };
    
    stats.push({
      date: dateStr,
      dayName: ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][date.getDay()],
      totalMinutes: dayData.totalMinutes,
      periodsCount: dayData.periods?.length || 0
    });
  }
  
  return stats.reverse(); // מהישן לחדש
}

/**
 * ניקוי נתונים ישנים (מעל 30 יום)
 */
export function cleanOldIdleData() {
  const data = loadIdleData();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoffStr = thirtyDaysAgo.toISOString().split('T')[0];
  
  let cleaned = 0;
  for (const dateStr of Object.keys(data)) {
    if (dateStr < cutoffStr) {
      delete data[dateStr];
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    saveIdleData(data);
    console.log(`🧹 נוקו ${cleaned} ימים ישנים של נתוני זמן מת`);
  }
}

/**
 * פורמט דקות לתצוגה
 */
export function formatIdleTime(minutes) {
  if (minutes < 60) {
    return `${minutes} דק'`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return hours === 1 ? 'שעה' : `${hours} שעות`;
  }
  return `${hours}:${mins.toString().padStart(2, '0')}`;
}

// ניקוי אוטומטי בטעינה
cleanOldIdleData();

export default {
  startIdleTracking,
  stopIdleTracking,
  isIdleTrackingActive,
  getCurrentIdleMinutes,
  getTodayIdleStats,
  getIdleStatsForDate,
  getWeeklyIdleStats,
  formatIdleTime
};

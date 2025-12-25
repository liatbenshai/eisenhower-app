/**
 * הגדרות לוח זמנים ושעות עבודה
 * ================================
 * קובץ זה מכיל את כל ההגדרות הקשורות לזמן עבודה זמין
 */

/**
 * שעות עבודה לפי יום
 * ימים: 0 = ראשון, 1 = שני, ... , 6 = שבת
 */
export const WORK_HOURS = {
  0: { start: 8, end: 16, enabled: true, name: 'ראשון' },   // ראשון
  1: { start: 8, end: 16, enabled: true, name: 'שני' },     // שני
  2: { start: 8, end: 16, enabled: true, name: 'שלישי' },   // שלישי
  3: { start: 8, end: 16, enabled: true, name: 'רביעי' },   // רביעי
  4: { start: 8, end: 16, enabled: true, name: 'חמישי' },   // חמישי
  5: { start: null, end: null, enabled: false, name: 'שישי' },  // שישי - לא עובדים
  6: { start: null, end: null, enabled: false, name: 'שבת' }    // שבת - לא עובדים
};

/**
 * אחוז מרווח לבלת"מים והפרעות
 * 25% = רבע מהזמן שמור לדברים לא צפויים
 */
export const BUFFER_PERCENTAGE = 25;

/**
 * הגדרות נוספות
 */
export const SCHEDULE_CONFIG = {
  // זמן מינימלי בין משימות (דקות)
  minBreakBetweenTasks: 5,
  
  // משך מינימלי למשימה (דקות)
  minTaskDuration: 15,
  
  // משך מקסימלי למשימה רציפה לפני הפסקה מומלצת (דקות)
  maxContinuousWork: 90,
  
  // גודל מקטע מקסימלי לפיצול משימות ארוכות (דקות)
  maxChunkSize: 45,
  
  // שעת התחלה מומלצת למשימות קשות
  peakEnergyStart: 9,
  peakEnergyEnd: 12
};

/**
 * חישוב דקות עבודה ביום מסוים
 * @param {number} dayOfWeek - יום בשבוע (0-6)
 * @returns {number} דקות עבודה
 */
export function getWorkMinutesForDay(dayOfWeek) {
  const dayConfig = WORK_HOURS[dayOfWeek];
  if (!dayConfig || !dayConfig.enabled) return 0;
  return (dayConfig.end - dayConfig.start) * 60;
}

/**
 * חישוב דקות זמינות לתכנון (אחרי מרווח בלת"מים)
 * @param {number} dayOfWeek - יום בשבוע (0-6)
 * @returns {number} דקות זמינות
 */
export function getAvailableMinutesForDay(dayOfWeek) {
  const totalMinutes = getWorkMinutesForDay(dayOfWeek);
  const bufferMinutes = Math.round(totalMinutes * (BUFFER_PERCENTAGE / 100));
  return totalMinutes - bufferMinutes;
}

/**
 * חישוב דקות מרווח (בלת"מים) ליום
 * @param {number} dayOfWeek - יום בשבוע (0-6)
 * @returns {number} דקות מרווח
 */
export function getBufferMinutesForDay(dayOfWeek) {
  const totalMinutes = getWorkMinutesForDay(dayOfWeek);
  return Math.round(totalMinutes * (BUFFER_PERCENTAGE / 100));
}

/**
 * בדיקה האם יום מסוים הוא יום עבודה
 * @param {Date} date - תאריך
 * @returns {boolean}
 */
export function isWorkDay(date) {
  const dayOfWeek = date.getDay();
  return WORK_HOURS[dayOfWeek]?.enabled || false;
}

/**
 * קבלת שעות העבודה לתאריך מסוים
 * @param {Date} date - תאריך
 * @returns {object|null} { start, end } או null אם לא יום עבודה
 */
export function getWorkHoursForDate(date) {
  const dayOfWeek = date.getDay();
  const config = WORK_HOURS[dayOfWeek];
  if (!config || !config.enabled) return null;
  return { start: config.start, end: config.end };
}

/**
 * קבלת כל ימי העבודה בשבוע נתון
 * @param {Date} weekStart - תחילת השבוע (יום ראשון)
 * @returns {Date[]} מערך תאריכים של ימי עבודה
 */
export function getWorkDaysInWeek(weekStart) {
  const workDays = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    if (isWorkDay(date)) {
      workDays.push(date);
    }
  }
  return workDays;
}

/**
 * חישוב סה"כ דקות זמינות בשבוע
 * @returns {number} סה"כ דקות זמינות
 */
export function getTotalWeeklyAvailableMinutes() {
  let total = 0;
  for (let day = 0; day < 7; day++) {
    total += getAvailableMinutesForDay(day);
  }
  return total;
}

/**
 * פורמט שעה לתצוגה
 * @param {number} hour - שעה (0-23)
 * @param {number} minutes - דקות (0-59)
 * @returns {string} פורמט HH:MM
 */
export function formatTime(hour, minutes = 0) {
  return `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * פורמט דקות לתצוגה קריאה
 * @param {number} minutes - מספר דקות
 * @returns {string} פורמט קריא (לדוגמה: "2:30 שעות" או "45 דקות")
 */
export function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return '0 דקות';
  if (minutes < 60) return `${minutes} דקות`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours} שעות`;
  return `${hours}:${mins.toString().padStart(2, '0')} שעות`;
}

/**
 * סיכום הגדרות לתצוגה
 */
export function getScheduleSummary() {
  const workDays = Object.entries(WORK_HOURS)
    .filter(([_, config]) => config.enabled)
    .map(([day, config]) => ({
      day: parseInt(day),
      name: config.name,
      hours: `${formatTime(config.start)}-${formatTime(config.end)}`,
      totalMinutes: getWorkMinutesForDay(parseInt(day)),
      availableMinutes: getAvailableMinutesForDay(parseInt(day)),
      bufferMinutes: getBufferMinutesForDay(parseInt(day))
    }));

  return {
    workDays,
    bufferPercentage: BUFFER_PERCENTAGE,
    totalWeeklyMinutes: workDays.reduce((sum, d) => sum + d.totalMinutes, 0),
    availableWeeklyMinutes: workDays.reduce((sum, d) => sum + d.availableMinutes, 0),
    bufferWeeklyMinutes: workDays.reduce((sum, d) => sum + d.bufferMinutes, 0)
  };
}

export default {
  WORK_HOURS,
  BUFFER_PERCENTAGE,
  SCHEDULE_CONFIG,
  getWorkMinutesForDay,
  getAvailableMinutesForDay,
  getBufferMinutesForDay,
  isWorkDay,
  getWorkHoursForDate,
  getWorkDaysInWeek,
  getTotalWeeklyAvailableMinutes,
  formatTime,
  formatDuration,
  getScheduleSummary
};

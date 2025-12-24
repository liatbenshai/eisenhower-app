/**
 * עזרים לטיפול בתאריכים
 */

// חודשים בעברית
const MONTHS_HE = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
];

// ימים בעברית
const DAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

/**
 * פורמט תאריך לעברית
 */
export function formatDateHe(dateString, options = {}) {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const day = date.getDate();
  const month = MONTHS_HE[date.getMonth()];
  const year = date.getFullYear();
  
  if (options.short) {
    return `${day}/${date.getMonth() + 1}/${year}`;
  }
  
  if (options.withDay) {
    const dayName = DAYS_HE[date.getDay()];
    return `יום ${dayName}, ${day} ב${month} ${year}`;
  }
  
  return `${day} ב${month} ${year}`;
}

/**
 * פורמט שעה
 */
export function formatTime(timeString) {
  if (!timeString) return '';
  return timeString.slice(0, 5); // HH:MM
}

/**
 * פורמט תאריך ושעה יחד
 */
export function formatDateTime(dateString, timeString) {
  const dateFormatted = formatDateHe(dateString);
  if (!dateFormatted) return '';
  
  if (timeString) {
    return `${dateFormatted} בשעה ${formatTime(timeString)}`;
  }
  
  return dateFormatted;
}

/**
 * קבלת תאריך יחסי (היום, אתמול, מחר וכו')
 */
export function getRelativeDate(dateString) {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const dateStr = date.toISOString().split('T')[0];
  const todayStr = today.toISOString().split('T')[0];
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  
  if (dateStr === todayStr) return 'היום';
  if (dateStr === yesterdayStr) return 'אתמול';
  if (dateStr === tomorrowStr) return 'מחר';
  
  // בשבוע הקרוב
  const daysUntil = Math.floor((date - today) / (1000 * 60 * 60 * 24));
  if (daysUntil > 1 && daysUntil <= 7) {
    return `ביום ${DAYS_HE[date.getDay()]}`;
  }
  
  return formatDateHe(dateString, { short: true });
}

/**
 * חישוב זמן יחסי (לפני X דקות/שעות/ימים)
 */
export function getTimeAgo(dateString) {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSeconds < 60) return 'עכשיו';
  if (diffMinutes < 60) return `לפני ${diffMinutes} דקות`;
  if (diffHours < 24) return `לפני ${diffHours} שעות`;
  if (diffDays === 1) return 'אתמול';
  if (diffDays < 7) return `לפני ${diffDays} ימים`;
  if (diffDays < 30) return `לפני ${Math.floor(diffDays / 7)} שבועות`;
  
  return formatDateHe(dateString, { short: true });
}

/**
 * קבלת תאריך היום בפורמט ISO
 */
export function getTodayISO() {
  return new Date().toISOString().split('T')[0];
}

/**
 * קבלת תאריך מינימלי (היום)
 */
export function getMinDate() {
  return getTodayISO();
}

/**
 * בדיקה אם תאריך עבר
 */
export function isPastDate(dateString) {
  if (!dateString) return false;
  
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return date < today;
}

/**
 * הוספת ימים לתאריך
 */
export function addDays(dateString, days) {
  const date = new Date(dateString);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

/**
 * קבלת תאריך התחלת השבוע (ראשון)
 */
export function getWeekStart(dateString) {
  const date = new Date(dateString || new Date());
  const day = date.getDay();
  date.setDate(date.getDate() - day);
  return date.toISOString().split('T')[0];
}

/**
 * קבלת תאריך סוף השבוע (שבת)
 */
export function getWeekEnd(dateString) {
  const date = new Date(dateString || new Date());
  const day = date.getDay();
  date.setDate(date.getDate() + (6 - day));
  return date.toISOString().split('T')[0];
}

export default {
  formatDateHe,
  formatTime,
  formatDateTime,
  getRelativeDate,
  getTimeAgo,
  getTodayISO,
  getMinDate,
  isPastDate,
  addDays,
  getWeekStart,
  getWeekEnd
};


/**
 * מציע חלונות זמן - גישה פרואקטיבית
 * 
 * במקום לחכות לקונפליקט, מציע מראש את הזמן האופטימלי
 * 
 * הגדרות ליאת:
 * - 7 שעות עבודה ביום (420 דקות)
 * - מתחילים ב-08:00
 * - הפסקה כל 90 דקות
 */

// הגדרות
export const SLOT_CONFIG = {
  // שעות עבודה
  WORK_START_HOUR: 8,
  WORK_START_MINUTE: 0,
  
  // קיבולת יומית בדקות (7 שעות)
  DAILY_CAPACITY_MINUTES: 420,
  
  // הפסקות
  BREAK_AFTER_MINUTES: 90,
  BREAK_DURATION: 10,
  
  // צהריים
  LUNCH_HOUR: 12,
  LUNCH_MINUTE: 30,
  LUNCH_DURATION: 30,
  
  // חיפוש
  MAX_DAYS_AHEAD: 14,
  WORK_DAYS: [0, 1, 2, 3, 4] // א-ה
};

/**
 * המרות זמן
 */
const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + (m || 0);
};

const minutesToTime = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const getDateISO = (date) => new Date(date).toISOString().split('T')[0];

const isWorkDay = (date) => SLOT_CONFIG.WORK_DAYS.includes(new Date(date).getDay());

/**
 * פורמט תאריך
 */
const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  if (getDateISO(date) === getDateISO(today)) return 'היום';
  if (getDateISO(date) === getDateISO(tomorrow)) return 'מחר';
  
  const days = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
  return `יום ${days[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1}`;
};

/**
 * קבלת משימות היום
 */
const getDayTasks = (date, tasks) => {
  const dateISO = getDateISO(date);
  return tasks
    .filter(t => {
      const taskDate = t.due_date || t.dueDate;
      const isCompleted = t.is_completed || t.isCompleted;
      return taskDate === dateISO && !isCompleted;
    })
    .map(t => ({
      id: t.id,
      title: t.title,
      time: t.due_time || t.dueTime,
      duration: t.estimated_duration || t.estimatedDuration || 30,
      priority: t.priority || 'normal'
    }))
    .filter(t => t.time) // רק משימות עם שעה
    .sort((a, b) => a.time.localeCompare(b.time));
};

/**
 * חישוב זמן תפוס ביום
 */
const getScheduledMinutes = (date, tasks) => {
  const dateISO = getDateISO(date);
  return tasks
    .filter(t => {
      const taskDate = t.due_date || t.dueDate;
      const isCompleted = t.is_completed || t.isCompleted;
      return taskDate === dateISO && !isCompleted;
    })
    .reduce((sum, t) => sum + (t.estimated_duration || t.estimatedDuration || 30), 0);
};

/**
 * מציאת חלון פנוי ביום
 */
const findSlotInDay = (date, duration, tasks) => {
  const dayTasks = getDayTasks(date, tasks);
  const workStart = SLOT_CONFIG.WORK_START_HOUR * 60 + SLOT_CONFIG.WORK_START_MINUTE;
  const lunchStart = SLOT_CONFIG.LUNCH_HOUR * 60 + SLOT_CONFIG.LUNCH_MINUTE;
  const lunchEnd = lunchStart + SLOT_CONFIG.LUNCH_DURATION;
  const workEnd = 17 * 60; // 17:00 מקסימום
  
  // בדיקה אם היום - לא מציעים שעות שעברו
  const now = new Date();
  const isToday = getDateISO(date) === getDateISO(now);
  let searchStart = workStart;
  
  if (isToday) {
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    searchStart = Math.max(workStart, Math.ceil((currentMinutes + 10) / 15) * 15);
  }
  
  // בניית רשימת חלונות תפוסים
  const occupied = [];
  
  // הפסקת צהריים
  occupied.push({ start: lunchStart, end: lunchEnd });
  
  // משימות קיימות
  dayTasks.forEach(t => {
    const start = timeToMinutes(t.time);
    occupied.push({ start, end: start + t.duration });
  });
  
  // מיון
  occupied.sort((a, b) => a.start - b.start);
  
  // חיפוש חלון פנוי
  let currentTime = searchStart;
  
  for (const slot of occupied) {
    // יש מקום לפני החלון התפוס?
    if (currentTime + duration <= slot.start) {
      return {
        time: minutesToTime(currentTime),
        endTime: minutesToTime(currentTime + duration)
      };
    }
    // מזיזים קדימה
    currentTime = Math.max(currentTime, slot.end);
  }
  
  // בדיקה אם יש מקום בסוף היום
  if (currentTime + duration <= workEnd) {
    return {
      time: minutesToTime(currentTime),
      endTime: minutesToTime(currentTime + duration)
    };
  }
  
  return null;
};

/**
 * הפונקציה הראשית - מציעה חלונות זמן למשימה חדשה
 */
export function suggestSlots(newTask, existingTasks) {
  const duration = newTask.estimatedDuration || newTask.estimated_duration || 30;
  const priority = newTask.priority || 'normal';
  
  const suggestions = [];
  let currentDate = new Date();
  
  // חיפוש עד 14 יום קדימה
  for (let i = 0; i < SLOT_CONFIG.MAX_DAYS_AHEAD && suggestions.length < 5; i++) {
    if (!isWorkDay(currentDate)) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }
    
    const dateISO = getDateISO(currentDate);
    const scheduled = getScheduledMinutes(currentDate, existingTasks);
    const remaining = SLOT_CONFIG.DAILY_CAPACITY_MINUTES - scheduled;
    
    // יש מספיק קיבולת?
    if (remaining >= duration) {
      const slot = findSlotInDay(currentDate, duration, existingTasks);
      
      if (slot) {
        suggestions.push({
          date: dateISO,
          dateLabel: formatDate(dateISO),
          time: slot.time,
          endTime: slot.endTime,
          displayText: `${formatDate(dateISO)} ב-${slot.time}`,
          loadPercent: Math.round((scheduled / SLOT_CONFIG.DAILY_CAPACITY_MINUTES) * 100),
          remainingMinutes: remaining - duration
        });
      }
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return {
    suggestions,
    bestOption: suggestions[0] || null,
    hasSuggestions: suggestions.length > 0
  };
}

/**
 * סיכום עומס יומי
 */
export function getDayLoad(date, tasks) {
  const scheduled = getScheduledMinutes(date, tasks);
  const capacity = SLOT_CONFIG.DAILY_CAPACITY_MINUTES;
  const dayTasks = getDayTasks(date, tasks);
  
  return {
    date: getDateISO(date),
    dateLabel: formatDate(date),
    scheduledMinutes: scheduled,
    remainingMinutes: capacity - scheduled,
    loadPercent: Math.round((scheduled / capacity) * 100),
    tasksCount: dayTasks.length,
    isFull: scheduled >= capacity * 0.9,
    isOverloaded: scheduled > capacity
  };
}

export default { suggestSlots, getDayLoad, SLOT_CONFIG };

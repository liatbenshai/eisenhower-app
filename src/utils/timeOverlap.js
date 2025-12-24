/**
 * שירותי בדיקת חפיפות זמנים
 */

/**
 * המרת שעה לדקות מתחילת היום
 */
export function timeToMinutes(timeStr) {
  if (!timeStr) return null;
  const [hours, mins] = timeStr.split(':').map(Number);
  return hours * 60 + (mins || 0);
}

/**
 * המרת דקות לשעה
 */
export function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * בדיקה האם שני טווחי זמן חופפים
 */
export function doTimesOverlap(start1, end1, start2, end2) {
  return start1 < end2 && start2 < end1;
}

/**
 * מציאת משימות חופפות
 * @param {Object} newTask - המשימה החדשה {dueDate, dueTime, estimatedDuration, id?}
 * @param {Array} existingTasks - רשימת המשימות הקיימות
 * @returns {Array} - רשימת המשימות החופפות
 */
export function findOverlappingTasks(newTask, existingTasks) {
  if (!newTask.dueDate || !newTask.dueTime) {
    return [];
  }

  const newStart = timeToMinutes(newTask.dueTime);
  const newDuration = newTask.estimatedDuration || 30;
  const newEnd = newStart + newDuration;

  return existingTasks.filter(task => {
    // התעלם מהמשימה עצמה (בעריכה)
    if (newTask.id && task.id === newTask.id) {
      return false;
    }

    // התעלם ממשימות שהושלמו
    if (task.is_completed) {
      return false;
    }

    // רק משימות באותו יום
    if (task.due_date !== newTask.dueDate) {
      return false;
    }

    // רק משימות עם שעה
    if (!task.due_time) {
      return false;
    }

    const taskStart = timeToMinutes(task.due_time);
    const taskDuration = task.estimated_duration || 30;
    const taskEnd = taskStart + taskDuration;

    return doTimesOverlap(newStart, newEnd, taskStart, taskEnd);
  });
}

/**
 * מציאת הזמן הפנוי הבא
 * @param {string} date - התאריך
 * @param {number} duration - משך המשימה בדקות
 * @param {Array} existingTasks - רשימת המשימות הקיימות
 * @param {number} startHour - שעת תחילת יום העבודה
 * @param {number} endHour - שעת סיום יום העבודה
 * @returns {string|null} - השעה הפנויה הבאה או null
 */
export function findNextFreeSlot(date, duration, existingTasks, startHour = 8, endHour = 16) {
  const dayStart = startHour * 60;
  const dayEnd = endHour * 60;

  // משימות של אותו יום, ממוינות לפי שעה
  const dayTasks = existingTasks
    .filter(t => t.due_date === date && t.due_time && !t.is_completed)
    .map(t => ({
      start: timeToMinutes(t.due_time),
      end: timeToMinutes(t.due_time) + (t.estimated_duration || 30)
    }))
    .sort((a, b) => a.start - b.start);

  // חיפוש חלון פנוי
  let currentTime = dayStart;

  for (const task of dayTasks) {
    // יש רווח לפני המשימה?
    if (currentTime + duration <= task.start) {
      return minutesToTime(currentTime);
    }
    // מעבר לסוף המשימה
    currentTime = Math.max(currentTime, task.end);
  }

  // בדיקה אם יש מקום אחרי המשימה האחרונה
  if (currentTime + duration <= dayEnd) {
    return minutesToTime(currentTime);
  }

  return null; // אין זמן פנוי
}

/**
 * פורמט דקות לתצוגה
 */
export function formatMinutes(minutes) {
  if (minutes < 60) return `${minutes} דק'`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours} שעות`;
  return `${hours}:${mins.toString().padStart(2, '0')}`;
}

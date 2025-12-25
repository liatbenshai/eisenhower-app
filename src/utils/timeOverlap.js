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
    if (task.is_completed || task.isCompleted) {
      return false;
    }

    // רק משימות באותו יום (תומך גם ב-snake_case וגם ב-camelCase)
    const taskDate = task.due_date || task.dueDate;
    if (taskDate !== newTask.dueDate) {
      return false;
    }

    // רק משימות עם שעה
    const taskTime = task.due_time || task.dueTime;
    if (!taskTime) {
      return false;
    }

    const taskStart = timeToMinutes(taskTime);
    const taskDuration = task.estimated_duration || task.estimatedDuration || 30;
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
export function findNextFreeSlot(date, duration, existingTasks, startHour = 8, endHour = 17) {
  const dayStart = startHour * 60;
  const dayEnd = endHour * 60;

  // בדיקה אם זה היום - אז לא מציעים שעות שעברו
  const today = new Date().toISOString().split('T')[0];
  const isToday = date === today;
  
  let earliestStart = dayStart;
  
  if (isToday) {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    // מעגלים למעלה ל-15 דקות הבאות
    earliestStart = Math.max(dayStart, Math.ceil(currentMinutes / 15) * 15);
  }

  // משימות של אותו יום, ממוינות לפי שעה (תומך גם ב-snake_case וגם ב-camelCase)
  const dayTasks = existingTasks
    .filter(t => {
      const taskDate = t.due_date || t.dueDate;
      const taskTime = t.due_time || t.dueTime;
      const isCompleted = t.is_completed || t.isCompleted;
      return taskDate === date && taskTime && !isCompleted;
    })
    .map(t => {
      const taskTime = t.due_time || t.dueTime;
      const taskDuration = t.estimated_duration || t.estimatedDuration || 30;
      return {
        start: timeToMinutes(taskTime),
        end: timeToMinutes(taskTime) + taskDuration
      };
    })
    .sort((a, b) => a.start - b.start);

  // חיפוש חלון פנוי - מתחילים מהשעה הרלוונטית
  let currentTime = earliestStart;

  for (const task of dayTasks) {
    // דילוג על משימות שכבר עברו
    if (task.end <= earliestStart) {
      continue;
    }
    
    // יש רווח לפני המשימה?
    if (currentTime + duration <= task.start && currentTime >= earliestStart) {
      return minutesToTime(currentTime);
    }
    // מעבר לסוף המשימה
    currentTime = Math.max(currentTime, task.end);
  }

  // בדיקה אם יש מקום אחרי המשימה האחרונה
  if (currentTime + duration <= dayEnd) {
    return minutesToTime(currentTime);
  }

  // אם אין מקום היום, מחפשים מחר
  if (isToday) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    // קריאה רקורסיבית למחר (לא isToday אז יתחיל מתחילת היום)
    const tomorrowSlot = findNextFreeSlot(tomorrowStr, duration, existingTasks, startHour, endHour);
    if (tomorrowSlot) {
      return `מחר ${tomorrowSlot}`;
    }
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

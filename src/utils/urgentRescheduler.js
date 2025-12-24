/**
 * מנוע שיבוץ מחדש למשימות דחופות
 * 
 * כאשר מגיעה משימה דחופה ולא צפויה, המערכת יודעת:
 * 1. להזיז משימות אחרות בצורה חכמה
 * 2. לשמור על דדליינים קריטיים
 * 3. להודיע על שינויים
 */

import { isWorkDay, getNextWorkDay, getAvailableMinutesForDay } from './smartTaskSplitter';

// קונפיגורציה
const CONFIG = {
  WORK_START_HOUR: 8,
  WORK_END_HOUR: 16,
  WORK_HOURS_PER_DAY: 8 * 60, // בדקות
  BUFFER_TIME: 15,            // דקות מרווח בין משימות
  
  // רמות עדיפות
  PRIORITY_LEVELS: {
    CRITICAL: 1,    // לא ניתן להזיז
    HIGH: 2,        // מזיזים רק במקרה קיצוני
    NORMAL: 3,      // ניתן להזיז
    LOW: 4          // קל להזיז
  },
  
  // התאמה של רבעי אייזנהאואר לעדיפות הזזה
  QUADRANT_TO_MOVABILITY: {
    1: 2,  // דחוף וחשוב - קשה להזיז
    2: 3,  // חשוב לא דחוף - ניתן להזיז
    3: 3,  // דחוף לא חשוב - ניתן להזיז
    4: 4   // לא דחוף לא חשוב - קל להזיז
  }
};

/**
 * חישוב "יכולת הזזה" של משימה
 * ככל שהמספר גבוה יותר, כך קל יותר להזיז את המשימה
 */
export function calculateMovability(task) {
  let movability = CONFIG.QUADRANT_TO_MOVABILITY[task.quadrant] || 3;
  
  // משימות עם דדליין היום - קשה להזיז
  if (task.due_date) {
    const today = new Date().toISOString().split('T')[0];
    if (task.due_date === today) {
      movability -= 1;
    }
    
    // דדליין מחר - קצת קשה להזיז
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (task.due_date === tomorrow.toISOString().split('T')[0]) {
      movability -= 0.5;
    }
  }
  
  // משימות שכבר התחילו - קשה להזיז
  if (task.time_spent && task.time_spent > 0) {
    movability -= 0.5;
  }
  
  // משימות עם תזכורות שנשלחו - קשה להזיז
  if (task.reminder_sent) {
    movability -= 0.5;
  }
  
  // משימות מסוג מסוים
  if (task.task_type === 'client_communication') {
    movability -= 0.5; // תקשורת לקוחות - קשה להזיז
  }
  
  return Math.max(1, Math.min(5, movability));
}

/**
 * מציאת משימות שניתן להזיז
 * @param {Array} tasks - כל המשימות
 * @param {string} date - התאריך שצריך לפנות בו מקום
 * @param {number} requiredMinutes - כמה דקות צריך לפנות
 * @returns {Array} משימות שאפשר להזיז, ממוינות לפי יכולת הזזה
 */
export function findMovableTasks(tasks, date, requiredMinutes) {
  const dateISO = typeof date === 'string' ? date : date.toISOString().split('T')[0];
  
  // מסנן משימות של היום שלא הושלמו
  const dayTasks = tasks.filter(t => 
    !t.is_completed &&
    t.due_date === dateISO &&
    t.quadrant !== 1 // לא מזיזים משימות דחופות וחשובות
  );
  
  // מחשב יכולת הזזה לכל משימה
  const tasksWithMovability = dayTasks.map(task => ({
    ...task,
    movability: calculateMovability(task)
  }));
  
  // ממיין לפי יכולת הזזה (הכי קל להזיז ראשון)
  tasksWithMovability.sort((a, b) => b.movability - a.movability);
  
  // בוחר משימות עד שמגיעים לזמן הנדרש
  const toMove = [];
  let freedMinutes = 0;
  
  for (const task of tasksWithMovability) {
    if (freedMinutes >= requiredMinutes) break;
    
    toMove.push(task);
    freedMinutes += task.estimated_duration || 30;
  }
  
  return {
    tasksToMove: toMove,
    freedMinutes,
    sufficient: freedMinutes >= requiredMinutes
  };
}

/**
 * חישוב תאריך יעד חדש למשימה שמוזזת
 */
export function calculateNewDueDate(task, existingTasks) {
  const currentDueDate = task.due_date ? new Date(task.due_date) : new Date();
  let newDate = getNextWorkDay(currentDueDate);
  
  // בודק זמינות בימים הבאים
  let attempts = 0;
  while (attempts < 7) {
    const available = getAvailableMinutesForDay(newDate, existingTasks);
    if (available >= (task.estimated_duration || 30)) {
      return newDate.toISOString().split('T')[0];
    }
    newDate = getNextWorkDay(newDate);
    attempts++;
  }
  
  // אם לא נמצא יום פנוי, מחזיר את היום הבא
  return getNextWorkDay(currentDueDate).toISOString().split('T')[0];
}

/**
 * שיבוץ מחדש בעקבות משימה דחופה
 * 
 * @param {Object} urgentTask - המשימה הדחופה החדשה
 * @param {Array} existingTasks - המשימות הקיימות
 * @param {Object} options - אפשרויות
 * @returns {Object} תוכנית שיבוץ מחדש
 */
export function rescheduleForUrgentTask(urgentTask, existingTasks, options = {}) {
  const {
    targetDate = new Date().toISOString().split('T')[0],
    allowPartialReschedule = true
  } = options;

  const urgentDuration = urgentTask.estimated_duration || 60;
  const availableToday = getAvailableMinutesForDay(targetDate, existingTasks);
  
  // אם יש מספיק מקום, לא צריך להזיז כלום
  if (availableToday >= urgentDuration) {
    return {
      success: true,
      needsReschedule: false,
      message: 'יש מספיק מקום ביום הזה',
      changes: [],
      urgentTask: {
        ...urgentTask,
        due_date: targetDate,
        scheduled: true
      }
    };
  }

  // צריך לפנות מקום
  const requiredMinutes = urgentDuration - availableToday;
  const { tasksToMove, freedMinutes, sufficient } = findMovableTasks(
    existingTasks, 
    targetDate, 
    requiredMinutes
  );

  if (!sufficient && !allowPartialReschedule) {
    return {
      success: false,
      needsReschedule: true,
      message: `לא ניתן לפנות מספיק מקום. נדרש: ${requiredMinutes} דקות, זמין להזזה: ${freedMinutes} דקות`,
      suggestion: 'נסה לדחות את המשימה הדחופה או לצמצם את אורכה',
      tasksToMove,
      freedMinutes
    };
  }

  // יצירת תוכנית הזזה
  const changes = tasksToMove.map(task => {
    const newDueDate = calculateNewDueDate(task, existingTasks);
    return {
      taskId: task.id,
      taskTitle: task.title,
      originalDate: task.due_date,
      newDate: newDueDate,
      duration: task.estimated_duration || 30,
      reason: `הוזז בעקבות משימה דחופה: "${urgentTask.title}"`
    };
  });

  return {
    success: true,
    needsReschedule: true,
    message: `${changes.length} משימות יוזזו כדי לפנות מקום`,
    changes,
    freedMinutes,
    urgentTask: {
      ...urgentTask,
      due_date: targetDate,
      scheduled: true
    },
    warnings: !sufficient ? [
      `הוזז רק ${freedMinutes} דקות מתוך ${requiredMinutes} הנדרשות`
    ] : []
  };
}

/**
 * ביצוע השיבוץ מחדש
 * מעדכן את המשימות במערכת
 */
export async function executeReschedule(changes, updateTaskFunction) {
  const results = [];
  
  for (const change of changes) {
    try {
      await updateTaskFunction(change.taskId, {
        due_date: change.newDate,
        reschedule_reason: change.reason,
        original_due_date: change.originalDate
      });
      
      results.push({
        taskId: change.taskId,
        success: true,
        newDate: change.newDate
      });
    } catch (err) {
      results.push({
        taskId: change.taskId,
        success: false,
        error: err.message
      });
    }
  }
  
  return {
    totalChanges: changes.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results
  };
}

/**
 * הצעת שיבוץ מחדש למשימות שלא הושלמו
 * נקרא בסוף היום או בבוקר
 */
export function suggestDailyReschedule(tasks) {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = getNextWorkDay(new Date()).toISOString().split('T')[0];
  
  // משימות של היום שלא הושלמו
  const unfinishedToday = tasks.filter(t => 
    !t.is_completed && 
    t.due_date === today
  );
  
  if (unfinishedToday.length === 0) {
    return {
      hasUnfinished: false,
      message: 'כל המשימות של היום הושלמו! 🎉'
    };
  }
  
  // מיון לפי עדיפות
  const sortedByPriority = unfinishedToday.sort((a, b) => {
    // דחוף וחשוב ראשון
    if (a.quadrant !== b.quadrant) {
      return a.quadrant - b.quadrant;
    }
    // אחר כך לפי זמן משוער (קצרות קודם)
    return (a.estimated_duration || 30) - (b.estimated_duration || 30);
  });
  
  // הצעות
  const suggestions = sortedByPriority.map(task => {
    const isUrgent = task.quadrant === 1;
    const suggestedAction = isUrgent 
      ? 'לסיים היום בכל מחיר'
      : 'להעביר למחר';
    
    return {
      task,
      suggestedDate: isUrgent ? today : tomorrow,
      suggestedAction,
      priority: isUrgent ? 'high' : 'normal'
    };
  });
  
  // סיכום
  const urgentCount = suggestions.filter(s => s.priority === 'high').length;
  const canMoveCount = suggestions.filter(s => s.priority === 'normal').length;
  const totalTime = unfinishedToday.reduce((sum, t) => sum + (t.estimated_duration || 30), 0);
  
  return {
    hasUnfinished: true,
    count: unfinishedToday.length,
    urgentCount,
    canMoveCount,
    totalTime,
    suggestions,
    summary: urgentCount > 0
      ? `יש ${urgentCount} משימות דחופות שחייבות להסתיים היום`
      : `${canMoveCount} משימות יכולות לעבור למחר`
  };
}

/**
 * בדיקת התנגשויות בלוח הזמנים
 */
export function checkScheduleConflicts(tasks, date) {
  const dateISO = typeof date === 'string' ? date : date.toISOString().split('T')[0];
  
  const dayTasks = tasks.filter(t => 
    !t.is_completed && 
    t.due_date === dateISO
  );
  
  const totalScheduled = dayTasks.reduce((sum, t) => 
    sum + (t.estimated_duration || 30), 0
  );
  
  const available = CONFIG.WORK_HOURS_PER_DAY;
  const overbooked = totalScheduled > available;
  const overbookAmount = totalScheduled - available;
  
  return {
    date: dateISO,
    totalScheduled,
    available,
    overbooked,
    overbookAmount: overbooked ? overbookAmount : 0,
    utilizationPercent: Math.round((totalScheduled / available) * 100),
    tasks: dayTasks,
    warning: overbooked 
      ? `היום עמוס ב-${Math.round(overbookAmount)} דקות יותר מדי`
      : null
  };
}

/**
 * הצעת איזון עומס שבועי
 */
export function suggestWeeklyBalance(tasks) {
  const today = new Date();
  const weekDays = [];
  
  // בניית מפת עומס לשבוע
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    
    if (isWorkDay(date)) {
      const dateISO = date.toISOString().split('T')[0];
      const conflict = checkScheduleConflicts(tasks, dateISO);
      weekDays.push({
        date: dateISO,
        dayName: ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][date.getDay()],
        ...conflict
      });
    }
  }
  
  // מציאת ימים עמוסים וימים פנויים
  const overloadedDays = weekDays.filter(d => d.overbooked);
  const underutilizedDays = weekDays.filter(d => d.utilizationPercent < 60);
  
  // הצעות לאיזון
  const balanceSuggestions = [];
  
  for (const overDay of overloadedDays) {
    // מצא משימות שאפשר להזיז
    const movableTasks = overDay.tasks
      .filter(t => t.quadrant !== 1) // לא דחוף וחשוב
      .sort((a, b) => calculateMovability(b) - calculateMovability(a));
    
    for (const underDay of underutilizedDays) {
      const freeSpace = underDay.available - underDay.totalScheduled;
      
      for (const task of movableTasks) {
        if ((task.estimated_duration || 30) <= freeSpace) {
          balanceSuggestions.push({
            task,
            fromDate: overDay.date,
            fromDayName: overDay.dayName,
            toDate: underDay.date,
            toDayName: underDay.dayName,
            reason: `פינוי עומס מיום ${overDay.dayName}`
          });
          break;
        }
      }
    }
  }
  
  return {
    weekDays,
    overloadedDays: overloadedDays.length,
    underutilizedDays: underutilizedDays.length,
    balanceSuggestions,
    isBalanced: overloadedDays.length === 0,
    summary: overloadedDays.length > 0
      ? `${overloadedDays.length} ימים עמוסים מדי, ${balanceSuggestions.length} הצעות לאיזון`
      : 'השבוע מאוזן! 🎯'
  };
}

export default {
  CONFIG,
  calculateMovability,
  findMovableTasks,
  calculateNewDueDate,
  rescheduleForUrgentTask,
  executeReschedule,
  suggestDailyReschedule,
  checkScheduleConflicts,
  suggestWeeklyBalance
};

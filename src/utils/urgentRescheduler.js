/**
 * מנוע שיבוץ מחדש למשימות דחופות
 * 
 * כאשר מגיעה משימה דחופה ולא צפויה, המערכת:
 * 1. מזיזה משימות פחות חשובות אוטומטית (Q4 ← Q3 ← Q2)
 * 2. שומרת על משימות דחופות וחשובות (Q1)
 * 3. מודיעה על שינויים
 * 
 * עדכון: דחיית משימות אוטומטית לפי רבע אייזנהאואר
 */

import { isWorkDay, getNextWorkDay, getAvailableMinutesForDay } from './smartTaskSplitter';

// קונפיגורציה
const CONFIG = {
  WORK_START_HOUR: 8,
  WORK_END_HOUR: 16,
  WORK_HOURS_PER_DAY: 8 * 60, // בדקות
  BUFFER_TIME: 10,            // דקות מרווח בין משימות
  
  // סדר עדיפות לדחייה (מי נדחה ראשון)
  // מספר גבוה יותר = קל יותר לדחות
  DEFER_PRIORITY: {
    4: 100,  // Q4: לא דחוף לא חשוב - נדחה ראשון
    3: 75,   // Q3: דחוף לא חשוב - נדחה שני
    2: 50,   // Q2: חשוב לא דחוף - נדחה שלישי
    1: 0     // Q1: דחוף וחשוב - לא נדחה!
  },
  
  // בונוס/קנס לפי מצב המשימה
  DEFER_MODIFIERS: {
    hasDueToday: -30,        // דדליין היום - קשה לדחות
    hasDueTomorrow: -15,     // דדליין מחר - קצת קשה
    alreadyStarted: -20,     // כבר התחילו - קשה לדחות
    hasReminder: -10,        // יש תזכורת - קצת קשה
    isClientWork: -15,       // עבודה עם לקוח - קשה
    isSplitTask: 10,         // חלק ממשימה מפוצלת - קל לדחות
    isLowPriority: 20        // עדיפות נמוכה - קל לדחות
  }
};

/**
 * חישוב "ניקוד דחייה" של משימה
 * ככל שהמספר גבוה יותר, כך קל יותר לדחות את המשימה
 */
export function calculateDeferScore(task) {
  // ניקוד בסיס לפי רבע
  let score = CONFIG.DEFER_PRIORITY[task.quadrant] || 50;
  
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowISO = tomorrow.toISOString().split('T')[0];
  
  // שינויים לפי מצב המשימה
  if (task.due_date === today) {
    score += CONFIG.DEFER_MODIFIERS.hasDueToday;
  } else if (task.due_date === tomorrowISO) {
    score += CONFIG.DEFER_MODIFIERS.hasDueTomorrow;
  }
  
  if (task.time_spent && task.time_spent > 0) {
    score += CONFIG.DEFER_MODIFIERS.alreadyStarted;
  }
  
  if (task.reminder_sent) {
    score += CONFIG.DEFER_MODIFIERS.hasReminder;
  }
  
  if (task.task_type === 'client_communication') {
    score += CONFIG.DEFER_MODIFIERS.isClientWork;
  }
  
  if (task.is_split_task) {
    score += CONFIG.DEFER_MODIFIERS.isSplitTask;
  }
  
  if (task.priority === 'low') {
    score += CONFIG.DEFER_MODIFIERS.isLowPriority;
  }
  
  return Math.max(0, Math.min(100, score));
}

/**
 * מציאת משימות שאפשר לדחות
 * ממוינות לפי קלות הדחייה (Q4 ראשון, אח"כ Q3, אח"כ Q2)
 * 
 * @param {Array} tasks - כל המשימות
 * @param {string} date - התאריך שצריך לפנות בו מקום
 * @param {number} requiredMinutes - כמה דקות צריך לפנות
 * @returns {Object} משימות שאפשר לדחות, ממוינות לפי קלות דחייה
 */
export function findTasksToDefer(tasks, date, requiredMinutes) {
  const dateISO = typeof date === 'string' ? date : date.toISOString().split('T')[0];
  
  // מסנן משימות של היום שלא הושלמו ושאינן Q1
  const dayTasks = tasks.filter(t => 
    !t.is_completed &&
    t.due_date === dateISO &&
    t.quadrant !== 1 // לעולם לא דוחים Q1!
  );
  
  // מחשב ניקוד דחייה לכל משימה
  const tasksWithScore = dayTasks.map(task => ({
    ...task,
    deferScore: calculateDeferScore(task)
  }));
  
  // ממיין לפי ניקוד דחייה (הכי קל לדחות ראשון)
  tasksWithScore.sort((a, b) => b.deferScore - a.deferScore);
  
  // בוחר משימות עד שמגיעים לזמן הנדרש
  const toDefer = [];
  let freedMinutes = 0;
  
  for (const task of tasksWithScore) {
    if (freedMinutes >= requiredMinutes) break;
    
    // רק משימות עם ניקוד חיובי (אפשר לדחות)
    if (task.deferScore > 0) {
      toDefer.push(task);
      freedMinutes += task.estimated_duration || 30;
    }
  }
  
  return {
    tasksToDefer: toDefer,
    freedMinutes,
    sufficient: freedMinutes >= requiredMinutes,
    // סטטיסטיקה
    byQuadrant: {
      q4: toDefer.filter(t => t.quadrant === 4).length,
      q3: toDefer.filter(t => t.quadrant === 3).length,
      q2: toDefer.filter(t => t.quadrant === 2).length
    }
  };
}

/**
 * חישוב תאריך יעד חדש למשימה שנדחית
 * מחפש את היום הקרוב ביותר עם מקום פנוי
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
 * דוחה אוטומטית משימות פחות חשובות
 * 
 * @param {Object} urgentTask - המשימה הדחופה החדשה
 * @param {Array} existingTasks - המשימות הקיימות
 * @param {Object} options - אפשרויות
 * @returns {Object} תוכנית שיבוץ מחדש
 */
export function rescheduleForUrgentTask(urgentTask, existingTasks, options = {}) {
  const {
    targetDate = new Date().toISOString().split('T')[0],
    allowPartialReschedule = true,
    autoDefer = true  // חדש: דחייה אוטומטית
  } = options;

  const urgentDuration = urgentTask.estimated_duration || 60;
  const availableToday = getAvailableMinutesForDay(targetDate, existingTasks);
  
  // אם יש מספיק מקום, לא צריך לדחות כלום
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

  // צריך לפנות מקום - מחפש משימות לדחות
  const requiredMinutes = urgentDuration - availableToday;
  const { tasksToDefer, freedMinutes, sufficient, byQuadrant } = findTasksToDefer(
    existingTasks, 
    targetDate, 
    requiredMinutes
  );

  if (!sufficient && !allowPartialReschedule) {
    return {
      success: false,
      needsReschedule: true,
      message: `לא ניתן לפנות מספיק מקום. נדרש: ${requiredMinutes} דקות, זמין לדחייה: ${freedMinutes} דקות`,
      suggestion: 'נסי לדחות את המשימה הדחופה או לצמצם את אורכה',
      tasksToDefer,
      freedMinutes,
      byQuadrant
    };
  }

  // יצירת תוכנית דחייה
  const changes = tasksToDefer.map(task => {
    const newDueDate = calculateNewDueDate(task, existingTasks);
    const quadrantName = {
      2: 'חשוב לא דחוף',
      3: 'דחוף לא חשוב',
      4: 'לא דחוף לא חשוב'
    }[task.quadrant] || '';
    
    return {
      taskId: task.id,
      taskTitle: task.title,
      originalDate: task.due_date,
      newDate: newDueDate,
      duration: task.estimated_duration || 30,
      quadrant: task.quadrant,
      quadrantName,
      reason: `נדחה עבור משימה דחופה: "${urgentTask.title}"`,
      deferScore: task.deferScore
    };
  });

  // מיון השינויים - Q4 ראשון
  changes.sort((a, b) => (b.quadrant || 0) - (a.quadrant || 0));

  return {
    success: true,
    needsReschedule: true,
    message: `${changes.length} משימות יידחו כדי לפנות מקום`,
    changes,
    freedMinutes,
    byQuadrant,
    urgentTask: {
      ...urgentTask,
      due_date: targetDate,
      scheduled: true
    },
    warnings: !sufficient ? [
      `נדחו רק ${freedMinutes} דקות מתוך ${requiredMinutes} הנדרשות`
    ] : [],
    summary: generateDeferSummary(byQuadrant)
  };
}

/**
 * יצירת סיכום קריא של הדחיות
 */
function generateDeferSummary(byQuadrant) {
  const parts = [];
  if (byQuadrant.q4 > 0) parts.push(`${byQuadrant.q4} משימות לא דחופות ולא חשובות`);
  if (byQuadrant.q3 > 0) parts.push(`${byQuadrant.q3} משימות דחופות לא חשובות`);
  if (byQuadrant.q2 > 0) parts.push(`${byQuadrant.q2} משימות חשובות לא דחופות`);
  
  if (parts.length === 0) return 'לא נדחו משימות';
  return `נדחו: ${parts.join(', ')}`;
}

/**
 * ביצוע הדחייה בפועל
 * מעדכן את המשימות במערכת
 */
export async function executeReschedule(changes, updateTaskFunction) {
  const results = [];
  
  for (const change of changes) {
    try {
      await updateTaskFunction(change.taskId, {
        due_date: change.newDate,
        reschedule_reason: change.reason,
        original_due_date: change.originalDate,
        was_deferred: true,
        deferred_at: new Date().toISOString()
      });
      
      results.push({
        taskId: change.taskId,
        taskTitle: change.taskTitle,
        success: true,
        newDate: change.newDate
      });
    } catch (err) {
      results.push({
        taskId: change.taskId,
        taskTitle: change.taskTitle,
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
 * הצעת דחיית משימות לסוף היום
 * נקרא כשמגיעה משימה חדשה והיום עמוס
 */
export function suggestDeferrals(tasks, newTaskDuration) {
  const today = new Date().toISOString().split('T')[0];
  const availableToday = getAvailableMinutesForDay(today, tasks);
  
  if (availableToday >= newTaskDuration) {
    return {
      needsDeferral: false,
      message: 'יש מספיק מקום היום'
    };
  }
  
  const requiredMinutes = newTaskDuration - availableToday;
  const { tasksToDefer, freedMinutes, sufficient, byQuadrant } = findTasksToDefer(
    tasks, 
    today, 
    requiredMinutes
  );
  
  return {
    needsDeferral: true,
    requiredMinutes,
    tasksToDefer,
    freedMinutes,
    sufficient,
    byQuadrant,
    summary: generateDeferSummary(byQuadrant),
    message: sufficient
      ? `אפשר לפנות ${freedMinutes} דקות ע"י דחיית ${tasksToDefer.length} משימות`
      : `אפשר לפנות רק ${freedMinutes} דקות מתוך ${requiredMinutes} הנדרשות`
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
  
  // מיון לפי רבע (Q1 ראשון, Q4 אחרון)
  const sortedByQuadrant = unfinishedToday.sort((a, b) => {
    if (a.quadrant !== b.quadrant) {
      return a.quadrant - b.quadrant;
    }
    return (a.estimated_duration || 30) - (b.estimated_duration || 30);
  });
  
  // הצעות
  const suggestions = sortedByQuadrant.map(task => {
    const isUrgent = task.quadrant === 1;
    const canDefer = task.quadrant !== 1;
    const suggestedAction = isUrgent 
      ? 'לסיים היום בכל מחיר'
      : 'להעביר למחר';
    
    return {
      task,
      suggestedDate: isUrgent ? today : tomorrow,
      suggestedAction,
      canDefer,
      priority: isUrgent ? 'critical' : (task.quadrant === 2 ? 'high' : 'normal'),
      deferScore: calculateDeferScore(task)
    };
  });
  
  // סיכום לפי רבעים
  const byQuadrant = {
    q1: unfinishedToday.filter(t => t.quadrant === 1).length,
    q2: unfinishedToday.filter(t => t.quadrant === 2).length,
    q3: unfinishedToday.filter(t => t.quadrant === 3).length,
    q4: unfinishedToday.filter(t => t.quadrant === 4).length
  };
  
  const totalTime = unfinishedToday.reduce((sum, t) => sum + (t.estimated_duration || 30), 0);
  
  return {
    hasUnfinished: true,
    count: unfinishedToday.length,
    byQuadrant,
    totalTime,
    suggestions,
    summary: byQuadrant.q1 > 0
      ? `⚠️ יש ${byQuadrant.q1} משימות דחופות וחשובות שחייבות להסתיים היום!`
      : `${byQuadrant.q2 + byQuadrant.q3 + byQuadrant.q4} משימות יכולות לעבור למחר`
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
  
  // פירוט לפי רבעים
  const byQuadrant = {
    q1: dayTasks.filter(t => t.quadrant === 1).reduce((s, t) => s + (t.estimated_duration || 30), 0),
    q2: dayTasks.filter(t => t.quadrant === 2).reduce((s, t) => s + (t.estimated_duration || 30), 0),
    q3: dayTasks.filter(t => t.quadrant === 3).reduce((s, t) => s + (t.estimated_duration || 30), 0),
    q4: dayTasks.filter(t => t.quadrant === 4).reduce((s, t) => s + (t.estimated_duration || 30), 0)
  };
  
  return {
    date: dateISO,
    totalScheduled,
    available,
    overbooked,
    overbookAmount: overbooked ? overbookAmount : 0,
    utilizationPercent: Math.round((totalScheduled / available) * 100),
    tasks: dayTasks,
    byQuadrant,
    warning: overbooked 
      ? `היום עמוס ב-${Math.round(overbookAmount)} דקות יותר מדי`
      : null,
    canDefer: byQuadrant.q2 + byQuadrant.q3 + byQuadrant.q4 // דקות שאפשר לדחות
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
  const underutilizedDays = weekDays.filter(d => d.utilizationPercent < 70);
  
  // הצעות לאיזון - דוחים לפי רבעים
  const balanceSuggestions = [];
  
  for (const overDay of overloadedDays) {
    // מצא משימות שאפשר לדחות (Q4 ← Q3 ← Q2)
    const deferable = overDay.tasks
      .filter(t => t.quadrant !== 1)
      .map(t => ({ ...t, deferScore: calculateDeferScore(t) }))
      .sort((a, b) => b.deferScore - a.deferScore);
    
    for (const underDay of underutilizedDays) {
      const freeSpace = underDay.available - underDay.totalScheduled;
      
      for (const task of deferable) {
        if ((task.estimated_duration || 30) <= freeSpace) {
          const quadrantName = { 2: 'Q2', 3: 'Q3', 4: 'Q4' }[task.quadrant] || '';
          balanceSuggestions.push({
            task,
            fromDate: overDay.date,
            fromDayName: overDay.dayName,
            toDate: underDay.date,
            toDayName: underDay.dayName,
            quadrant: task.quadrant,
            quadrantName,
            reason: `פינוי עומס מיום ${overDay.dayName} (${quadrantName})`
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
  calculateDeferScore,
  findTasksToDefer,
  calculateNewDueDate,
  rescheduleForUrgentTask,
  executeReschedule,
  suggestDeferrals,
  suggestDailyReschedule,
  checkScheduleConflicts,
  suggestWeeklyBalance
};

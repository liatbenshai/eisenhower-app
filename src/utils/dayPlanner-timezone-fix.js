/**
 * מתכנן יום חכם
 * ================
 * המנוע המרכזי לתכנון לוח זמנים יומי ושבועי
 * 
 * עקרונות:
 * 1. מחשב זמן זמין אמיתי (אחרי מרווח בלת"מים)
 * 2. משבץ משימות לפי דחיפות ותאריך יעד
 * 3. מתריע על עומס יתר
 * 4. מציע חלופות כשאין מספיק זמן
 */

import { 
  WORK_HOURS, 
  BUFFER_PERCENTAGE,
  SCHEDULE_CONFIG,
  getAvailableMinutesForDay,
  getWorkMinutesForDay,
  getWorkHoursForDate,
  isWorkDay,
  formatTime,
  formatDuration
} from '../config/workSchedule';

/**
 * סטטוס תכנון
 */
export const SCHEDULE_STATUS = {
  OK: 'ok',           // הכל נכנס
  TIGHT: 'tight',     // צפוף אבל אפשרי
  OVERLOAD: 'overload', // עומס יתר - לא יכנס
  NO_TASKS: 'no_tasks'  // אין משימות
};

/**
 * עדיפות משימות לתכנון
 */
const PRIORITY_ORDER = {
  urgent: 1,
  high: 2,
  normal: 3
};

/**
 * תכנון יום בודד
 * ===============
 * מקבל תאריך ומשימות, מחזיר לוח זמנים מתוכנן
 * 
 * @param {Date} date - התאריך לתכנון
 * @param {Array} allTasks - כל המשימות
 * @returns {Object} תוצאת התכנון
 */
export function planDay(date, allTasks) {
  const dateISO = date.toISOString().split('T')[0];
  const dayOfWeek = date.getDay();
  
  // בדיקה אם יום עבודה
  if (!isWorkDay(date)) {
    return {
      date: dateISO,
      status: SCHEDULE_STATUS.NO_TASKS,
      isWorkDay: false,
      message: 'לא יום עבודה',
      totalMinutes: 0,
      availableMinutes: 0,
      scheduledMinutes: 0,
      bufferMinutes: 0,
      tasks: [],
      scheduledBlocks: [],
      unscheduledTasks: [],
      warnings: []
    };
  }

  // חישוב זמנים
  const totalMinutes = getWorkMinutesForDay(dayOfWeek);
  const availableMinutes = getAvailableMinutesForDay(dayOfWeek);
  const bufferMinutes = totalMinutes - availableMinutes;
  const workHours = getWorkHoursForDate(date);

  // סינון משימות ליום זה
  const dayTasks = filterTasksForDate(allTasks, date);
  
  if (dayTasks.length === 0) {
    return {
      date: dateISO,
      status: SCHEDULE_STATUS.NO_TASKS,
      isWorkDay: true,
      message: 'אין משימות מתוכננות',
      totalMinutes,
      availableMinutes,
      scheduledMinutes: 0,
      bufferMinutes,
      bufferUsed: 0,
      freeMinutes: availableMinutes,
      tasks: [],
      scheduledBlocks: [],
      unscheduledTasks: [],
      warnings: []
    };
  }

  // מיון משימות לפי עדיפות
  const sortedTasks = sortTasksByPriority(dayTasks);

  // שיבוץ משימות
  const { scheduledBlocks, unscheduledTasks, scheduledMinutes } = 
    scheduleTasks(sortedTasks, workHours, availableMinutes);

  // חישוב סטטוס
  const usagePercent = Math.round((scheduledMinutes / availableMinutes) * 100);
  let status = SCHEDULE_STATUS.OK;
  let message = '';

  if (unscheduledTasks.length > 0) {
    status = SCHEDULE_STATUS.OVERLOAD;
    const unscheduledMinutes = unscheduledTasks.reduce((sum, t) => sum + (t.estimated_duration || 30), 0);
    message = `עומס יתר! ${unscheduledTasks.length} משימות (${formatDuration(unscheduledMinutes)}) לא נכנסות`;
  } else if (usagePercent >= 90) {
    status = SCHEDULE_STATUS.TIGHT;
    message = 'יום צפוף - כמעט אין מרווח';
  } else {
    message = `תכנון תקין - ${100 - usagePercent}% פנוי`;
  }

  // אזהרות
  const warnings = generateWarnings(sortedTasks, scheduledBlocks, unscheduledTasks, date);

  return {
    date: dateISO,
    dayName: WORK_HOURS[dayOfWeek].name,
    status,
    isWorkDay: true,
    message,
    totalMinutes,
    availableMinutes,
    scheduledMinutes,
    bufferMinutes,
    freeMinutes: availableMinutes - scheduledMinutes,
    usagePercent,
    tasks: sortedTasks,
    scheduledBlocks,
    unscheduledTasks,
    warnings,
    workHours
  };
}

/**
 * תכנון שבוע שלם
 * ===============
 * 
 * @param {Date} weekStart - תחילת השבוע (יום ראשון)
 * @param {Array} allTasks - כל המשימות
 * @returns {Object} תוצאת התכנון השבועי
 */
export function planWeek(weekStart, allTasks) {
  const days = [];
  let totalScheduled = 0;
  let totalAvailable = 0;
  let totalUnscheduled = 0;
  const allWarnings = [];

  // תכנון כל יום בשבוע
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    date.setHours(12, 0, 0, 0); // מגדיר לשעה 12 למניעת בעיות timezone
    
    const dayPlan = planDay(date, allTasks);
    days.push(dayPlan);
    
    if (dayPlan.isWorkDay) {
      totalScheduled += dayPlan.scheduledMinutes;
      totalAvailable += dayPlan.availableMinutes;
      totalUnscheduled += dayPlan.unscheduledTasks.length;
      allWarnings.push(...dayPlan.warnings.map(w => ({ ...w, date: dayPlan.date })));
    }
  }

  // חישוב סטטוס כללי
  const overloadDays = days.filter(d => d.status === SCHEDULE_STATUS.OVERLOAD).length;
  const tightDays = days.filter(d => d.status === SCHEDULE_STATUS.TIGHT).length;
  
  let status = SCHEDULE_STATUS.OK;
  let message = '';

  if (overloadDays > 0) {
    status = SCHEDULE_STATUS.OVERLOAD;
    message = `${overloadDays} ימים בעומס יתר`;
  } else if (tightDays >= 3) {
    status = SCHEDULE_STATUS.TIGHT;
    message = 'שבוע צפוף - מומלץ לפזר משימות';
  } else {
    const usagePercent = totalAvailable > 0 ? Math.round((totalScheduled / totalAvailable) * 100) : 0;
    message = `שבוע מאוזן - ${usagePercent}% מנוצל`;
  }

  return {
    weekStart: weekStart.toISOString().split('T')[0],
    status,
    message,
    days,
    summary: {
      totalScheduledMinutes: totalScheduled,
      totalAvailableMinutes: totalAvailable,
      totalUnscheduledTasks: totalUnscheduled,
      usagePercent: totalAvailable > 0 ? Math.round((totalScheduled / totalAvailable) * 100) : 0,
      overloadDays,
      tightDays
    },
    warnings: allWarnings
  };
}

/**
 * סינון משימות לתאריך מסוים
 */
function filterTasksForDate(tasks, date) {
  const dateISO = date.toISOString().split('T')[0];
  
  return tasks.filter(task => {
    // רק משימות פעילות
    if (task.is_completed) return false;
    
    // משימה עם תאריך התחלה או יעד שמתאים
    if (task.start_date === dateISO) return true;
    if (task.due_date === dateISO && !task.start_date) return true;
    
    // משימה ארוכה שמשתרעת על פני תאריכים
    if (task.start_date && task.due_date) {
      const start = new Date(task.start_date);
      const end = new Date(task.due_date);
      const current = new Date(dateISO);
      if (current >= start && current <= end) return true;
    }
    
    // משימה ללא תאריך - תופיע רק היום
    const today = new Date().toISOString().split('T')[0];
    if (!task.due_date && !task.start_date && dateISO === today) return true;
    
    return false;
  });
}

/**
 * מיון משימות לפי עדיפות
 */
function sortTasksByPriority(tasks) {
  return [...tasks].sort((a, b) => {
    // 1. לפי דחיפות
    const priorityA = PRIORITY_ORDER[a.priority] || 3;
    const priorityB = PRIORITY_ORDER[b.priority] || 3;
    if (priorityA !== priorityB) return priorityA - priorityB;
    
    // 2. לפי תאריך יעד (קרוב יותר קודם)
    if (a.due_date && b.due_date) {
      return new Date(a.due_date) - new Date(b.due_date);
    }
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    
    // 3. לפי שעה אם יש
    if (a.due_time && b.due_time) {
      return a.due_time.localeCompare(b.due_time);
    }
    if (a.due_time) return -1;
    if (b.due_time) return 1;
    
    return 0;
  });
}

/**
 * שיבוץ משימות בלוח זמנים
 */
function scheduleTasks(tasks, workHours, availableMinutes) {
  const scheduledBlocks = [];
  const unscheduledTasks = [];
  let currentMinute = workHours.start * 60; // התחלה בדקות מתחילת היום
  let scheduledMinutes = 0;
  const endMinute = workHours.end * 60;
  
  for (const task of tasks) {
    const duration = task.estimated_duration || 30;
    
    // אם למשימה יש שעה קבועה - ננסה לשבץ שם
    if (task.due_time) {
      const [hours, mins] = task.due_time.split(':').map(Number);
      const taskStartMinute = hours * 60 + (mins || 0);
      const taskEndMinute = taskStartMinute + duration;
      
      // בדיקה שלא חורג משעות העבודה
      if (taskEndMinute <= endMinute) {
        scheduledBlocks.push({
          taskId: task.id,
          task,
          startMinute: taskStartMinute,
          endMinute: taskEndMinute,
          startTime: formatTime(hours, mins || 0),
          endTime: minutesToTime(taskEndMinute),
          duration,
          isFixed: true
        });
        scheduledMinutes += duration;
        continue;
      }
    }
    
    // שיבוץ אוטומטי - בדיקה אם יש מקום
    if (scheduledMinutes + duration <= availableMinutes) {
      // מציאת חלון פנוי
      const slot = findFreeSlot(scheduledBlocks, currentMinute, endMinute, duration);
      
      if (slot) {
        scheduledBlocks.push({
          taskId: task.id,
          task,
          startMinute: slot.start,
          endMinute: slot.end,
          startTime: minutesToTime(slot.start),
          endTime: minutesToTime(slot.end),
          duration,
          isFixed: false
        });
        scheduledMinutes += duration;
        currentMinute = slot.end + SCHEDULE_CONFIG.minBreakBetweenTasks;
      } else {
        unscheduledTasks.push(task);
      }
    } else {
      unscheduledTasks.push(task);
    }
  }
  
  // מיון לפי שעת התחלה
  scheduledBlocks.sort((a, b) => a.startMinute - b.startMinute);
  
  return { scheduledBlocks, unscheduledTasks, scheduledMinutes };
}

/**
 * מציאת חלון זמן פנוי
 */
function findFreeSlot(existingBlocks, startFrom, endAt, duration) {
  let currentStart = startFrom;
  
  // מיון בלוקים קיימים לפי שעת התחלה
  const sortedBlocks = [...existingBlocks].sort((a, b) => a.startMinute - b.startMinute);
  
  for (const block of sortedBlocks) {
    // יש מקום לפני הבלוק הזה?
    if (currentStart + duration <= block.startMinute) {
      return { start: currentStart, end: currentStart + duration };
    }
    // מתקדמים לאחרי הבלוק
    currentStart = Math.max(currentStart, block.endMinute + SCHEDULE_CONFIG.minBreakBetweenTasks);
  }
  
  // בדיקה אם יש מקום אחרי כל הבלוקים
  if (currentStart + duration <= endAt) {
    return { start: currentStart, end: currentStart + duration };
  }
  
  return null;
}

/**
 * המרת דקות לפורמט שעה
 */
function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return formatTime(hours, mins);
}

/**
 * יצירת אזהרות
 */
function generateWarnings(tasks, scheduledBlocks, unscheduledTasks, date) {
  const warnings = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  
  // אזהרה על משימות שלא נכנסות
  if (unscheduledTasks.length > 0) {
    warnings.push({
      type: 'overload',
      severity: 'high',
      message: `${unscheduledTasks.length} משימות לא נכנסות ללוח הזמנים`,
      tasks: unscheduledTasks.map(t => t.id)
    });
  }
  
  // ⚠️ אזהרה על חפיפות זמנים
  const overlaps = findOverlappingTasks(tasks);
  if (overlaps.length > 0) {
    overlaps.forEach(overlap => {
      warnings.push({
        type: 'overlap',
        severity: 'high',
        message: `חפיפה! "${overlap.task1.title}" ו-"${overlap.task2.title}" מתוכננות לאותו זמן (${overlap.time})`,
        tasks: [overlap.task1.id, overlap.task2.id],
        canAutoFix: true,
        fixAction: 'reschedule',
        overlap
      });
    });
  }
  
  // אזהרה על משימות דחופות
  const urgentTasks = tasks.filter(t => t.priority === 'urgent');
  if (urgentTasks.length > 3) {
    warnings.push({
      type: 'too_many_urgent',
      severity: 'medium',
      message: `יש ${urgentTasks.length} משימות דחופות - כדאי לתעדף`,
      tasks: urgentTasks.map(t => t.id)
    });
  }
  
  // אזהרה על משימות באיחור
  const overdueTasks = tasks.filter(t => {
    if (!t.due_date) return false;
    const dueDate = new Date(t.due_date);
    return dueDate < today;
  });
  
  if (overdueTasks.length > 0) {
    warnings.push({
      type: 'overdue',
      severity: 'high',
      message: `${overdueTasks.length} משימות באיחור!`,
      tasks: overdueTasks.map(t => t.id)
    });
  }
  
  // אזהרה על משימות ארוכות מדי
  const longTasks = tasks.filter(t => (t.estimated_duration || 0) > 180);
  if (longTasks.length > 0) {
    warnings.push({
      type: 'long_tasks',
      severity: 'low',
      message: `${longTasks.length} משימות ארוכות (3+ שעות) - כדאי לפצל`,
      tasks: longTasks.map(t => t.id)
    });
  }
  
  return warnings;
}

/**
 * מציאת משימות חופפות
 */
function findOverlappingTasks(tasks) {
  const overlaps = [];
  const tasksWithTime = tasks.filter(t => t.due_time && !t.is_completed);
  
  for (let i = 0; i < tasksWithTime.length; i++) {
    for (let j = i + 1; j < tasksWithTime.length; j++) {
      const task1 = tasksWithTime[i];
      const task2 = tasksWithTime[j];
      
      // המרת זמנים לדקות
      const [h1, m1] = task1.due_time.split(':').map(Number);
      const [h2, m2] = task2.due_time.split(':').map(Number);
      const start1 = h1 * 60 + (m1 || 0);
      const start2 = h2 * 60 + (m2 || 0);
      const end1 = start1 + (task1.estimated_duration || 30);
      const end2 = start2 + (task2.estimated_duration || 30);
      
      // בדיקת חפיפה
      if (start1 < end2 && start2 < end1) {
        overlaps.push({
          task1,
          task2,
          time: task1.due_time,
          overlapMinutes: Math.min(end1, end2) - Math.max(start1, start2)
        });
      }
    }
  }
  
  return overlaps;
}

/**
 * הצעה לשיבוץ משימה חדשה
 * ======================
 * מחפש את הזמן הטוב ביותר למשימה חדשה
 * 
 * @param {Object} newTask - המשימה החדשה
 * @param {Array} existingTasks - משימות קיימות
 * @param {Date} preferredDate - תאריך מועדף (ברירת מחדל: היום)
 * @returns {Object} הצעות לזמנים
 */
export function suggestTimeForTask(newTask, existingTasks, preferredDate = new Date()) {
  const duration = newTask.estimated_duration || 30;
  const suggestions = [];
  
  // בדיקת 5 ימי עבודה קדימה
  for (let i = 0; i < 14; i++) {
    const checkDate = new Date(preferredDate);
    checkDate.setDate(checkDate.getDate() + i);
    
    if (!isWorkDay(checkDate)) continue;
    
    const dayPlan = planDay(checkDate, existingTasks);
    
    // בדיקה אם יש מקום
    if (dayPlan.freeMinutes >= duration) {
      // מציאת חלון ספציפי
      const workHours = getWorkHoursForDate(checkDate);
      const slot = findFreeSlot(
        dayPlan.scheduledBlocks,
        workHours.start * 60,
        workHours.end * 60,
        duration
      );
      
      if (slot) {
        suggestions.push({
          date: checkDate.toISOString().split('T')[0],
          dayName: WORK_HOURS[checkDate.getDay()].name,
          startTime: minutesToTime(slot.start),
          endTime: minutesToTime(slot.end),
          freeMinutes: dayPlan.freeMinutes,
          usageAfter: dayPlan.usagePercent + Math.round((duration / dayPlan.availableMinutes) * 100),
          isToday: i === 0,
          daysFromNow: i
        });
        
        // מספיק 4 הצעות
        if (suggestions.length >= 4) break;
      }
    }
  }
  
  return {
    hasSuggestions: suggestions.length > 0,
    suggestions,
    taskDuration: duration,
    message: suggestions.length > 0 
      ? `נמצאו ${suggestions.length} זמנים אפשריים`
      : 'לא נמצא זמן פנוי ב-14 הימים הקרובים'
  };
}

/**
 * חישוב עומס שבועי
 * =================
 * מציג סיכום של העומס לכל השבוע
 */
export function getWeeklyLoadSummary(weekStart, tasks) {
  const plan = planWeek(weekStart, tasks);
  
  return {
    ...plan.summary,
    days: plan.days.map(day => ({
      date: day.date,
      dayName: day.dayName,
      status: day.status,
      usagePercent: day.usagePercent || 0,
      freeMinutes: day.freeMinutes || 0,
      taskCount: day.tasks?.length || 0
    })),
    recommendations: generateWeeklyRecommendations(plan)
  };
}

/**
 * המלצות שבועיות
 */
function generateWeeklyRecommendations(weekPlan) {
  const recommendations = [];
  
  // ימים עמוסים לעומת ימים פנויים
  const overloadedDays = weekPlan.days.filter(d => d.status === SCHEDULE_STATUS.OVERLOAD);
  const freeDays = weekPlan.days.filter(d => d.isWorkDay && (d.usagePercent || 0) < 50);
  
  if (overloadedDays.length > 0 && freeDays.length > 0) {
    recommendations.push({
      type: 'rebalance',
      message: `יש ${overloadedDays.length} ימים עמוסים ו-${freeDays.length} ימים פנויים יחסית. כדאי לאזן.`,
      action: 'העבירי משימות מימים עמוסים לימים פנויים'
    });
  }
  
  // הרבה משימות דחופות
  const urgentCount = weekPlan.days.reduce((sum, d) => 
    sum + (d.tasks?.filter(t => t.priority === 'urgent').length || 0), 0);
  
  if (urgentCount > 10) {
    recommendations.push({
      type: 'too_urgent',
      message: `יש ${urgentCount} משימות דחופות השבוע - זה הרבה!`,
      action: 'בדקי אם באמת הכל דחוף או שאפשר להוריד עדיפות'
    });
  }
  
  return recommendations;
}

export default {
  planDay,
  planWeek,
  suggestTimeForTask,
  getWeeklyLoadSummary,
  SCHEDULE_STATUS
};

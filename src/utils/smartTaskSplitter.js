/**
 * מנוע פיצול משימות חכם
 * 
 * מחלק משימות ארוכות למשימות קצרות של מקסימום 30 דקות
 * מתחשב בדחיפות (רבע אייזנהאואר), זמן פנוי, ותאריך יעד
 * 
 * עדכון: חלוקה ב-30 דקות, לפי דחיפות, ניצול זמן פנוי
 */

// קונפיגורציה
const CONFIG = {
  MAX_TASK_DURATION: 30,        // מקסימום דקות למשימה אחת - עודכן ל-30
  MIN_TASK_DURATION: 15,        // מינימום דקות למשימה
  BREAK_BETWEEN_TASKS: 5,       // הפסקה בין משימות (דקות) - קוצר ל-5
  WORK_START_HOUR: 8,           // שעת התחלת עבודה
  WORK_END_HOUR: 16,            // שעת סיום עבודה
  WORK_HOURS_PER_DAY: 8,        // שעות עבודה ביום
  WORK_DAYS: [0, 1, 2, 3, 4],   // ימי עבודה (ראשון-חמישי)
  
  // עדיפות לפי רבע אייזנהאואר
  QUADRANT_PRIORITY: {
    1: 1,  // דחוף וחשוב - עדיפות עליונה
    2: 2,  // חשוב לא דחוף - עדיפות גבוהה
    3: 3,  // דחוף לא חשוב - עדיפות בינונית
    4: 4   // לא דחוף לא חשוב - עדיפות נמוכה
  },
  
  // העדפות לפי סוג משימה
  TYPE_PREFERENCES: {
    transcription: { 
      maxDuration: 30,          // תמלול - מקסימום 30 דקות
      preferredHours: [8, 9, 10, 11],
      requiresFocus: true
    },
    proofreading: { 
      maxDuration: 30,          // הגהה - מקסימום 30 דקות
      preferredHours: [10, 11, 12, 13, 14],
      requiresFocus: true
    },
    email: { 
      maxDuration: 30,          // מיילים - מקסימום 30 דקות
      preferredHours: [8, 9, 15, 16],
      requiresFocus: false
    },
    client_communication: { 
      maxDuration: 30,          // תקשורת לקוחות
      preferredHours: [10, 11, 14, 15],
      requiresFocus: false
    },
    course: { 
      maxDuration: 30,          // קורס - 30 דקות
      preferredHours: [9, 10, 11, 14, 15],
      requiresFocus: true
    },
    other: { 
      maxDuration: 30,
      preferredHours: [8, 9, 10, 11, 12, 13, 14, 15, 16],
      requiresFocus: false
    }
  }
};

/**
 * בדיקה אם יום הוא יום עבודה
 */
export function isWorkDay(date) {
  const d = new Date(date);
  return CONFIG.WORK_DAYS.includes(d.getDay());
}

/**
 * קבלת יום העבודה הבא
 */
export function getNextWorkDay(date) {
  const d = new Date(date);
  d.setDate(d.getDate() + 1);
  while (!isWorkDay(d)) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

/**
 * חישוב מספר ימי העבודה בין שני תאריכים
 */
export function countWorkDays(startDate, endDate) {
  let count = 0;
  const current = new Date(startDate);
  const end = new Date(endDate);
  
  while (current <= end) {
    if (isWorkDay(current)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
}

/**
 * חישוב זמן זמין ליום עבודה
 */
export function getAvailableMinutesForDay(date, existingTasks = []) {
  if (!isWorkDay(date)) return 0;
  
  const dateISO = new Date(date).toISOString().split('T')[0];
  const dayTasks = existingTasks.filter(t => {
    const isCompleted = t.is_completed || t.isCompleted;
    const taskDate = t.due_date || t.dueDate;
    const scheduledDate = t.scheduled_date || t.scheduledDate;
    return !isCompleted && (taskDate === dateISO || scheduledDate === dateISO);
  });
  
  const scheduledMinutes = dayTasks.reduce((sum, t) => {
    const duration = t.estimated_duration || t.estimatedDuration || 30;
    return sum + duration;
  }, 0);
  
  return Math.max(0, (CONFIG.WORK_HOURS_PER_DAY * 60) - scheduledMinutes);
}

/**
 * חישוב דקות נותרות להיום (מעכשיו עד סוף יום העבודה)
 */
export function getRemainingMinutesToday() {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const endOfWorkDay = CONFIG.WORK_END_HOUR * 60;
  
  if (currentMinutes >= endOfWorkDay) return 0;
  if (currentMinutes < CONFIG.WORK_START_HOUR * 60) {
    return (CONFIG.WORK_END_HOUR - CONFIG.WORK_START_HOUR) * 60;
  }
  
  return endOfWorkDay - currentMinutes;
}

/**
 * פיצול משימה ארוכה למשימות קטנות של 30 דקות
 * מתחשב בדחיפות ובזמן פנוי
 * 
 * @param {Object} task - המשימה לפיצול
 * @param {Object} options - אפשרויות
 * @returns {Array} רשימת משימות מפוצלות
 */
export function splitTask(task, options = {}) {
  const {
    existingTasks = [],
    workPreferences = {},
    forceMaxDuration = null,
    useAvailableTimeToday = true  // חדש: לנצל זמן פנוי היום
  } = options;

  const totalDuration = task.estimated_duration || 60;
  const taskType = task.task_type || 'other';
  const quadrant = task.quadrant || 2;
  const typePrefs = CONFIG.TYPE_PREFERENCES[taskType] || CONFIG.TYPE_PREFERENCES.other;
  
  // קביעת אורך מקסימלי למשימה - 30 דקות
  const maxDuration = forceMaxDuration || CONFIG.MAX_TASK_DURATION;
  
  // אם המשימה קצרה מספיק, לא צריך לפצל
  if (totalDuration <= maxDuration) {
    return [{
      ...task,
      partIndex: 1,
      totalParts: 1,
      splitDuration: totalDuration
    }];
  }

  // חישוב מספר החלקים (כל אחד 30 דקות)
  const numParts = Math.ceil(totalDuration / maxDuration);
  const basePartDuration = Math.floor(totalDuration / numParts);
  const remainder = totalDuration % numParts;
  
  // קביעת תאריכים
  const today = new Date().toISOString().split('T')[0];
  const startDate = task.start_date ? new Date(task.start_date) : new Date();
  const dueDate = task.due_date ? new Date(task.due_date) : null;
  
  // חישוב זמן פנוי היום
  const availableToday = useAvailableTimeToday 
    ? getAvailableMinutesForDay(today, existingTasks)
    : 0;
  
  // יצירת המשימות המפוצלות
  const splitTasks = [];
  let currentDate = new Date(startDate);
  let partsScheduledToday = 0;
  let minutesUsedToday = 0;
  const maxPartsPerDay = workPreferences.maxTasksPerDay || 8; // יותר חלקים כי הם קצרים יותר

  for (let i = 0; i < numParts; i++) {
    // חישוב אורך החלק הזה
    const partDuration = basePartDuration + (i < remainder ? 1 : 0);
    
    // בדיקה אם יש מקום היום
    const canFitToday = currentDate.toISOString().split('T')[0] === today &&
                        minutesUsedToday + partDuration <= availableToday &&
                        partsScheduledToday < maxPartsPerDay;
    
    // אם אין מקום היום, עוברים ליום הבא
    if (!canFitToday && currentDate.toISOString().split('T')[0] === today) {
      currentDate = getNextWorkDay(currentDate);
      partsScheduledToday = 0;
      minutesUsedToday = 0;
    }
    
    // מעבר ליום הבא אם צריך
    while (!isWorkDay(currentDate) || partsScheduledToday >= maxPartsPerDay) {
      currentDate = getNextWorkDay(currentDate);
      partsScheduledToday = 0;
      minutesUsedToday = 0;
    }
    
    // בדיקה שלא עוברים את תאריך היעד
    if (dueDate && currentDate > dueDate) {
      currentDate = new Date(dueDate);
      while (!isWorkDay(currentDate)) {
        currentDate.setDate(currentDate.getDate() - 1);
      }
    }
    
    // יצירת המשימה המפוצלת
    const splitTask = {
      title: numParts > 1 
        ? `${task.title} (${i + 1}/${numParts})`
        : task.title,
      description: task.description || '',
      quadrant: quadrant,
      task_type: taskType,
      estimated_duration: partDuration,
      due_date: currentDate.toISOString().split('T')[0],
      parent_task_id: task.id || null,
      is_split_task: true,
      partIndex: i + 1,
      totalParts: numParts,
      splitDuration: partDuration,
      original_duration: totalDuration,
      original_title: task.title,
      // חדש: שמירת דחיפות מקורית
      original_quadrant: quadrant,
      urgency_score: CONFIG.QUADRANT_PRIORITY[quadrant] || 4
    };
    
    // העתקת שדות נוספים אם קיימים
    if (task.task_parameter) splitTask.task_parameter = task.task_parameter;
    if (task.priority) splitTask.priority = task.priority;
    if (task.tags) splitTask.tags = task.tags;
    
    splitTasks.push(splitTask);
    partsScheduledToday++;
    minutesUsedToday += partDuration;
    
    // מעבר ליום הבא אם הגענו למקסימום
    if (partsScheduledToday >= maxPartsPerDay && i < numParts - 1) {
      currentDate = getNextWorkDay(currentDate);
      partsScheduledToday = 0;
      minutesUsedToday = 0;
    }
  }
  
  // מיון לפי דחיפות - דחופים ראשונים
  return sortByUrgency(splitTasks);
}

/**
 * מיון משימות לפי דחיפות
 */
export function sortByUrgency(tasks) {
  return tasks.sort((a, b) => {
    // קודם לפי רבע אייזנהאואר (Q1 ראשון)
    const quadrantDiff = (a.quadrant || 4) - (b.quadrant || 4);
    if (quadrantDiff !== 0) return quadrantDiff;
    
    // אחר כך לפי תאריך יעד (מוקדם יותר קודם)
    if (a.due_date && b.due_date) {
      return new Date(a.due_date) - new Date(b.due_date);
    }
    
    // אחר כך לפי מספר חלק (1 קודם ל-2)
    return (a.partIndex || 0) - (b.partIndex || 0);
  });
}

/**
 * חישוב פיצול אופטימלי לפי עומס קיים
 * מתחשב בזמן פנוי ודחיפות
 * 
 * @param {Object} task - המשימה לפיצול
 * @param {Array} existingTasks - משימות קיימות
 * @param {Object} options - אפשרויות
 */
export function calculateOptimalSplit(task, existingTasks = [], options = {}) {
  const totalDuration = task.estimated_duration || 60;
  const quadrant = task.quadrant || 2;
  const today = new Date().toISOString().split('T')[0];
  const startDate = task.start_date ? new Date(task.start_date) : new Date();
  const dueDate = task.due_date ? new Date(task.due_date) : null;
  
  // חישוב זמן זמין בכל יום
  const availableDays = [];
  let currentDate = new Date(startDate);
  const endDate = dueDate || new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000);
  
  while (currentDate <= endDate) {
    if (isWorkDay(currentDate)) {
      const dateISO = currentDate.toISOString().split('T')[0];
      const availableMinutes = getAvailableMinutesForDay(currentDate, existingTasks);
      
      if (availableMinutes >= CONFIG.MIN_TASK_DURATION) {
        availableDays.push({
          date: dateISO,
          availableMinutes,
          isToday: dateISO === today
        });
      }
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // בדיקה אם יש מספיק זמן זמין
  const totalAvailable = availableDays.reduce((sum, d) => sum + d.availableMinutes, 0);
  
  if (totalAvailable < totalDuration) {
    return {
      success: false,
      message: `אין מספיק זמן זמין. נדרש: ${totalDuration} דקות, זמין: ${totalAvailable} דקות`,
      suggestion: 'נסי להאריך את תאריך היעד או לצמצם את אורך המשימה'
    };
  }
  
  // פיצול חכם - שיבוץ לפי זמינות, עדיפות להיום
  const splitTasks = [];
  let remainingDuration = totalDuration;
  let partIndex = 1;
  
  // מיון ימים - היום ראשון (אם המשימה דחופה)
  const sortedDays = [...availableDays].sort((a, b) => {
    // משימות דחופות (Q1) - להתחיל היום
    if (quadrant === 1) {
      if (a.isToday && !b.isToday) return -1;
      if (!a.isToday && b.isToday) return 1;
    }
    return 0;
  });
  
  for (const day of sortedDays) {
    if (remainingDuration <= 0) break;
    
    // כמה זמן נשבץ ביום הזה - עד 30 דקות לחלק
    let dayRemaining = day.availableMinutes;
    
    while (dayRemaining >= CONFIG.MIN_TASK_DURATION && remainingDuration > 0) {
      const durationForPart = Math.min(
        remainingDuration,
        dayRemaining,
        CONFIG.MAX_TASK_DURATION
      );
      
      if (durationForPart >= CONFIG.MIN_TASK_DURATION) {
        splitTasks.push({
          title: `${task.title} (חלק ${partIndex})`,
          description: task.description || '',
          quadrant: quadrant,
          task_type: task.task_type || 'other',
          estimated_duration: durationForPart,
          due_date: day.date,
          parent_task_id: task.id || null,
          is_split_task: true,
          partIndex,
          original_title: task.title,
          original_quadrant: quadrant,
          urgency_score: CONFIG.QUADRANT_PRIORITY[quadrant] || 4
        });
        
        remainingDuration -= durationForPart;
        dayRemaining -= durationForPart + CONFIG.BREAK_BETWEEN_TASKS;
        partIndex++;
      } else {
        break;
      }
    }
  }
  
  // עדכון totalParts בכל המשימות
  const totalParts = splitTasks.length;
  splitTasks.forEach((t, i) => {
    t.title = `${task.title} (${i + 1}/${totalParts})`;
    t.totalParts = totalParts;
  });
  
  // מיון לפי דחיפות
  const sortedTasks = sortByUrgency(splitTasks);
  
  return {
    success: true,
    splitTasks: sortedTasks,
    summary: {
      originalDuration: totalDuration,
      totalParts,
      dates: [...new Set(splitTasks.map(t => t.due_date))],
      scheduledToday: splitTasks.filter(t => t.due_date === today).length
    }
  };
}

/**
 * המלצת פיצול למשימה
 * מחזיר המלצה על איך לפצל את המשימה
 */
export function getSplitRecommendation(task, existingTasks = []) {
  const duration = task.estimated_duration || 60;
  const taskType = task.task_type || 'other';
  const quadrant = task.quadrant || 2;
  const maxDuration = CONFIG.MAX_TASK_DURATION; // 30 דקות
  
  // אם המשימה קצרה מספיק
  if (duration <= maxDuration) {
    return {
      shouldSplit: false,
      reason: 'המשימה קצרה מספיק (עד 30 דקות) ולא צריכה פיצול'
    };
  }
  
  // חישוב פיצול מומלץ
  const numParts = Math.ceil(duration / maxDuration);
  const avgPartDuration = Math.round(duration / numParts);
  
  // בדיקת זמינות
  const today = new Date().toISOString().split('T')[0];
  const startDate = task.start_date ? new Date(task.start_date) : new Date();
  const dueDate = task.due_date ? new Date(task.due_date) : null;
  const availableWorkDays = dueDate ? countWorkDays(startDate, dueDate) : 14;
  
  // בדיקת זמן פנוי היום
  const availableToday = getAvailableMinutesForDay(today, existingTasks);
  const partsCanDoToday = Math.floor(availableToday / maxDuration);
  
  // האם יש מספיק זמן?
  const daysNeeded = Math.ceil(numParts / 8); // עד 8 חלקים ביום
  const hasEnoughTime = availableWorkDays >= daysNeeded;
  
  // המלצה מיוחדת למשימות דחופות
  const isUrgent = quadrant === 1;
  
  return {
    shouldSplit: true,
    reason: `משימה של ${duration} דקות תפוצל ל-${numParts} חלקים של ${avgPartDuration} דקות`,
    recommendation: {
      numParts,
      avgPartDuration,
      daysNeeded,
      hasEnoughTime,
      partsCanDoToday,
      isUrgent,
      warning: !hasEnoughTime 
        ? `יש רק ${availableWorkDays} ימי עבודה זמינים, צריך ${daysNeeded}`
        : null,
      urgentNote: isUrgent && partsCanDoToday > 0
        ? `משימה דחופה! אפשר להתחיל ${partsCanDoToday} חלקים היום`
        : null
    }
  };
}

/**
 * פיצול אוטומטי של משימה חדשה
 * נקרא בעת יצירת משימה עם זמן ארוך
 */
export function autoSplitNewTask(taskData, existingTasks = [], userPreferences = {}) {
  const recommendation = getSplitRecommendation(taskData, existingTasks);
  
  if (!recommendation.shouldSplit) {
    return {
      shouldSplit: false,
      tasks: [taskData]
    };
  }
  
  // ביצוע הפיצול
  const result = calculateOptimalSplit(taskData, existingTasks, {
    workPreferences: userPreferences
  });
  
  if (!result.success) {
    return {
      shouldSplit: true,
      canSplit: false,
      reason: result.message,
      suggestion: result.suggestion,
      tasks: [taskData]
    };
  }
  
  return {
    shouldSplit: true,
    canSplit: true,
    tasks: result.splitTasks,
    summary: result.summary
  };
}

/**
 * חדש: בדיקה אם אפשר להוסיף משימה היום
 */
export function canScheduleToday(task, existingTasks = []) {
  const today = new Date().toISOString().split('T')[0];
  const availableToday = getAvailableMinutesForDay(today, existingTasks);
  const taskDuration = task.estimated_duration || 30;
  
  return {
    canSchedule: availableToday >= taskDuration,
    availableMinutes: availableToday,
    taskDuration,
    freeSlots: Math.floor(availableToday / CONFIG.MAX_TASK_DURATION)
  };
}

/**
 * חדש: קבלת משימות שאפשר לדחות כדי לפנות מקום
 */
export function getDefferableTasks(tasks, requiredMinutes) {
  const today = new Date().toISOString().split('T')[0];
  
  // משימות של היום שאפשר לדחות (לא Q1, לא הושלמו)
  const deferrable = tasks
    .filter(t => 
      t.due_date === today && 
      !t.is_completed && 
      t.quadrant !== 1  // לא דחוף וחשוב
    )
    .map(t => ({
      ...t,
      deferPriority: CONFIG.QUADRANT_PRIORITY[t.quadrant] || 4
    }))
    .sort((a, b) => b.deferPriority - a.deferPriority); // Q4 קודם, אחר כך Q3, אחר כך Q2
  
  // בחירת משימות לדחייה
  const toDefer = [];
  let freedMinutes = 0;
  
  for (const task of deferrable) {
    if (freedMinutes >= requiredMinutes) break;
    toDefer.push(task);
    freedMinutes += task.estimated_duration || 30;
  }
  
  return {
    tasksToDefer: toDefer,
    freedMinutes,
    sufficient: freedMinutes >= requiredMinutes
  };
}

export default {
  CONFIG,
  isWorkDay,
  getNextWorkDay,
  countWorkDays,
  getAvailableMinutesForDay,
  getRemainingMinutesToday,
  splitTask,
  sortByUrgency,
  calculateOptimalSplit,
  getSplitRecommendation,
  autoSplitNewTask,
  canScheduleToday,
  getDefferableTasks
};

/**
 * מנוע פיצול משימות חכם
 * 
 * מחלק משימות ארוכות למשימות קצרות של מקסימום 60 דקות
 * מתחשב בתאריך התחלה, תאריך יעד, דחיפות וזמני עבודה
 */

// קונפיגורציה
const CONFIG = {
  MAX_TASK_DURATION: 60,        // מקסימום דקות למשימה אחת
  MIN_TASK_DURATION: 15,        // מינימום דקות למשימה
  BREAK_BETWEEN_TASKS: 10,      // הפסקה בין משימות (דקות)
  WORK_START_HOUR: 8,           // שעת התחלת עבודה
  WORK_END_HOUR: 16,            // שעת סיום עבודה
  WORK_HOURS_PER_DAY: 8,        // שעות עבודה ביום
  WORK_DAYS: [0, 1, 2, 3, 4],   // ימי עבודה (ראשון-חמישי)
  
  // העדפות לפי סוג משימה
  TYPE_PREFERENCES: {
    transcription: { 
      maxDuration: 45,          // תמלול - מקסימום 45 דקות
      preferredHours: [8, 9, 10, 11],  // שעות מועדפות
      requiresFocus: true
    },
    proofreading: { 
      maxDuration: 45,          // הגהה - מקסימום 45 דקות
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
      maxDuration: 60,          // קורס - אפשר שעה
      preferredHours: [9, 10, 11, 14, 15],
      requiresFocus: true
    },
    other: { 
      maxDuration: 60,
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
  const dayTasks = existingTasks.filter(t => 
    !t.is_completed && 
    (t.due_date === dateISO || t.scheduled_date === dateISO)
  );
  
  const scheduledMinutes = dayTasks.reduce((sum, t) => 
    sum + (t.estimated_duration || 30), 0
  );
  
  return Math.max(0, (CONFIG.WORK_HOURS_PER_DAY * 60) - scheduledMinutes);
}

/**
 * פיצול משימה ארוכה למשימות קטנות
 * 
 * @param {Object} task - המשימה לפיצול
 * @param {Object} options - אפשרויות
 * @returns {Array} רשימת משימות מפוצלות
 */
export function splitTask(task, options = {}) {
  const {
    existingTasks = [],
    workPreferences = {},
    forceMaxDuration = null
  } = options;

  const totalDuration = task.estimated_duration || 60;
  const taskType = task.task_type || 'other';
  const typePrefs = CONFIG.TYPE_PREFERENCES[taskType] || CONFIG.TYPE_PREFERENCES.other;
  
  // קביעת אורך מקסימלי למשימה
  const maxDuration = forceMaxDuration || typePrefs.maxDuration || CONFIG.MAX_TASK_DURATION;
  
  // אם המשימה קצרה מספיק, לא צריך לפצל
  if (totalDuration <= maxDuration) {
    return [{
      ...task,
      partIndex: 1,
      totalParts: 1,
      splitDuration: totalDuration
    }];
  }

  // חישוב מספר החלקים
  const numParts = Math.ceil(totalDuration / maxDuration);
  const basePartDuration = Math.floor(totalDuration / numParts);
  const remainder = totalDuration % numParts;
  
  // קביעת תאריכים
  const startDate = task.start_date ? new Date(task.start_date) : new Date();
  const dueDate = task.due_date ? new Date(task.due_date) : null;
  
  // חישוב ימי עבודה זמינים
  const availableWorkDays = dueDate 
    ? countWorkDays(startDate, dueDate)
    : numParts + 2; // ברירת מחדל - מספיק ימים + מרווח
  
  // יצירת המשימות המפוצלות
  const splitTasks = [];
  let currentDate = new Date(startDate);
  let partsScheduledToday = 0;
  const maxPartsPerDay = workPreferences.maxTasksPerDay || 3;
  
  for (let i = 0; i < numParts; i++) {
    // חישוב אורך החלק הזה
    const partDuration = basePartDuration + (i < remainder ? 1 : 0);
    
    // מעבר ליום הבא אם צריך
    while (!isWorkDay(currentDate) || partsScheduledToday >= maxPartsPerDay) {
      currentDate = getNextWorkDay(currentDate);
      partsScheduledToday = 0;
    }
    
    // בדיקה שלא עוברים את תאריך היעד
    if (dueDate && currentDate > dueDate) {
      // אם עוברים את היעד, נדחס את המשימות הנותרות ליום האחרון
      currentDate = new Date(dueDate);
      while (!isWorkDay(currentDate)) {
        currentDate.setDate(currentDate.getDate() - 1);
      }
    }
    
    // יצירת המשימה המפוצלת
    const splitTask = {
      title: numParts > 1 
        ? `${task.title} (חלק ${i + 1}/${numParts})`
        : task.title,
      description: task.description || '',
      quadrant: task.quadrant || 2,
      task_type: taskType,
      estimated_duration: partDuration,
      due_date: currentDate.toISOString().split('T')[0],
      parent_task_id: task.id || null,
      is_split_task: true,
      partIndex: i + 1,
      totalParts: numParts,
      splitDuration: partDuration,
      original_duration: totalDuration,
      original_title: task.title
    };
    
    // העתקת שדות נוספים אם קיימים
    if (task.task_parameter) splitTask.task_parameter = task.task_parameter;
    if (task.priority) splitTask.priority = task.priority;
    if (task.tags) splitTask.tags = task.tags;
    
    splitTasks.push(splitTask);
    partsScheduledToday++;
    
    // מעבר ליום הבא אם הגענו למקסימום
    if (partsScheduledToday >= maxPartsPerDay && i < numParts - 1) {
      currentDate = getNextWorkDay(currentDate);
      partsScheduledToday = 0;
    }
  }
  
  return splitTasks;
}

/**
 * חישוב פיצול אופטימלי לפי עומס קיים
 * 
 * @param {Object} task - המשימה לפיצול
 * @param {Array} existingTasks - משימות קיימות
 * @param {Object} options - אפשרויות
 */
export function calculateOptimalSplit(task, existingTasks = [], options = {}) {
  const totalDuration = task.estimated_duration || 60;
  const startDate = task.start_date ? new Date(task.start_date) : new Date();
  const dueDate = task.due_date ? new Date(task.due_date) : null;
  
  // חישוב זמן זמין בכל יום
  const availableDays = [];
  let currentDate = new Date(startDate);
  const endDate = dueDate || new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000); // שבועיים קדימה
  
  while (currentDate <= endDate) {
    if (isWorkDay(currentDate)) {
      const availableMinutes = getAvailableMinutesForDay(currentDate, existingTasks);
      if (availableMinutes >= CONFIG.MIN_TASK_DURATION) {
        availableDays.push({
          date: currentDate.toISOString().split('T')[0],
          availableMinutes
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
      suggestion: 'נסה להאריך את תאריך היעד או לצמצם את אורך המשימה'
    };
  }
  
  // פיצול חכם - שיבוץ לפי זמינות
  const splitTasks = [];
  let remainingDuration = totalDuration;
  let partIndex = 1;
  
  for (const day of availableDays) {
    if (remainingDuration <= 0) break;
    
    // כמה זמן נשבץ ביום הזה
    const durationForDay = Math.min(
      remainingDuration,
      day.availableMinutes,
      CONFIG.MAX_TASK_DURATION
    );
    
    if (durationForDay >= CONFIG.MIN_TASK_DURATION) {
      splitTasks.push({
        title: `${task.title} (חלק ${partIndex})`,
        description: task.description || '',
        quadrant: task.quadrant || 2,
        task_type: task.task_type || 'other',
        estimated_duration: durationForDay,
        due_date: day.date,
        parent_task_id: task.id || null,
        is_split_task: true,
        partIndex,
        original_title: task.title
      });
      
      remainingDuration -= durationForDay;
      partIndex++;
    }
  }
  
  // עדכון totalParts בכל המשימות
  const totalParts = splitTasks.length;
  splitTasks.forEach((t, i) => {
    t.title = `${task.title} (חלק ${i + 1}/${totalParts})`;
    t.totalParts = totalParts;
  });
  
  return {
    success: true,
    splitTasks,
    summary: {
      originalDuration: totalDuration,
      totalParts,
      dates: splitTasks.map(t => t.due_date)
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
  const typePrefs = CONFIG.TYPE_PREFERENCES[taskType] || CONFIG.TYPE_PREFERENCES.other;
  
  // אם המשימה קצרה מספיק
  if (duration <= typePrefs.maxDuration) {
    return {
      shouldSplit: false,
      reason: 'המשימה קצרה מספיק ולא צריכה פיצול'
    };
  }
  
  // חישוב פיצול מומלץ
  const numParts = Math.ceil(duration / typePrefs.maxDuration);
  const avgPartDuration = Math.round(duration / numParts);
  
  // בדיקת זמינות
  const startDate = task.start_date ? new Date(task.start_date) : new Date();
  const dueDate = task.due_date ? new Date(task.due_date) : null;
  const availableWorkDays = dueDate ? countWorkDays(startDate, dueDate) : 14;
  
  // האם יש מספיק זמן?
  const daysNeeded = Math.ceil(numParts / 2); // הנחה של 2 חלקים ביום
  const hasEnoughTime = availableWorkDays >= daysNeeded;
  
  return {
    shouldSplit: true,
    reason: `משימה של ${duration} דקות ארוכה מדי לסוג "${typePrefs.maxDuration}" דקות`,
    recommendation: {
      numParts,
      avgPartDuration,
      daysNeeded,
      hasEnoughTime,
      warning: !hasEnoughTime 
        ? `יש רק ${availableWorkDays} ימי עבודה זמינים, צריך ${daysNeeded}`
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
      tasks: [taskData] // מחזירים את המשימה המקורית
    };
  }
  
  return {
    shouldSplit: true,
    canSplit: true,
    tasks: result.splitTasks,
    summary: result.summary
  };
}

export default {
  CONFIG,
  isWorkDay,
  getNextWorkDay,
  countWorkDays,
  getAvailableMinutesForDay,
  splitTask,
  calculateOptimalSplit,
  getSplitRecommendation,
  autoSplitNewTask
};

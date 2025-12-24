/**
 * תכנון אוטומטי של היום והשבוע
 * המערכת מתכננת אוטומטית מתי לעבוד על מה לפי:
 * - עדיפויות
 * - רמת אנרגיה
 * - זמינות
 * - דפוסי עבודה
 */

import { detectTaskCategory, TASK_CATEGORIES } from './taskCategories';
import { calculateEnergyLevel, hasEnoughEnergy, findOptimalHoursForTask, analyzeEnergyPatterns } from './energyManagement';
import { isTaskOverdue, isTaskDueToday, isTaskDueTomorrow } from './taskHelpers';

/**
 * תכנון יום אוטומטי
 */
export function scheduleDay(tasks, date, workPatterns = null, existingBlocks = []) {
  const scheduledBlocks = [];
  const unscheduledTasks = [];
  
  // סינון משימות רלוונטיות (לא הושלמו, עם תאריך יעד או ללא)
  const relevantTasks = tasks
    .filter(t => !t.is_completed)
    .sort((a, b) => {
      // מיון לפי עדיפות:
      // 1. משימות באיחור
      // 2. משימות היום
      // 3. משימות מחר
      // 4. משימות לפי רבע (1 > 2 > 3 > 4)
      // 5. משימות לפי תאריך יעד
      
      const aOverdue = isTaskOverdue(a);
      const bOverdue = isTaskOverdue(b);
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
      
      const aToday = isTaskDueToday(a);
      const bToday = isTaskDueToday(b);
      if (aToday !== bToday) return aToday ? -1 : 1;
      
      const aTomorrow = isTaskDueTomorrow(a);
      const bTomorrow = isTaskDueTomorrow(b);
      if (aTomorrow !== bTomorrow) return aTomorrow ? -1 : 1;
      
      if (a.quadrant !== b.quadrant) {
        return a.quadrant - b.quadrant; // 1 < 2 < 3 < 4
      }
      
      if (a.due_date && b.due_date) {
        return new Date(a.due_date) - new Date(b.due_date);
      }
      
      return a.due_date ? -1 : 1;
    });
  
  // שעות עבודה טיפוסיות (ניתן להתאים)
  const workHours = getWorkHours(date, workPatterns);
  
  // תכנון כל משימה
  let currentTime = new Date(date);
  currentTime.setHours(workHours.start, 0, 0, 0);
  
  relevantTasks.forEach(task => {
    const block = scheduleTask(task, currentTime, workHours, existingBlocks, workPatterns);
    
    if (block) {
      scheduledBlocks.push(block);
      // עדכון זמן נוכחי (עם הפסקה)
      currentTime = new Date(block.end_time);
      currentTime.setMinutes(currentTime.getMinutes() + getBreakTime(task));
    } else {
      unscheduledTasks.push(task);
    }
  });
  
  return {
    scheduledBlocks,
    unscheduledTasks,
    totalScheduledTime: scheduledBlocks.reduce((sum, b) => {
      const duration = (new Date(b.end_time) - new Date(b.start_time)) / (1000 * 60);
      return sum + duration;
    }, 0),
    utilizationRate: calculateUtilizationRate(scheduledBlocks, workHours)
  };
}

/**
 * תכנון משימה בודדת
 */
function scheduleTask(task, startTime, workHours, existingBlocks, workPatterns) {
  const { category } = detectTaskCategory(task);
  const duration = task.estimated_duration || category.typicalDuration || 60;
  
  // מציאת זמן אופטימלי
  const optimalHours = findOptimalHoursForTask(task, workPatterns);
  const taskHour = new Date(startTime).getHours();
  
  // בדיקה אם יש מספיק אנרגיה
  if (!hasEnoughEnergy(task, taskHour, workPatterns)) {
    // נחפש שעה טובה יותר
    const betterHour = optimalHours[0]?.hour;
    if (betterHour) {
      startTime = new Date(startTime);
      startTime.setHours(betterHour, 0, 0, 0);
    }
  }
  
  // בדיקה שהזמן לא חורג משעות העבודה
  if (startTime.getHours() < workHours.start || startTime.getHours() >= workHours.end) {
    startTime = new Date(startTime);
    startTime.setHours(workHours.start, 0, 0, 0);
  }
  
  // חישוב זמן סיום
  let endTime = new Date(startTime);
  endTime.setMinutes(endTime.getMinutes() + duration);
  
  // בדיקה שהזמן לא חורג משעות העבודה
  if (endTime.getHours() >= workHours.end) {
    // נקצר את המשימה או נדחה למחר
    const maxEnd = new Date(startTime);
    maxEnd.setHours(workHours.end, 0, 0, 0);
    
    if (maxEnd <= startTime) {
      // אין זמן היום
      return null;
    }
    
    endTime.setTime(maxEnd.getTime());
  }
  
  // בדיקת התנגשויות עם בלוקים קיימים
  if (hasConflict(startTime, endTime, existingBlocks)) {
    // ננסה למצוא זמן אחר
    const nextAvailable = findNextAvailableTime(startTime, endTime, existingBlocks, workHours);
    if (!nextAvailable) {
      return null; // אין זמן פנוי
    }
    startTime = nextAvailable.start;
    endTime = nextAvailable.end;
  }
  
  return {
    task_id: task.id,
    title: task.title,
    description: `תכנון אוטומטי: ${category.name}`,
    start_time: startTime.toISOString(),
    end_time: endTime.toISOString(),
    category: category.id,
    priority: task.quadrant,
    autoScheduled: true
  };
}

/**
 * קבלת שעות עבודה
 */
function getWorkHours(date, workPatterns) {
  // אם יש דפוסי עבודה, נשתמש בהם
  if (workPatterns?.dayPatterns) {
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
    const dayPattern = workPatterns.dayPatterns[dayName];
    
    if (dayPattern && dayPattern.typicalStart && dayPattern.typicalEnd) {
      return {
        start: dayPattern.typicalStart,
        end: dayPattern.typicalEnd
      };
    }
  }
  
  // ברירת מחדל
  const dayOfWeek = date.getDay();
  
  // סוף שבוע - פחות שעות
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return { start: 9, end: 14 };
  }
  
  // יום חול - שעות רגילות
  return { start: 8, end: 18 };
}

/**
 * בדיקת התנגשות עם בלוקים קיימים
 */
function hasConflict(startTime, endTime, existingBlocks) {
  return existingBlocks.some(block => {
    const blockStart = new Date(block.start_time);
    const blockEnd = new Date(block.end_time);
    
    return (startTime < blockEnd && endTime > blockStart);
  });
}

/**
 * מציאת זמן פנוי הבא
 */
function findNextAvailableTime(startTime, endTime, existingBlocks, workHours) {
  const duration = endTime - startTime;
  let currentTime = new Date(startTime);
  
  // נחפש עד סוף שעות העבודה
  const maxTime = new Date(currentTime);
  maxTime.setHours(workHours.end, 0, 0, 0);
  
  while (currentTime < maxTime) {
    const testEnd = new Date(currentTime);
    testEnd.setTime(testEnd.getTime() + duration);
    
    if (testEnd.getHours() >= workHours.end) {
      break; // אין זמן מספיק
    }
    
    if (!hasConflict(currentTime, testEnd, existingBlocks)) {
      return {
        start: new Date(currentTime),
        end: testEnd
      };
    }
    
    // נזוז 15 דקות קדימה
    currentTime.setMinutes(currentTime.getMinutes() + 15);
  }
  
  return null;
}

/**
 * חישוב זמן הפסקה בין משימות
 */
function getBreakTime(task) {
  const { category } = detectTaskCategory(task);
  const duration = task.estimated_duration || category.typicalDuration || 60;
  
  // הפסקה לפי משך המשימה
  if (duration >= 120) return 15; // הפסקה ארוכה אחרי משימה ארוכה
  if (duration >= 60) return 10;
  return 5; // הפסקה קצרה
}

/**
 * חישוב שיעור ניצול זמן
 */
function calculateUtilizationRate(scheduledBlocks, workHours) {
  const totalWorkMinutes = (workHours.end - workHours.start) * 60;
  const scheduledMinutes = scheduledBlocks.reduce((sum, block) => {
    const duration = (new Date(block.end_time) - new Date(block.start_time)) / (1000 * 60);
    return sum + duration;
  }, 0);
  
  return totalWorkMinutes > 0 
    ? Math.round((scheduledMinutes / totalWorkMinutes) * 100) 
    : 0;
}

/**
 * תכנון שבוע אוטומטי
 */
export function scheduleWeek(tasks, weekStart, workPatterns = null, existingBlocks = []) {
  const weekSchedule = {};
  const weekDays = [];
  
  // יצירת מערך ימים
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    weekDays.push(date);
  }
  
  // תכנון כל יום
  weekDays.forEach(day => {
    const dayBlocks = existingBlocks.filter(block => {
      const blockDate = new Date(block.start_time);
      return blockDate.toDateString() === day.toDateString();
    });
    
    const schedule = scheduleDay(tasks, day, workPatterns, dayBlocks);
    weekSchedule[day.toISOString().split('T')[0]] = schedule;
  });
  
  return {
    weekSchedule,
    summary: calculateWeekSummary(weekSchedule)
  };
}

/**
 * חישוב סיכום שבוע
 */
function calculateWeekSummary(weekSchedule) {
  let totalScheduled = 0;
  let totalUnscheduled = 0;
  let totalTime = 0;
  
  Object.values(weekSchedule).forEach(day => {
    totalScheduled += day.scheduledBlocks.length;
    totalUnscheduled += day.unscheduledTasks.length;
    totalTime += day.totalScheduledTime;
  });
  
  return {
    totalScheduled,
    totalUnscheduled,
    totalTime,
    averageUtilization: Object.values(weekSchedule).reduce((sum, day) => 
      sum + day.utilizationRate, 0) / Object.keys(weekSchedule).length
  };
}

/**
 * המלצות לשיפור התכנון
 */
export function getSchedulingRecommendations(schedule, tasks) {
  const recommendations = [];
  
  // בדיקת עומס יתר
  if (schedule.utilizationRate > 90) {
    recommendations.push({
      type: 'overload',
      priority: 'high',
      message: 'יום עמוס מדי! שימי לב שלא תתעייפי. כדאי לדחות חלק מהמשימות.',
      action: 'הצג משימות שניתן לדחות'
    });
  }
  
  // בדיקת משימות לא מתוכננות
  if (schedule.unscheduledTasks.length > 0) {
    recommendations.push({
      type: 'unscheduled',
      priority: 'medium',
      message: `יש ${schedule.unscheduledTasks.length} משימות שלא נכנסו לתכנון. כדאי לבדוק אם אפשר לדחות או לחלק אותן.`,
      action: 'הצג משימות לא מתוכננות'
    });
  }
  
  // בדיקת משימות באיחור
  const overdueTasks = schedule.unscheduledTasks.filter(t => isTaskOverdue(t));
  if (overdueTasks.length > 0) {
    recommendations.push({
      type: 'overdue',
      priority: 'high',
      message: `יש ${overdueTasks.length} משימות באיחור שלא נכנסו לתכנון!`,
      action: 'הצג משימות באיחור'
    });
  }
  
  // בדיקת איזון אנרגיה
  const highEnergyTasks = schedule.scheduledBlocks.filter(b => {
    const task = tasks.find(t => t.id === b.task_id);
    if (!task) return false;
    const { category } = detectTaskCategory(task);
    return category.energyLevel === 'high';
  });
  
  if (highEnergyTasks.length > 3) {
    recommendations.push({
      type: 'energy_balance',
      priority: 'medium',
      message: 'יש הרבה משימות קשות ביום אחד. כדאי לפזר אותן על פני כמה ימים.',
      action: 'ארגן מחדש'
    });
  }
  
  return recommendations;
}

export default {
  scheduleDay,
  scheduleWeek,
  getSchedulingRecommendations
};


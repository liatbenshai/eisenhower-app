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
  getSchedulingRecommendations,
  findFreeSlots,
  findAllFreeSlots,
  calculateTotalFreeTime,
  scheduleLongTask,
  getScheduleSummary,
  checkScheduleFeasibility
};

// ==========================================
// שיבוץ משימות ארוכות בזמנים פנויים
// ==========================================

const WORK_HOURS_CONFIG = {
  start: 8,
  end: 16,
  slotMinutes: 30
};

/**
 * המרת שעה לדקות
 */
function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + (minutes || 0);
}

/**
 * המרת דקות לשעה
 */
function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * קבלת תאריך בפורמט ISO
 */
function getDateISO(date) {
  return date.toISOString().split('T')[0];
}

/**
 * בדיקה אם יום הוא יום עבודה
 */
function isWorkDay(date) {
  const day = date.getDay();
  return day >= 0 && day <= 4;
}

/**
 * מציאת זמנים פנויים ביום מסוים
 */
export function findFreeSlots(dateISO, existingTasks) {
  const dayTasks = existingTasks.filter(t => 
    t.due_date === dateISO && 
    t.due_time && 
    !t.is_completed
  );

  const busySlots = dayTasks.map(t => ({
    start: timeToMinutes(t.due_time),
    end: timeToMinutes(t.due_time) + (t.estimated_duration || 30)
  })).sort((a, b) => a.start - b.start);

  const freeSlots = [];
  let currentStart = WORK_HOURS_CONFIG.start * 60;
  const dayEnd = WORK_HOURS_CONFIG.end * 60;

  for (const busy of busySlots) {
    if (busy.start > currentStart) {
      const freeMinutes = busy.start - currentStart;
      if (freeMinutes >= WORK_HOURS_CONFIG.slotMinutes) {
        freeSlots.push({
          start: currentStart,
          end: busy.start,
          minutes: freeMinutes
        });
      }
    }
    currentStart = Math.max(currentStart, busy.end);
  }

  if (currentStart < dayEnd) {
    const freeMinutes = dayEnd - currentStart;
    if (freeMinutes >= WORK_HOURS_CONFIG.slotMinutes) {
      freeSlots.push({
        start: currentStart,
        end: dayEnd,
        minutes: freeMinutes
      });
    }
  }

  return freeSlots;
}

/**
 * מציאת כל הזמנים הפנויים בין שני תאריכים
 */
export function findAllFreeSlots(startDate, endDate, existingTasks) {
  const allSlots = [];
  const current = new Date(startDate);
  
  while (current <= endDate) {
    if (isWorkDay(current)) {
      const dateISO = getDateISO(current);
      const slots = findFreeSlots(dateISO, existingTasks);
      
      slots.forEach(slot => {
        allSlots.push({
          date: dateISO,
          ...slot
        });
      });
    }
    current.setDate(current.getDate() + 1);
  }
  
  return allSlots;
}

/**
 * חישוב סה"כ זמן פנוי
 */
export function calculateTotalFreeTime(startDate, endDate, existingTasks) {
  const slots = findAllFreeSlots(startDate, endDate, existingTasks);
  return slots.reduce((sum, slot) => sum + slot.minutes, 0);
}

/**
 * שיבוץ משימה ארוכה בזמנים פנויים
 */
export function scheduleLongTask(longTask, existingTasks) {
  const {
    title,
    totalDuration,
    startDate,
    endDate,
    maxSessionMinutes = 90,
    minSessionMinutes = 30,
    taskType = 'transcription'
  } = longTask;

  const freeSlots = findAllFreeSlots(
    new Date(startDate), 
    new Date(endDate), 
    existingTasks
  );

  if (freeSlots.length === 0) {
    return { success: false, error: 'אין זמנים פנויים בתקופה שנבחרה', sessions: [] };
  }

  const totalFreeMinutes = freeSlots.reduce((sum, slot) => sum + slot.minutes, 0);
  
  if (totalFreeMinutes < totalDuration) {
    return { 
      success: false, 
      error: `אין מספיק זמן פנוי. דרוש: ${Math.round(totalDuration/60)} שעות, פנוי: ${Math.round(totalFreeMinutes/60)} שעות`,
      sessions: [],
      totalFreeMinutes
    };
  }

  const sessions = [];
  let remainingDuration = totalDuration;
  let sessionIndex = 1;

  for (const slot of freeSlots) {
    if (remainingDuration <= 0) break;

    let sessionDuration = Math.min(
      remainingDuration,
      slot.minutes,
      maxSessionMinutes
    );

    if (remainingDuration - sessionDuration < minSessionMinutes && remainingDuration <= maxSessionMinutes) {
      sessionDuration = remainingDuration;
    }

    if (sessionDuration >= minSessionMinutes || remainingDuration === sessionDuration) {
      sessions.push({
        title: `${title} - חלק ${sessionIndex}`,
        dueDate: slot.date,
        dueTime: minutesToTime(slot.start),
        estimatedDuration: sessionDuration,
        orderIndex: sessionIndex - 1,
        description: `חלק ${sessionIndex} מתוך המשימה "${title}"`,
        task_type: taskType
      });

      sessionIndex++;
      remainingDuration -= sessionDuration;
    }
  }

  return {
    success: remainingDuration <= 0,
    sessions,
    totalSessions: sessions.length,
    scheduledMinutes: totalDuration - remainingDuration,
    remainingMinutes: Math.max(0, remainingDuration)
  };
}

/**
 * הצגת סיכום שיבוץ
 */
export function getScheduleSummary(scheduleResult) {
  if (!scheduleResult.success) {
    return {
      text: scheduleResult.error,
      type: 'error'
    };
  }

  const { sessions, totalSessions, scheduledMinutes } = scheduleResult;
  const hours = Math.floor(scheduledMinutes / 60);
  const mins = scheduledMinutes % 60;
  
  const byDay = {};
  sessions.forEach(s => {
    if (!byDay[s.dueDate]) byDay[s.dueDate] = [];
    byDay[s.dueDate].push(s);
  });

  const daysCount = Object.keys(byDay).length;

  return {
    text: `${totalSessions} חלקים, ${hours > 0 ? `${hours} שעות` : ''}${mins > 0 ? ` ו-${mins} דקות` : ''}, ב-${daysCount} ימים`,
    type: 'success',
    details: byDay
  };
}

/**
 * בדיקת התכנות שיבוץ
 */
export function checkScheduleFeasibility(totalDuration, startDate, endDate, existingTasks) {
  const totalFree = calculateTotalFreeTime(
    new Date(startDate), 
    new Date(endDate), 
    existingTasks
  );

  const feasible = totalFree >= totalDuration;
  const utilizationPercent = Math.round((totalDuration / totalFree) * 100);

  return {
    feasible,
    totalFreeMinutes: totalFree,
    requiredMinutes: totalDuration,
    utilizationPercent: Math.min(100, utilizationPercent),
    message: feasible 
      ? `יש מספיק זמן פנוי (${Math.round(totalFree / 60)} שעות)`
      : `חסרות ${Math.round((totalDuration - totalFree) / 60)} שעות`
  };
}


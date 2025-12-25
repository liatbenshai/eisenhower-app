/**
 * מנוע שיבוץ חכם
 * 
 * כללים:
 * 1. קיבולת יומית: 7 שעות (420 דקות)
 * 2. שעות עבודה: 08:00-17:00
 * 3. הפסקה כל 90 דקות
 * 4. הפסקת צהריים: 12:00-12:30
 * 5. משימות משובצות הכי מוקדם שאפשר (לא דוחים לרגע האחרון)
 */

// קונפיגורציה - מעודכן לפי העדפות המשתמשת
const CONFIG = {
  WORK_START_HOUR: 8,          // תחילת יום עבודה: 08:00
  WORK_END_HOUR: 17,           // סוף יום עבודה: 17:00
  DAILY_CAPACITY: 420,         // 7 שעות = 420 דקות
  BREAK_AFTER_MINUTES: 90,     // הפסקה אחרי 90 דקות
  BREAK_DURATION: 10,          // הפסקה של 10 דקות
  LUNCH_START_HOUR: 12,        // צהריים ב-12:00
  LUNCH_DURATION: 30,          // 30 דקות צהריים
  INTERVAL_MINUTES: 45,        // אורך אינטרוול מקסימלי
  WORK_DAYS: [0, 1, 2, 3, 4],  // ראשון עד חמישי
  MAX_DAYS_AHEAD: 14           // חיפוש עד 14 יום קדימה
};

// סדר עדיפויות לסוגי משימות (נמוך = קודם בבוקר)
const TYPE_PRIORITY = {
  transcription: 1,    // תמלול - ראשון בבוקר
  proofreading: 2,     // הגהה - אחרי תמלולים
  typing: 3,           // הקלדה
  recording: 4,        // הקלטה
  communication: 5,    // תקשורת
  admin: 6,            // מנהלה
  planning: 7,         // תכנון
  learning: 8,         // למידה
  other: 9             // אחר
};

/**
 * חלוקת משימה לאינטרוולים של 45 דקות
 */
export function splitToIntervals(task) {
  const totalMinutes = task.estimated_duration || 45;
  const intervalCount = Math.ceil(totalMinutes / CONFIG.INTERVAL_MINUTES);
  
  const intervals = [];
  let remainingMinutes = totalMinutes;
  
  for (let i = 0; i < intervalCount; i++) {
    const duration = Math.min(CONFIG.INTERVAL_MINUTES, remainingMinutes);
    intervals.push({
      taskId: task.id,
      taskTitle: task.title,
      taskType: task.task_type || 'other',
      quadrant: task.quadrant || 4,
      deadline: task.due_date,
      intervalIndex: i + 1,
      totalIntervals: intervalCount,
      duration,
      originalTask: task
    });
    remainingMinutes -= duration;
  }
  
  return intervals;
}

/**
 * חישוב עדיפות משימה
 * נמוך יותר = עדיפות גבוהה יותר
 */
export function calculatePriority(interval, referenceDate) {
  let priority = 0;
  
  // 1. דחיפות לפי רבעון (דחוף וחשוב = 0, לא דחוף לא חשוב = 300)
  priority += (interval.quadrant - 1) * 100;
  
  // 2. קרבה לדדליין (0-50 נקודות)
  if (interval.deadline) {
    const deadline = new Date(interval.deadline);
    const ref = new Date(referenceDate);
    const daysUntilDeadline = Math.ceil((deadline - ref) / (1000 * 60 * 60 * 24));
    priority += Math.max(0, Math.min(50, daysUntilDeadline * 10));
  }
  
  // 3. סוג משימה (1-9 נקודות)
  priority += (TYPE_PRIORITY[interval.taskType] || 9);
  
  return priority;
}

/**
 * מציאת כל החלונות הפנויים ביום מסוים
 */
export function findDaySlots(dateISO, scheduledSlots = []) {
  const daySlots = scheduledSlots.filter(s => s.date === dateISO);
  const freeSlots = [];
  
  // התחלה וסוף יום העבודה בדקות
  let currentMinute = CONFIG.WORK_START_HOUR * 60;
  const endMinute = CONFIG.WORK_END_HOUR * 60;
  
  // מיון החלונות התפוסים לפי שעת התחלה
  const occupied = daySlots
    .map(s => ({
      start: timeToMinutes(s.time),
      end: timeToMinutes(s.time) + s.duration + CONFIG.BREAK_MINUTES
    }))
    .sort((a, b) => a.start - b.start);
  
  for (const slot of occupied) {
    if (currentMinute < slot.start) {
      // יש חלון פנוי לפני המשימה הזו
      freeSlots.push({
        start: currentMinute,
        end: slot.start,
        duration: slot.start - currentMinute
      });
    }
    currentMinute = Math.max(currentMinute, slot.end);
  }
  
  // חלון אחרון עד סוף היום
  if (currentMinute < endMinute) {
    freeSlots.push({
      start: currentMinute,
      end: endMinute,
      duration: endMinute - currentMinute
    });
  }
  
  return freeSlots;
}

/**
 * בדיקה אם יום הוא יום עבודה
 */
export function isWorkDay(dateISO) {
  const date = new Date(dateISO);
  return CONFIG.WORK_DAYS.includes(date.getDay());
}

/**
 * קבלת יום העבודה הבא
 */
export function getNextWorkDay(dateISO) {
  const date = new Date(dateISO);
  date.setDate(date.getDate() + 1);
  
  while (!isWorkDay(date.toISOString().split('T')[0])) {
    date.setDate(date.getDate() + 1);
  }
  
  return date.toISOString().split('T')[0];
}

/**
 * המרת שעה לדקות
 */
function timeToMinutes(timeStr) {
  if (!timeStr) return CONFIG.WORK_START_HOUR * 60;
  const [hours, mins] = timeStr.split(':').map(Number);
  return hours * 60 + mins;
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
 * שיבוץ חכם - הפונקציה הראשית
 */
export function smartSchedule(tasks, existingSchedule = []) {
  // 1. סינון משימות לשיבוץ (לא הושלמו, יש דדליין)
  const tasksToSchedule = tasks.filter(t => 
    !t.is_completed && 
    t.due_date &&
    t.estimated_duration
  );
  
  // 2. חלוקה לאינטרוולים
  let allIntervals = [];
  for (const task of tasksToSchedule) {
    const intervals = splitToIntervals(task);
    allIntervals = allIntervals.concat(intervals);
  }
  
  // 3. מיון לפי עדיפות
  const today = new Date().toISOString().split('T')[0];
  allIntervals.sort((a, b) => {
    const priorityA = calculatePriority(a, today);
    const priorityB = calculatePriority(b, today);
    return priorityA - priorityB;
  });
  
  // 4. שיבוץ בחלונות פנויים
  const schedule = [...existingSchedule];
  const results = [];
  
  for (const interval of allIntervals) {
    const placement = findBestSlot(interval, schedule);
    
    if (placement) {
      schedule.push(placement);
      results.push({
        ...interval,
        scheduledDate: placement.date,
        scheduledTime: placement.time,
        success: true
      });
    } else {
      results.push({
        ...interval,
        success: false,
        reason: 'לא נמצא חלון פנוי לפני הדדליין'
      });
    }
  }
  
  return {
    schedule,
    results,
    summary: {
      total: allIntervals.length,
      scheduled: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    }
  };
}

/**
 * מציאת החלון הטוב ביותר לאינטרוול
 */
function findBestSlot(interval, currentSchedule) {
  const today = new Date().toISOString().split('T')[0];
  const deadline = interval.deadline;
  
  // חישוב שעת הסיום המקסימלית ביום הדדליין
  const deadlineMaxEndMinutes = CONFIG.DEADLINE_END_HOUR * 60;
  
  let checkDate = today;
  let attempts = 0;
  const maxAttempts = 30; // עד חודש קדימה
  
  while (attempts < maxAttempts) {
    // דלג על ימים שאינם ימי עבודה
    if (!isWorkDay(checkDate)) {
      checkDate = getNextWorkDay(checkDate);
      attempts++;
      continue;
    }
    
    // בדוק אם עברנו את הדדליין
    if (checkDate > deadline) {
      return null; // לא ניתן לשבץ לפני הדדליין
    }
    
    // מצא חלונות פנויים ביום הזה
    const freeSlots = findDaySlots(checkDate, currentSchedule);
    
    // קבע את שעת הסיום המקסימלית
    let maxEndMinutes = CONFIG.WORK_END_HOUR * 60;
    if (checkDate === deadline) {
      maxEndMinutes = deadlineMaxEndMinutes;
    }
    
    // חפש חלון מתאים
    for (const slot of freeSlots) {
      // בדוק אם יש מספיק זמן בחלון
      const neededDuration = interval.duration + CONFIG.BREAK_MINUTES;
      
      if (slot.duration >= neededDuration) {
        // בדוק שנסיים לפני הזמן המקסימלי
        const endTime = slot.start + interval.duration;
        
        if (endTime <= maxEndMinutes) {
          // בדוק התאמה לסוג המשימה
          const startHour = Math.floor(slot.start / 60);
          
          // תמלולים רק עד 12:00
          if (interval.taskType === 'transcription' && startHour >= 12) {
            continue;
          }
          
          // הגהות אחרי 10:00
          if (interval.taskType === 'proofreading' && startHour < 10) {
            // בדוק אם יש תמלולים שמחכים - אם כן, דחה את ההגהה
            const pendingTranscriptions = currentSchedule.filter(s => 
              s.date === checkDate && 
              s.taskType === 'transcription' &&
              timeToMinutes(s.time) >= slot.start
            );
            if (pendingTranscriptions.length > 0) {
              continue;
            }
          }
          
          return {
            date: checkDate,
            time: minutesToTime(slot.start),
            duration: interval.duration,
            taskId: interval.taskId,
            taskTitle: interval.taskTitle,
            taskType: interval.taskType,
            intervalIndex: interval.intervalIndex,
            totalIntervals: interval.totalIntervals
          };
        }
      }
    }
    
    // עבור ליום הבא
    checkDate = getNextWorkDay(checkDate);
    attempts++;
  }
  
  return null;
}

/**
 * שיבוץ מחדש אוטומטי - כשמשימה מתבטלת
 */
export function rescheduleAfterCancellation(cancelledTaskId, tasks, currentSchedule) {
  // 1. הסר את כל האינטרוולים של המשימה שבוטלה
  const updatedSchedule = currentSchedule.filter(s => s.taskId !== cancelledTaskId);
  
  // 2. מצא משימות שיכולות להיכנס לחלונות שהתפנו
  const remainingTasks = tasks.filter(t => 
    !t.is_completed && 
    t.id !== cancelledTaskId &&
    t.due_date
  );
  
  // 3. שבץ מחדש
  return smartSchedule(remainingTasks, []);
}

/**
 * עדכון שיבוץ יחיד
 */
export function updateSingleTask(task, currentSchedule) {
  // הסר שיבוצים קיימים של המשימה
  const filtered = currentSchedule.filter(s => s.taskId !== task.id);
  
  // שבץ מחדש
  const intervals = splitToIntervals(task);
  const results = [];
  const schedule = [...filtered];
  
  for (const interval of intervals) {
    const placement = findBestSlot(interval, schedule);
    if (placement) {
      schedule.push(placement);
      results.push({ ...interval, ...placement, success: true });
    } else {
      results.push({ ...interval, success: false });
    }
  }
  
  return { schedule, results };
}

/**
 * יצירת משימות מהשיבוץ
 */
export function createTasksFromSchedule(scheduleResults, originalTask) {
  return scheduleResults
    .filter(r => r.success)
    .map(result => ({
      title: result.totalIntervals > 1 
        ? `${result.taskTitle} (${result.intervalIndex}/${result.totalIntervals})`
        : result.taskTitle,
      description: originalTask.description || '',
      quadrant: originalTask.quadrant || 2,
      dueDate: result.scheduledDate,
      dueTime: result.scheduledTime,
      estimatedDuration: result.duration,
      taskType: result.taskType,
      parentTaskId: originalTask.id,
      intervalIndex: result.intervalIndex,
      isInterval: result.totalIntervals > 1
    }));
}

/**
 * קבלת סיכום השיבוץ
 */
export function getScheduleSummaryText(results) {
  const byDate = {};
  
  for (const result of results.filter(r => r.success)) {
    if (!byDate[result.scheduledDate]) {
      byDate[result.scheduledDate] = [];
    }
    byDate[result.scheduledDate].push(result);
  }
  
  const lines = [];
  const sortedDates = Object.keys(byDate).sort();
  
  for (const date of sortedDates) {
    const dateObj = new Date(date);
    const dayName = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][dateObj.getDay()];
    const dateStr = dateObj.toLocaleDateString('he-IL');
    
    lines.push(`📅 יום ${dayName} (${dateStr}):`);
    
    const daySlots = byDate[date].sort((a, b) => 
      timeToMinutes(a.scheduledTime) - timeToMinutes(b.scheduledTime)
    );
    
    for (const slot of daySlots) {
      const typeIcon = {
        transcription: '🎤',
        proofreading: '📝',
        typing: '⌨️',
        recording: '🎙️',
        other: '📌'
      }[slot.taskType] || '📌';
      
      lines.push(`  ${slot.scheduledTime} - ${typeIcon} ${slot.taskTitle} (${slot.duration} דק')`);
    }
    lines.push('');
  }
  
  return lines.join('\n');
}

// ========================================
// פונקציות הצעת שיבוץ חדשות
// ========================================

/**
 * חישוב דקות מתוזמנות ביום
 */
function getScheduledMinutesForDay(date, tasks) {
  const dateISO = typeof date === 'string' ? date : date.toISOString().split('T')[0];
  
  return tasks
    .filter(t => {
      const taskDate = t.due_date || t.dueDate;
      const isCompleted = t.is_completed || t.isCompleted;
      return taskDate === dateISO && !isCompleted;
    })
    .reduce((sum, t) => {
      const duration = t.estimated_duration || t.estimatedDuration || 30;
      return sum + duration;
    }, 0);
}

/**
 * קבלת חלונות תפוסים ביום (כולל הפסקת צהריים)
 */
function getOccupiedSlotsForDay(date, tasks) {
  const dateISO = typeof date === 'string' ? date : date.toISOString().split('T')[0];
  
  const slots = tasks
    .filter(t => {
      const taskDate = t.due_date || t.dueDate;
      const taskTime = t.due_time || t.dueTime;
      const isCompleted = t.is_completed || t.isCompleted;
      return taskDate === dateISO && taskTime && !isCompleted;
    })
    .map(t => {
      const time = t.due_time || t.dueTime;
      const duration = t.estimated_duration || t.estimatedDuration || 30;
      const start = timeToMinutes(time);
      return { start, end: start + duration };
    });
  
  // הפסקת צהריים
  slots.push({
    start: CONFIG.LUNCH_START_HOUR * 60,
    end: CONFIG.LUNCH_START_HOUR * 60 + CONFIG.LUNCH_DURATION,
    isLunch: true
  });
  
  return slots.sort((a, b) => a.start - b.start);
}

/**
 * מציאת החלון הפנוי הראשון ביום
 */
function findFirstFreeSlotInDay(date, duration, tasks) {
  const dateISO = typeof date === 'string' ? date : date.toISOString().split('T')[0];
  const workStart = CONFIG.WORK_START_HOUR * 60;
  const workEnd = CONFIG.WORK_END_HOUR * 60;
  
  // אם זה היום - לא מציעים שעות שעברו
  const today = new Date().toISOString().split('T')[0];
  let searchStart = workStart;
  
  if (dateISO === today) {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    // מעגלים ל-15 דקות הבאות + 5 דקות מרווח
    searchStart = Math.max(workStart, Math.ceil((currentMinutes + 5) / 15) * 15);
  }
  
  // אם כבר מאוחר מדי
  if (searchStart + duration > workEnd) {
    return null;
  }
  
  const occupiedSlots = getOccupiedSlotsForDay(date, tasks);
  let currentTime = searchStart;
  
  for (const slot of occupiedSlots) {
    // יש מקום לפני החלון התפוס?
    if (currentTime + duration <= slot.start) {
      return {
        time: minutesToTime(currentTime),
        startMinutes: currentTime,
        endMinutes: currentTime + duration
      };
    }
    // מזיזים אחרי החלון התפוס
    currentTime = Math.max(currentTime, slot.end);
  }
  
  // יש מקום בסוף היום?
  if (currentTime + duration <= workEnd) {
    return {
      time: minutesToTime(currentTime),
      startMinutes: currentTime,
      endMinutes: currentTime + duration
    };
  }
  
  return null;
}

/**
 * פורמט תאריך בעברית
 */
function formatHebrewDate(dateStr) {
  const date = new Date(dateStr);
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  return `יום ${days[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1}`;
}

/**
 * הצעת שיבוץ אופטימלי למשימה - הפונקציה הראשית לשימוש בטופס
 * מחזירה עד 3 הצעות מהמוקדמת לאיחור
 */
export function suggestSchedule(taskDuration, existingTasks, options = {}) {
  const suggestions = [];
  const today = new Date().toISOString().split('T')[0];
  let currentDate = new Date();
  
  // מחפשים עד 14 יום קדימה
  for (let i = 0; i < CONFIG.MAX_DAYS_AHEAD; i++) {
    const dateISO = currentDate.toISOString().split('T')[0];
    
    // דילוג על ימים שאינם ימי עבודה
    if (!isWorkDay(dateISO)) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }
    
    // בדיקת קיבולת יומית
    const scheduled = getScheduledMinutesForDay(dateISO, existingTasks);
    const remaining = CONFIG.DAILY_CAPACITY - scheduled;
    
    // אם יש מספיק קיבולת
    if (remaining >= taskDuration) {
      const slot = findFirstFreeSlotInDay(dateISO, taskDuration, existingTasks);
      
      if (slot) {
        const isToday = dateISO === today;
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const isTomorrow = dateISO === tomorrow.toISOString().split('T')[0];
        
        suggestions.push({
          date: dateISO,
          time: slot.time,
          displayText: isToday 
            ? `היום ב-${slot.time}` 
            : isTomorrow 
              ? `מחר ב-${slot.time}`
              : `${formatHebrewDate(dateISO)} ב-${slot.time}`,
          isToday,
          isTomorrow,
          remainingAfter: remaining - taskDuration,
          dayIndex: i
        });
        
        // מספיק 3 הצעות
        if (suggestions.length >= 3) break;
      }
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return suggestions;
}

/**
 * סטטוס עומס היום
 */
export function getDayLoadStatus(date, tasks) {
  const scheduled = getScheduledMinutesForDay(date, tasks);
  const remaining = CONFIG.DAILY_CAPACITY - scheduled;
  const percentage = Math.round((scheduled / CONFIG.DAILY_CAPACITY) * 100);
  
  let status, color, icon;
  
  if (percentage >= 100) {
    status = 'מלא';
    color = 'red';
    icon = '🔴';
  } else if (percentage >= 80) {
    status = 'עמוס';
    color = 'orange';
    icon = '🟠';
  } else if (percentage >= 50) {
    status = 'בינוני';
    color = 'yellow';
    icon = '🟡';
  } else {
    status = 'פנוי';
    color = 'green';
    icon = '🟢';
  }
  
  return {
    scheduled,
    remaining,
    percentage,
    status,
    color,
    icon,
    displayRemaining: `${Math.floor(remaining / 60)}:${(remaining % 60).toString().padStart(2, '0')}`
  };
}

/**
 * ייצוא ההגדרות
 */
export { CONFIG as SCHEDULER_CONFIG };

export default {
  CONFIG,
  splitToIntervals,
  calculatePriority,
  findDaySlots,
  smartSchedule,
  rescheduleAfterCancellation,
  updateSingleTask,
  createTasksFromSchedule,
  getScheduleSummaryText,
  isWorkDay,
  getNextWorkDay
};

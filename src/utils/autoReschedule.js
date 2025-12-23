/**
 * הזזה אוטומטית של משימות
 * 
 * כשמשימה לוקחת יותר זמן מהצפוי, המערכת מזיזה את המשימות הבאות
 */

/**
 * המרת שעה לדקות מתחילת היום
 */
export function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + (minutes || 0);
}

/**
 * המרת דקות לפורמט שעה
 */
export function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * מציאת המשימה הבאה באותו יום
 */
export function findNextTask(currentTask, allTasks) {
  if (!currentTask?.due_date || !currentTask?.due_time) return null;
  
  const currentDate = currentTask.due_date;
  const currentEndMinutes = timeToMinutes(currentTask.due_time) + (currentTask.estimated_duration || 30);
  
  // מציאת משימות באותו יום שמתחילות אחרי המשימה הנוכחית
  const sameDayTasks = allTasks.filter(t => 
    t.id !== currentTask.id &&
    t.due_date === currentDate &&
    t.due_time &&
    !t.is_completed
  );
  
  // מיון לפי שעה
  sameDayTasks.sort((a, b) => timeToMinutes(a.due_time) - timeToMinutes(b.due_time));
  
  // מציאת המשימה הבאה (שמתחילה אחרי או באותו זמן שהנוכחית אמורה להסתיים)
  return sameDayTasks.find(t => {
    const taskStart = timeToMinutes(t.due_time);
    // המשימה מתחילה בסוף המשימה הנוכחית או אחריה
    return taskStart >= timeToMinutes(currentTask.due_time);
  });
}

/**
 * חישוב כמה זמן המשימה חורגת מהתכנון
 */
export function calculateOverrun(currentTask, actualMinutesSpent) {
  const estimatedDuration = currentTask?.estimated_duration || 30;
  const overrun = actualMinutesSpent - estimatedDuration;
  return overrun > 0 ? overrun : 0;
}

/**
 * בדיקה אם המשימה הנוכחית חופפת עם המשימה הבאה
 */
export function checkOverlapWithNext(currentTask, actualMinutesSpent, nextTask) {
  if (!currentTask?.due_time || !nextTask?.due_time) return false;
  
  const currentStartMinutes = timeToMinutes(currentTask.due_time);
  const actualEndMinutes = currentStartMinutes + actualMinutesSpent;
  const nextStartMinutes = timeToMinutes(nextTask.due_time);
  
  return actualEndMinutes > nextStartMinutes;
}

/**
 * חישוב הזמן החדש למשימה הבאה
 */
export function calculateNewTimeForNext(currentTask, actualMinutesSpent, nextTask) {
  if (!currentTask?.due_time) return null;
  
  const currentStartMinutes = timeToMinutes(currentTask.due_time);
  const actualEndMinutes = currentStartMinutes + actualMinutesSpent;
  
  // הוספת 5 דקות הפסקה
  const newStartMinutes = actualEndMinutes + 5;
  
  // בדיקה שלא עוברים את סוף יום העבודה (16:00)
  if (newStartMinutes >= 16 * 60) {
    return null; // צריך להעביר ליום אחר
  }
  
  return minutesToTime(newStartMinutes);
}

/**
 * הזזת שרשרת משימות
 * כשמשימה אחת זזה, כל המשימות אחריה צריכות לזוז
 */
export function calculateCascadeReschedule(tasks, movedTaskId, newTime, date) {
  const dateTasks = tasks.filter(t => 
    t.due_date === date && 
    t.due_time && 
    !t.is_completed
  ).sort((a, b) => timeToMinutes(a.due_time) - timeToMinutes(b.due_time));
  
  const movedTaskIndex = dateTasks.findIndex(t => t.id === movedTaskId);
  if (movedTaskIndex === -1) return [];
  
  const updates = [];
  let previousEndMinutes = timeToMinutes(newTime) + (dateTasks[movedTaskIndex].estimated_duration || 30);
  
  // עדכון המשימה שהוזזה
  updates.push({
    id: movedTaskId,
    newTime: newTime
  });
  
  // עדכון כל המשימות אחריה
  for (let i = movedTaskIndex + 1; i < dateTasks.length; i++) {
    const task = dateTasks[i];
    const taskStartMinutes = timeToMinutes(task.due_time);
    
    // אם המשימה מתחילה לפני שהקודמת נגמרת
    if (taskStartMinutes < previousEndMinutes) {
      const newStartMinutes = previousEndMinutes + 5; // 5 דקות הפסקה
      
      // בדיקה שלא עוברים את סוף היום
      if (newStartMinutes < 16 * 60) {
        updates.push({
          id: task.id,
          newTime: minutesToTime(newStartMinutes)
        });
        previousEndMinutes = newStartMinutes + (task.estimated_duration || 30);
      }
    } else {
      // אין צורך להזיז את שאר המשימות
      break;
    }
  }
  
  return updates;
}

/**
 * בדיקה אם צריך להתריע על חריגה
 */
export function shouldWarnAboutOverrun(currentTask, actualMinutesSpent) {
  const estimatedDuration = currentTask?.estimated_duration || 30;
  
  // התראה כשעוברים 80% מהזמן המתוכנן
  const warningThreshold = estimatedDuration * 0.8;
  
  // התראה כשעוברים את הזמן המתוכנן
  const overrunThreshold = estimatedDuration;
  
  return {
    shouldWarn: actualMinutesSpent >= warningThreshold && actualMinutesSpent < overrunThreshold,
    isOverrun: actualMinutesSpent >= overrunThreshold,
    overrunMinutes: Math.max(0, actualMinutesSpent - overrunThreshold),
    percentComplete: Math.round((actualMinutesSpent / estimatedDuration) * 100)
  };
}

export default {
  timeToMinutes,
  minutesToTime,
  findNextTask,
  calculateOverrun,
  checkOverlapWithNext,
  calculateNewTimeForNext,
  calculateCascadeReschedule,
  shouldWarnAboutOverrun
};

/**
 * מערכת שיבוץ חכמה
 * 
 * יכולות:
 * 1. שיבוץ לפי עדיפות (דחוף/גבוה/רגיל)
 * 2. הזזה אוטומטית של משימות פחות חשובות
 * 3. למידה מזמנים אמיתיים
 * 4. פירוק עבודות גדולות לבלוקים ושיבוץ אוטומטי
 */

// === קבועים ===

export const WORK_HOURS = {
  start: 8,  // 08:00
  end: 16,   // 16:00
  totalMinutes: 8 * 60 // 480 דקות
};

export const WORK_DAYS = [0, 1, 2, 3, 4]; // ראשון עד חמישי

export const TIME_SLOT = 15; // יחידת זמן מינימלית בדקות

export const MIN_BLOCK_SIZE = 30; // בלוק מינימלי
export const MAX_BLOCK_SIZE = 90; // בלוק מקסימלי

// סדר עדיפויות (נמוך יותר = חשוב יותר)
export const PRIORITY_ORDER = {
  urgent: 1,
  high: 2,
  normal: 3,
  low: 4
};

// === פונקציות עזר ===

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
 * עיגול דקות ל-TIME_SLOT הקרוב (כלפי מעלה)
 */
export function roundUpToSlot(minutes) {
  return Math.ceil(minutes / TIME_SLOT) * TIME_SLOT;
}

/**
 * קבלת תאריך בפורמט ISO
 */
export function getDateISO(date) {
  return date.toISOString().split('T')[0];
}

/**
 * בדיקה אם היום הוא יום עבודה
 */
export function isWorkDay(date) {
  return WORK_DAYS.includes(date.getDay());
}

/**
 * קבלת שם יום בעברית
 */
export function getDayName(date) {
  const names = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  return names[date.getDay()];
}

/**
 * פורמט דקות לתצוגה
 */
export function formatMinutes(minutes) {
  if (minutes < 60) return `${minutes} דק'`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return hours === 1 ? 'שעה' : `${hours} שעות`;
  return `${hours}:${mins.toString().padStart(2, '0')}`;
}

// === לוגיקת למידה ===

/**
 * חישוב זמן מותאם לפי היסטוריה
 * @param {number} estimatedMinutes - הערכה מקורית בדקות
 * @param {object} learningData - נתוני למידה מה-DB
 * @returns {number} - זמן מותאם בדקות
 */
export function getAdjustedDuration(estimatedMinutes, learningData) {
  if (!learningData || !learningData.average_ratio || learningData.total_tasks < 2) {
    return estimatedMinutes;
  }
  
  // הכפל ביחס הממוצע (אם תמלול תמיד לוקח 120%, יחזיר 120% מההערכה)
  const adjusted = Math.round(estimatedMinutes * learningData.average_ratio);
  
  // הוסף מרווח בטחון של 10% אם יש שונות גבוהה
  if (learningData.variance && learningData.variance > 0.2) {
    return Math.round(adjusted * 1.1);
  }
  
  return adjusted;
}

/**
 * חישוב יחס זמן אמיתי/מתוכנן ממשימות קודמות
 */
export function calculateLearningRatio(completedTasks, taskType = null) {
  const relevantTasks = completedTasks.filter(t => {
    if (!t.is_completed || !t.time_spent || !t.estimated_duration) return false;
    if (taskType && t.task_type !== taskType) return false;
    return t.time_spent > 0 && t.estimated_duration > 0;
  });
  
  if (relevantTasks.length < 2) return null;
  
  const ratios = relevantTasks.map(t => t.time_spent / t.estimated_duration);
  const avgRatio = ratios.reduce((sum, r) => sum + r, 0) / ratios.length;
  
  // חישוב שונות
  const variance = ratios.reduce((sum, r) => sum + Math.pow(r - avgRatio, 2), 0) / ratios.length;
  
  return {
    average_ratio: avgRatio,
    variance: variance,
    total_tasks: relevantTasks.length
  };
}

// === ניתוח קיבולת ===

/**
 * חישוב קיבולת לימים
 * @param {Array} tasks - כל המשימות
 * @param {Date} startDate - תאריך התחלה
 * @param {Date} endDate - תאריך סיום (אופציונלי)
 * @param {number} daysAhead - מספר ימים קדימה (ברירת מחדל 14)
 * @returns {Array} - מערך ימים עם מידע על קיבולת
 */
export function analyzeCapacity(tasks, startDate, endDate = null, daysAhead = 14) {
  const days = [];
  const maxDays = endDate 
    ? Math.min(Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1, 60)
    : daysAhead;
  
  for (let i = 0; i < maxDays; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    
    // דלג על ימים שאינם ימי עבודה
    if (!isWorkDay(date)) continue;
    
    // בדוק שלא עברנו את תאריך הסיום
    if (endDate && date > endDate) break;
    
    const dateISO = getDateISO(date);
    const dayTasks = tasks.filter(t => 
      t.due_date === dateISO && 
      !t.is_completed
    );
    
    // חישוב זמנים תפוסים
    const occupiedSlots = dayTasks
      .filter(t => t.due_time)
      .map(task => {
        const start = timeToMinutes(task.due_time);
        const duration = task.estimated_duration || 30;
        return {
          start,
          end: start + duration,
          task,
          priority: task.priority || 'normal'
        };
      })
      .sort((a, b) => a.start - b.start);
    
    const occupiedMinutes = occupiedSlots.reduce((sum, slot) => sum + (slot.end - slot.start), 0);
    
    // מציאת חלונות פנויים
    const freeSlots = findFreeSlots(occupiedSlots);
    const freeMinutes = freeSlots.reduce((sum, slot) => sum + slot.duration, 0);
    
    days.push({
      date,
      dateISO,
      dayName: getDayName(date),
      occupiedMinutes,
      freeMinutes,
      totalMinutes: WORK_HOURS.totalMinutes,
      occupiedSlots,
      freeSlots,
      tasks: dayTasks,
      isToday: i === 0
    });
  }
  
  return days;
}

/**
 * מציאת חלונות זמן פנויים ביום
 */
export function findFreeSlots(occupiedSlots) {
  const slots = [];
  const dayStart = WORK_HOURS.start * 60;
  const dayEnd = WORK_HOURS.end * 60;
  
  let currentTime = dayStart;
  
  for (const occupied of occupiedSlots) {
    if (currentTime < occupied.start) {
      const duration = occupied.start - currentTime;
      if (duration >= MIN_BLOCK_SIZE) {
        slots.push({
          start: currentTime,
          end: occupied.start,
          duration
        });
      }
    }
    currentTime = Math.max(currentTime, occupied.end);
  }
  
  // חלון אחרון עד סוף היום
  if (currentTime < dayEnd) {
    const duration = dayEnd - currentTime;
    if (duration >= MIN_BLOCK_SIZE) {
      slots.push({
        start: currentTime,
        end: dayEnd,
        duration
      });
    }
  }
  
  return slots;
}

// === שיבוץ חכם ===

/**
 * שיבוץ משימות לפי עדיפות
 * @param {Array} unscheduledTasks - משימות לא משובצות
 * @param {Array} capacityDays - ימים עם קיבולת (מ-analyzeCapacity)
 * @param {object} learningDataByType - נתוני למידה לפי סוג משימה
 * @returns {object} - { scheduled: [], unscheduled: [], conflicts: [] }
 */
export function scheduleByPriority(unscheduledTasks, capacityDays, learningDataByType = {}) {
  const scheduled = [];
  const unscheduled = [];
  const conflicts = [];
  
  // מיון לפי עדיפות (דחוף קודם, אח"כ גבוה, אח"כ רגיל)
  const sortedTasks = [...unscheduledTasks].sort((a, b) => {
    const priorityA = PRIORITY_ORDER[a.priority] || PRIORITY_ORDER.normal;
    const priorityB = PRIORITY_ORDER[b.priority] || PRIORITY_ORDER.normal;
    
    if (priorityA !== priorityB) return priorityA - priorityB;
    
    // אם אותה עדיפות - לפי תאריך יעד
    if (a.deadline && b.deadline) {
      return new Date(a.deadline) - new Date(b.deadline);
    }
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    
    return 0;
  });
  
  // עותק עמוק של החלונות הפנויים
  const availableDays = capacityDays.map(d => ({
    ...d,
    freeSlots: d.freeSlots.map(s => ({ ...s }))
  }));
  
  for (const task of sortedTasks) {
    // התאם את משך המשימה לפי למידה
    const learningData = learningDataByType[task.task_type];
    const baseDuration = task.estimated_duration || 30;
    const adjustedDuration = roundUpToSlot(getAdjustedDuration(baseDuration, learningData));
    
    // מצא חלון מתאים
    const placement = findBestSlot(task, adjustedDuration, availableDays);
    
    if (placement) {
      scheduled.push({
        task,
        date: placement.date,
        dateISO: placement.dateISO,
        dayName: placement.dayName,
        startTime: minutesToTime(placement.start),
        endTime: minutesToTime(placement.end),
        duration: adjustedDuration,
        originalDuration: baseDuration,
        wasAdjusted: adjustedDuration !== baseDuration
      });
      
      // עדכן את החלון הפנוי
      updateSlotAfterScheduling(availableDays, placement);
    } else {
      unscheduled.push({
        task,
        reason: 'אין חלון פנוי מתאים',
        duration: adjustedDuration
      });
    }
  }
  
  return { scheduled, unscheduled, conflicts };
}

/**
 * מציאת החלון הטוב ביותר למשימה
 */
function findBestSlot(task, duration, availableDays) {
  // אם יש תאריך יעד - נעדיף ימים קרובים אליו
  const deadline = task.deadline ? new Date(task.deadline) : null;
  
  for (const day of availableDays) {
    // אם יש דדליין, לא לשבץ אחריו
    if (deadline && day.date > deadline) continue;
    
    for (const slot of day.freeSlots) {
      if (slot.duration >= duration) {
        return {
          date: day.date,
          dateISO: day.dateISO,
          dayName: day.dayName,
          start: slot.start,
          end: slot.start + duration,
          slotIndex: day.freeSlots.indexOf(slot),
          dayIndex: availableDays.indexOf(day)
        };
      }
    }
  }
  
  return null;
}

/**
 * עדכון חלון אחרי שיבוץ
 */
function updateSlotAfterScheduling(availableDays, placement) {
  const day = availableDays[placement.dayIndex];
  const slot = day.freeSlots[placement.slotIndex];
  
  const usedDuration = placement.end - placement.start;
  
  if (slot.duration === usedDuration) {
    // החלון נוצל במלואו
    day.freeSlots.splice(placement.slotIndex, 1);
  } else {
    // עדכן את תחילת החלון
    slot.start = placement.end;
    slot.duration = slot.end - slot.start;
    
    // אם החלון קטן מדי עכשיו - הסר אותו
    if (slot.duration < MIN_BLOCK_SIZE) {
      day.freeSlots.splice(placement.slotIndex, 1);
    }
  }
  
  // עדכן סטטיסטיקות היום
  day.freeMinutes -= usedDuration;
  day.occupiedMinutes += usedDuration;
}

// === הזזה אוטומטית ===

/**
 * מציאת משימות שאפשר להזיז כדי לפנות מקום
 * @param {Array} dayTasks - משימות ביום
 * @param {number} minutesNeeded - כמה דקות צריך לפנות
 * @param {string} newTaskPriority - עדיפות המשימה החדשה
 * @returns {Array} - משימות שאפשר להזיז
 */
export function findMovableTasks(dayTasks, minutesNeeded, newTaskPriority = 'urgent') {
  const newPriorityOrder = PRIORITY_ORDER[newTaskPriority] || PRIORITY_ORDER.normal;
  
  // מצא משימות עם עדיפות נמוכה יותר
  const movable = dayTasks
    .filter(task => {
      const taskPriority = PRIORITY_ORDER[task.priority] || PRIORITY_ORDER.normal;
      // רק משימות עם עדיפות נמוכה יותר
      return taskPriority > newPriorityOrder;
    })
    .map(task => ({
      ...task,
      priorityOrder: PRIORITY_ORDER[task.priority] || PRIORITY_ORDER.normal
    }))
    // מיון - עדיפות נמוכה יותר קודם (להזזה)
    .sort((a, b) => b.priorityOrder - a.priorityOrder);
  
  // בחר משימות עד שמגיעים לזמן הנדרש
  const toMove = [];
  let freedMinutes = 0;
  
  for (const task of movable) {
    if (freedMinutes >= minutesNeeded) break;
    toMove.push(task);
    freedMinutes += task.estimated_duration || 30;
  }
  
  return {
    tasks: toMove,
    freedMinutes,
    isEnough: freedMinutes >= minutesNeeded
  };
}

/**
 * הזזת משימות ליום אחר
 * @param {Array} tasksToMove - משימות להזזה
 * @param {Array} capacityDays - ימים עם קיבולת
 * @param {Date} afterDate - להזיז לאחרי תאריך זה
 * @returns {Array} - הצעות הזזה { task, newDate, newTime }
 */
export function proposeTaskMoves(tasksToMove, capacityDays, afterDate) {
  const moves = [];
  
  // סנן ימים שאחרי התאריך הנדרש
  const futureDays = capacityDays.filter(d => d.date > afterDate);
  
  // עותק עמוק
  const availableDays = futureDays.map(d => ({
    ...d,
    freeSlots: d.freeSlots.map(s => ({ ...s }))
  }));
  
  for (const task of tasksToMove) {
    const duration = task.estimated_duration || 30;
    
    // מצא חלון ביום אחר
    for (const day of availableDays) {
      for (let i = 0; i < day.freeSlots.length; i++) {
        const slot = day.freeSlots[i];
        if (slot.duration >= duration) {
          moves.push({
            task,
            originalDate: task.due_date,
            originalTime: task.due_time,
            newDate: day.dateISO,
            newTime: minutesToTime(slot.start),
            newDayName: day.dayName
          });
          
          // עדכן את החלון
          slot.start += duration;
          slot.duration -= duration;
          if (slot.duration < MIN_BLOCK_SIZE) {
            day.freeSlots.splice(i, 1);
          }
          
          break;
        }
      }
      
      // אם מצאנו מקום, עבור למשימה הבאה
      if (moves.find(m => m.task.id === task.id)) break;
    }
  }
  
  return moves;
}

// === פירוק עבודות לבלוקים ===

/**
 * פירוק עבודה גדולה לבלוקים ושיבוץ אוטומטי
 * @param {object} workParams - פרמטרים של העבודה
 * @param {Array} capacityDays - ימים עם קיבולת
 * @param {object} learningData - נתוני למידה לסוג המשימה
 * @returns {object} - { blocks: [], analysis: {} }
 */
export function splitAndScheduleWork({
  title,
  totalMinutes,
  taskType,
  priority = 'normal',
  startDate,
  deadline,
  preferredBlockSize = 45,
  description = ''
}, capacityDays, learningData = null) {
  
  // התאם את הזמן הכולל לפי למידה
  const adjustedTotalMinutes = getAdjustedDuration(totalMinutes, learningData);
  
  // קבע גודל בלוק (בין MIN ל-MAX)
  const blockSize = Math.min(Math.max(preferredBlockSize, MIN_BLOCK_SIZE), MAX_BLOCK_SIZE);
  
  // חשב כמה בלוקים צריך
  const numBlocks = Math.ceil(adjustedTotalMinutes / blockSize);
  
  // סנן ימים רלוונטיים
  const startDateObj = startDate ? new Date(startDate) : new Date();
  const deadlineObj = deadline ? new Date(deadline) : null;
  
  const relevantDays = capacityDays.filter(d => {
    if (d.date < startDateObj) return false;
    if (deadlineObj && d.date > deadlineObj) return false;
    return true;
  });
  
  // חשב זמן פנוי כולל
  const totalFreeTime = relevantDays.reduce((sum, d) => sum + d.freeMinutes, 0);
  const hasEnoughTime = totalFreeTime >= adjustedTotalMinutes;
  
  // שבץ בלוקים
  const blocks = [];
  let remainingMinutes = adjustedTotalMinutes;
  let blockIndex = 1;
  
  // עותק עמוק של החלונות
  const availableDays = relevantDays.map(d => ({
    ...d,
    freeSlots: d.freeSlots.map(s => ({ ...s }))
  }));
  
  for (const day of availableDays) {
    if (remainingMinutes <= 0) break;
    
    for (let i = 0; i < day.freeSlots.length; i++) {
      if (remainingMinutes <= 0) break;
      
      const slot = day.freeSlots[i];
      if (slot.duration < MIN_BLOCK_SIZE) continue;
      
      // כמה אפשר לקחת מהחלון
      let slotRemaining = Math.min(slot.duration, remainingMinutes);
      let slotStart = slot.start;
      
      // פרק לבלוקים
      while (slotRemaining >= MIN_BLOCK_SIZE && remainingMinutes > 0) {
        const thisBlockSize = Math.min(blockSize, slotRemaining, remainingMinutes);
        
        if (thisBlockSize >= MIN_BLOCK_SIZE) {
          blocks.push({
            blockIndex,
            totalBlocks: numBlocks,
            title: `${title} (${blockIndex}/${numBlocks})`,
            taskType,
            priority,
            description,
            date: day.date,
            dateISO: day.dateISO,
            dayName: day.dayName,
            startTime: minutesToTime(slotStart),
            endTime: minutesToTime(slotStart + thisBlockSize),
            duration: thisBlockSize,
            parentJob: title
          });
          
          blockIndex++;
          remainingMinutes -= thisBlockSize;
          slotRemaining -= thisBlockSize;
          slotStart += thisBlockSize;
        } else {
          break;
        }
      }
    }
  }
  
  // ניתוח תוצאות
  const analysis = {
    originalMinutes: totalMinutes,
    adjustedMinutes: adjustedTotalMinutes,
    wasAdjusted: adjustedTotalMinutes !== totalMinutes,
    adjustmentRatio: learningData?.average_ratio || 1,
    totalFreeTime,
    hasEnoughTime,
    remainingMinutes: Math.max(0, remainingMinutes),
    scheduledBlocks: blocks.length,
    expectedBlocks: numBlocks,
    blockSize,
    startDate: startDateObj,
    deadline: deadlineObj,
    relevantDays: relevantDays.length
  };
  
  return { blocks, analysis };
}

// === שיבוץ אוטומטי מלא ===

/**
 * שיבוץ אוטומטי מלא עם הזזת משימות במידת הצורך
 * @param {object} newTask - המשימה החדשה
 * @param {Array} existingTasks - משימות קיימות
 * @param {object} learningDataByType - נתוני למידה
 * @returns {object} - { scheduled, moved, analysis }
 */
export function autoScheduleWithReschedule(newTask, existingTasks, learningDataByType = {}) {
  const startDate = newTask.startDate ? new Date(newTask.startDate) : new Date();
  const deadline = newTask.deadline ? new Date(newTask.deadline) : null;
  
  // ניתוח קיבולת נוכחית
  const capacityDays = analyzeCapacity(existingTasks, startDate, deadline, 30);
  
  // נסה לשבץ
  const learningData = learningDataByType[newTask.taskType];
  const { blocks, analysis } = splitAndScheduleWork(newTask, capacityDays, learningData);
  
  const result = {
    scheduled: blocks,
    moved: [],
    analysis
  };
  
  // אם לא הצלחנו לשבץ הכל ויש עדיפות גבוהה - נסה להזיז משימות
  if (!analysis.hasEnoughTime && ['urgent', 'high'].includes(newTask.priority)) {
    const minutesNeeded = analysis.remainingMinutes;
    
    // חפש משימות להזזה
    const allDayTasks = capacityDays.flatMap(d => d.tasks);
    const { tasks: movableTasks, isEnough } = findMovableTasks(
      allDayTasks, 
      minutesNeeded, 
      newTask.priority
    );
    
    if (movableTasks.length > 0) {
      // הצע הזזות
      const futureDays = analyzeCapacity(
        existingTasks.filter(t => !movableTasks.find(m => m.id === t.id)),
        deadline || new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000),
        null,
        30
      );
      
      result.moved = proposeTaskMoves(movableTasks, futureDays, deadline || startDate);
      result.analysis.canFitWithMoves = isEnough;
      result.analysis.tasksToMove = movableTasks.length;
    }
  }
  
  return result;
}

export default {
  // קבועים
  WORK_HOURS,
  WORK_DAYS,
  PRIORITY_ORDER,
  MIN_BLOCK_SIZE,
  MAX_BLOCK_SIZE,
  
  // עזר
  timeToMinutes,
  minutesToTime,
  roundUpToSlot,
  getDateISO,
  isWorkDay,
  getDayName,
  formatMinutes,
  
  // למידה
  getAdjustedDuration,
  calculateLearningRatio,
  
  // קיבולת
  analyzeCapacity,
  findFreeSlots,
  
  // שיבוץ
  scheduleByPriority,
  findMovableTasks,
  proposeTaskMoves,
  splitAndScheduleWork,
  autoScheduleWithReschedule
};

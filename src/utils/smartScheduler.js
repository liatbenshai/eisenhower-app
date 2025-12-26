/**
 * מנוע שיבוץ חכם - גרסה 3 (Ultimate)
 * =====================================
 * 
 * פילוסופיה מרכזית:
 * "לסיים כל משימה כמה שיותר מהר - לא לדחות לדדליין"
 * 
 * עקרונות:
 * 1. מילוי ימים למקסימום (100%) לפני מעבר ליום הבא
 * 2. משימה חדשה = משבצים מיד, לא מחכים לדדליין
 * 3. דדליין = בדיקת היתכנות, לא מטרת תכנון
 * 4. תמיד יש גמישות להפרעות - כי משימות מסתיימות מוקדם
 * 
 * סדר עדיפויות:
 * 1. משימות עם דדליין היום (חייבים לסיים!)
 * 2. משימות עם דדליין קרוב (לפי קרבה)
 * 3. משימות בלי דדליין (לסיים כמה שיותר מהר)
 * 
 * חוקי שיבוץ:
 * - בלוקים של 45 דקות + 5 דקות הפסקה
 * - תמלול: 08:15-12:00 (שעות עירנות)
 * - הגהה/תרגום/אחר: 12:00-16:00
 * - אדמיניסטרציה: 08:00-08:15 קבוע
 */

import { WORK_HOURS } from '../config/workSchedule';

// ============================================
// הגדרות
// ============================================

export const SMART_SCHEDULE_CONFIG = {
  // שעות עבודה
  dayStart: 8 * 60,           // 08:00
  dayEnd: 16 * 60,            // 16:00
  
  // אדמיניסטרציה קבועה
  adminStart: 8 * 60,         // 08:00
  adminEnd: 8 * 60 + 15,      // 08:15
  adminDuration: 15,
  
  // חלון בוקר (תמלול)
  morningStart: 8 * 60 + 15,  // 08:15
  morningEnd: 12 * 60,        // 12:00
  
  // חלון אחה"צ (הגהה, תרגום, אחר)
  afternoonStart: 12 * 60,    // 12:00
  afternoonEnd: 16 * 60,      // 16:00
  
  // בלוקים
  blockDuration: 45,          // 45 דקות
  breakDuration: 5,           // 5 דקות הפסקה
  
  // סוגי משימות לבוקר
  morningTaskTypes: ['transcription', 'תמלול'],
  
  // זמן עבודה נטו ביום (בדקות)
  get workMinutesPerDay() {
    return this.dayEnd - this.adminEnd; // 465 דקות = 7:45 שעות
  },
  
  // כמה בלוקים מקסימום ביום
  get maxBlocksPerDay() {
    return Math.floor(this.workMinutesPerDay / (this.blockDuration + this.breakDuration)); // 9 בלוקים
  }
};

// ============================================
// פונקציה ראשית - שיבוץ שבועי
// ============================================

/**
 * שיבוץ חכם לשבוע
 * @param {Date} weekStart - תחילת השבוע (יום ראשון)
 * @param {Array} allTasks - כל המשימות
 * @returns {Object} תוכנית שבועית
 */
export function smartScheduleWeek(weekStart, allTasks) {
  const config = SMART_SCHEDULE_CONFIG;
  
  console.log('🚀 Smart Scheduler v3 - Starting week planning');
  console.log(`📅 Week starts: ${weekStart.toISOString().split('T')[0]}`);
  console.log(`📋 Total tasks: ${allTasks.length}`);
  
  // שלב 1: יצירת מבנה ימים
  const days = initializeDays(weekStart, config);
  
  // שלב 2: סינון ומיון משימות
  const pendingTasks = allTasks.filter(t => !t.is_completed);
  const sortedTasks = prioritizeTasks(pendingTasks, days[0].date);
  
  console.log(`✅ Pending tasks: ${pendingTasks.length}`);
  console.log(`📊 Sorted tasks:`, sortedTasks.map(t => `${t.title} (${t.estimated_duration}min, due: ${t.due_date || 'ASAP'})`));
  
  // שלב 3: שיבוץ משימות - למלא ימים למקסימום!
  const schedulingResult = scheduleAllTasks(sortedTasks, days, config);
  
  // שלב 4: חישוב סטטיסטיקות
  const stats = calculateStats(days, schedulingResult, config);
  
  console.log('📈 Week stats:', stats);
  
  return {
    weekStart: weekStart.toISOString().split('T')[0],
    days: days.map(formatDayForOutput),
    summary: stats,
    warnings: schedulingResult.warnings,
    unscheduledTasks: schedulingResult.unscheduledTasks
  };
}

// ============================================
// שלב 1: אתחול ימים
// ============================================

function initializeDays(weekStart, config) {
  const days = [];
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    date.setHours(12, 0, 0, 0);
    
    const dateISO = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();
    const dayConfig = WORK_HOURS[dayOfWeek];
    const isWorkDay = dayConfig?.enabled || false;
    
    const day = {
      date: dateISO,
      dayName: dayConfig?.name || '',
      dayOfWeek,
      isWorkDay,
      blocks: [],
      morningMinutesUsed: 0,
      afternoonMinutesUsed: 0,
      totalScheduledMinutes: 0,
      workHours: isWorkDay ? { start: 8, end: 16 } : null
    };
    
    // הוספת בלוק אדמיניסטרציה קבוע
    if (isWorkDay) {
      day.blocks.push({
        id: 'admin-block',
        type: 'admin',
        title: '📧 אדמיניסטרציה',
        description: 'מיילים, דוח בנק',
        startMinute: config.adminStart,
        endMinute: config.adminEnd,
        startTime: minutesToTime(config.adminStart),
        endTime: minutesToTime(config.adminEnd),
        duration: config.adminDuration,
        isFixed: true,
        isAdmin: true
      });
      day.totalScheduledMinutes = config.adminDuration;
    }
    
    days.push(day);
  }
  
  return days;
}

// ============================================
// שלב 2: מיון משימות לפי עדיפות
// ============================================

/**
 * מיון משימות - הכי דחוף קודם, אבל תמיד לסיים מהר!
 */
function prioritizeTasks(tasks, todayISO) {
  const today = new Date(todayISO);
  
  return [...tasks].sort((a, b) => {
    const aDue = a.due_date ? new Date(a.due_date) : null;
    const bDue = b.due_date ? new Date(b.due_date) : null;
    
    // 1. משימות עם דדליין היום - הכי דחוף!
    const aIsToday = aDue && isSameDay(aDue, today);
    const bIsToday = bDue && isSameDay(bDue, today);
    if (aIsToday && !bIsToday) return -1;
    if (bIsToday && !aIsToday) return 1;
    
    // 2. משימות עם דדליין קרוב (עד שבוע)
    const aIsUrgent = aDue && daysBetween(today, aDue) <= 7;
    const bIsUrgent = bDue && daysBetween(today, bDue) <= 7;
    
    if (aIsUrgent && bIsUrgent) {
      // שניהם דחופים - לפי קרבת דדליין
      return aDue - bDue;
    }
    if (aIsUrgent && !bIsUrgent) return -1;
    if (bIsUrgent && !aIsUrgent) return 1;
    
    // 3. לפי עדיפות מוגדרת
    const priorityOrder = { urgent: 0, high: 1, normal: 2 };
    const aPriority = priorityOrder[a.priority] ?? 2;
    const bPriority = priorityOrder[b.priority] ?? 2;
    if (aPriority !== bPriority) return aPriority - bPriority;
    
    // 4. משימות ארוכות יותר קודם (כדי למלא ימים)
    const aDuration = a.estimated_duration || 30;
    const bDuration = b.estimated_duration || 30;
    return bDuration - aDuration;
  });
}

// ============================================
// שלב 3: שיבוץ משימות
// ============================================

/**
 * שיבוץ כל המשימות - למלא ימים למקסימום!
 */
function scheduleAllTasks(tasks, days, config) {
  const taskProgress = new Map();
  const warnings = [];
  const unscheduledTasks = [];
  
  for (const task of tasks) {
    const duration = task.estimated_duration || 30;
    taskProgress.set(task.id, { 
      total: duration,
      scheduled: 0, 
      remaining: duration,
      blocks: []
    });
    
    // בדיקה: האם יש מספיק זמן עד הדדליין?
    if (task.due_date) {
      const feasibility = checkFeasibility(task, days, config);
      if (!feasibility.canComplete) {
        warnings.push({
          type: 'deadline_risk',
          taskId: task.id,
          taskTitle: task.title,
          message: `⚠️ "${task.title}" - לא בטוח שניתן לעמוד בדדליין ${task.due_date}`,
          details: feasibility
        });
      }
    }
    
    // שיבוץ המשימה - מתחילים מהיום הראשון!
    scheduleTask(task, days, taskProgress, config);
    
    // בדיקה אם נשאר זמן לא משובץ
    const progress = taskProgress.get(task.id);
    if (progress.remaining > 0) {
      unscheduledTasks.push({
        ...task,
        scheduledMinutes: progress.scheduled,
        remainingMinutes: progress.remaining,
        reason: 'לא מספיק זמן בשבוע'
      });
    }
  }
  
  return { taskProgress, warnings, unscheduledTasks };
}

/**
 * שיבוץ משימה בודדת - למלא ימים ברצף!
 */
function scheduleTask(task, days, taskProgress, config) {
  const progress = taskProgress.get(task.id);
  if (!progress || progress.remaining <= 0) return;
  
  const isMorningTask = isMorningTaskType(task, config);
  const totalBlocks = Math.ceil(progress.total / config.blockDuration);
  
  // עובר על כל הימים - ממלא כל יום למקסימום לפני מעבר להבא
  for (const day of days) {
    if (!day.isWorkDay) continue;
    if (progress.remaining <= 0) break;
    
    // שיבוץ בחלון המועדף
    const preferredWindow = isMorningTask 
      ? { start: config.morningStart, end: config.morningEnd }
      : { start: config.afternoonStart, end: config.afternoonEnd };
    
    scheduleInWindow(task, day, preferredWindow, progress, totalBlocks, config);
    
    // אם נשאר - שיבוץ בחלון האחר
    if (progress.remaining > 0) {
      const altWindow = isMorningTask
        ? { start: config.afternoonStart, end: config.afternoonEnd }
        : { start: config.morningStart, end: config.morningEnd };
      
      scheduleInWindow(task, day, altWindow, progress, totalBlocks, config);
    }
  }
}

/**
 * שיבוץ בלוקים בחלון זמן מסוים
 */
function scheduleInWindow(task, day, window, progress, totalBlocks, config) {
  // מציאת סלוטים פנויים בחלון
  const freeSlots = findFreeSlots(day.blocks, window.start, window.end, config);
  
  for (const slot of freeSlots) {
    if (progress.remaining <= 0) break;
    
    let currentStart = slot.start;
    
    // שיבוץ בלוקים בסלוט
    while (progress.remaining > 0 && currentStart + config.blockDuration <= slot.end) {
      const blockDuration = Math.min(progress.remaining, config.blockDuration);
      const blockEnd = currentStart + blockDuration;
      
      const blockIndex = progress.blocks.length + 1;
      
      const block = {
        id: `${task.id}-block-${blockIndex}`,
        taskId: task.id,
        task: task,
        type: task.task_type || 'other',
        title: totalBlocks > 1 ? `${task.title} (${blockIndex}/${totalBlocks})` : task.title,
        startMinute: currentStart,
        endMinute: blockEnd,
        startTime: minutesToTime(currentStart),
        endTime: minutesToTime(blockEnd),
        duration: blockDuration,
        blockIndex,
        totalBlocks,
        dayDate: day.date
      };
      
      day.blocks.push(block);
      progress.blocks.push(block);
      progress.scheduled += blockDuration;
      progress.remaining -= blockDuration;
      day.totalScheduledMinutes += blockDuration;
      
      // עדכון שימוש בחלונות
      if (currentStart < config.morningEnd) {
        day.morningMinutesUsed += blockDuration;
      } else {
        day.afternoonMinutesUsed += blockDuration;
      }
      
      currentStart = blockEnd + config.breakDuration;
    }
  }
  
  // מיון בלוקים לפי שעה
  day.blocks.sort((a, b) => a.startMinute - b.startMinute);
}

/**
 * מציאת סלוטים פנויים בחלון
 */
function findFreeSlots(blocks, windowStart, windowEnd, config) {
  const slots = [];
  const sortedBlocks = blocks
    .filter(b => b.endMinute > windowStart && b.startMinute < windowEnd)
    .sort((a, b) => a.startMinute - b.startMinute);
  
  let current = windowStart;
  
  for (const block of sortedBlocks) {
    if (block.startMinute > current) {
      const gapSize = block.startMinute - current;
      if (gapSize >= config.blockDuration) {
        slots.push({ start: current, end: block.startMinute });
      }
    }
    current = Math.max(current, block.endMinute + config.breakDuration);
  }
  
  // סלוט בסוף החלון
  if (windowEnd > current) {
    const gapSize = windowEnd - current;
    if (gapSize >= config.blockDuration) {
      slots.push({ start: current, end: windowEnd });
    }
  }
  
  return slots;
}

/**
 * בדיקת היתכנות - האם אפשר לסיים לפני הדדליין?
 */
function checkFeasibility(task, days, config) {
  const duration = task.estimated_duration || 30;
  const deadline = task.due_date;
  
  let availableMinutes = 0;
  
  for (const day of days) {
    if (!day.isWorkDay) continue;
    if (day.date > deadline) break;
    
    // זמן פנוי ביום
    const dayCapacity = config.workMinutesPerDay - day.totalScheduledMinutes;
    availableMinutes += Math.max(0, dayCapacity);
  }
  
  return {
    canComplete: availableMinutes >= duration,
    availableMinutes,
    requiredMinutes: duration,
    deficit: Math.max(0, duration - availableMinutes)
  };
}

// ============================================
// שלב 4: סטטיסטיקות
// ============================================

function calculateStats(days, schedulingResult, config) {
  const workDays = days.filter(d => d.isWorkDay);
  const totalAvailable = workDays.length * (config.dayEnd - config.dayStart);
  const totalScheduled = workDays.reduce((sum, d) => sum + d.totalScheduledMinutes, 0);
  
  return {
    totalScheduledMinutes: totalScheduled,
    totalAvailableMinutes: totalAvailable,
    usagePercent: totalAvailable > 0 ? Math.round((totalScheduled / totalAvailable) * 100) : 0,
    workDaysCount: workDays.length,
    overloadDays: workDays.filter(d => d.totalScheduledMinutes > (config.dayEnd - config.dayStart)).length,
    warningsCount: schedulingResult.warnings.length,
    unscheduledCount: schedulingResult.unscheduledTasks.length
  };
}

function formatDayForOutput(day) {
  const config = SMART_SCHEDULE_CONFIG;
  const dayCapacity = day.isWorkDay ? (config.dayEnd - config.dayStart) : 0;
  
  return {
    ...day,
    scheduledBlocks: day.blocks, // תאימות לאחור
    usagePercent: dayCapacity > 0 ? Math.round((day.totalScheduledMinutes / dayCapacity) * 100) : 0,
    freeMinutes: Math.max(0, dayCapacity - day.totalScheduledMinutes),
    scheduledMinutes: day.totalScheduledMinutes,
    availableMinutes: dayCapacity
  };
}

// ============================================
// פונקציות עזר
// ============================================

function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function isSameDay(date1, date2) {
  return date1.toISOString().split('T')[0] === date2.toISOString().split('T')[0];
}

function daysBetween(date1, date2) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil((date2 - date1) / msPerDay);
}

function isMorningTaskType(task, config) {
  const taskType = task.task_type?.toLowerCase() || '';
  const taskTitle = task.title?.toLowerCase() || '';
  
  return config.morningTaskTypes.some(type => 
    taskType.includes(type.toLowerCase()) || 
    taskTitle.includes(type.toLowerCase())
  );
}

// ============================================
// פונקציה לתאימות לאחור
// ============================================

export function smartScheduleDay(date, allTasks) {
  const weekStart = new Date(date);
  const dayOfWeek = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() - dayOfWeek);
  weekStart.setHours(12, 0, 0, 0);
  
  const weekPlan = smartScheduleWeek(weekStart, allTasks);
  const dateISO = date.toISOString().split('T')[0];
  
  return weekPlan.days.find(d => d.date === dateISO) || {
    date: dateISO,
    isWorkDay: false,
    blocks: [],
    scheduledBlocks: []
  };
}

// ============================================
// ייצוא
// ============================================

export default {
  smartScheduleDay,
  smartScheduleWeek,
  SMART_SCHEDULE_CONFIG
};

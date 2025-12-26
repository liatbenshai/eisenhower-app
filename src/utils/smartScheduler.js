/**
 * מנוע שיבוץ חכם
 * ================
 * פילוסופיה: לעבוד קדימה, לא לכבות שריפות!
 * 
 * כללים:
 * 1. ניצולת 100% - למלא את כל הזמן
 * 2. עדיפות לפי דדליין - קרוב יותר = קודם
 * 3. משימות בלי דדליין = לעשות היום
 * 4. תמלול בבוקר (08:15-12:00) - שעות עירנות
 * 5. בלוקים של 45 דקות + 5 דקות הפסקה
 * 6. אדמיניסטרציה רק 15 דקות בתחילת היום (08:00-08:15)
 */

import { WORK_HOURS, formatTime } from '../config/workSchedule';

/**
 * הגדרות השיבוץ החכם
 */
export const SMART_SCHEDULE_CONFIG = {
  // מבנה היום
  dayStart: 8 * 60,           // 08:00 בדקות
  dayEnd: 16 * 60,            // 16:00 בדקות
  
  // אדמיניסטרציה
  adminStart: 8 * 60,         // 08:00
  adminEnd: 8 * 60 + 15,      // 08:15
  adminDuration: 15,          // 15 דקות
  
  // שעות תמלול (עירנות גבוהה)
  transcriptionStart: 8 * 60 + 15,  // 08:15
  transcriptionEnd: 12 * 60,        // 12:00
  
  // שעות הגהה/תרגום (אחה"צ)
  afternoonStart: 12 * 60,    // 12:00
  afternoonEnd: 16 * 60,      // 16:00
  
  // בלוקים
  blockDuration: 45,          // 45 דקות לבלוק
  breakDuration: 5,           // 5 דקות הפסקה
  
  // סוגי משימות לבוקר
  morningTaskTypes: ['transcription', 'תמלול'],
  
  // סוגי משימות לאחה"צ
  afternoonTaskTypes: ['proofreading', 'translation', 'הגהה', 'תרגום', 'admin', 'other']
};

/**
 * שיבוץ חכם ליום
 * @param {Date} date - התאריך
 * @param {Array} allTasks - כל המשימות
 * @returns {Object} תוכנית היום
 */
export function smartScheduleDay(date, allTasks) {
  const dateISO = date.toISOString().split('T')[0];
  const dayOfWeek = date.getDay();
  
  // בדיקה אם יום עבודה
  if (!WORK_HOURS[dayOfWeek]?.enabled) {
    return {
      date: dateISO,
      isWorkDay: false,
      blocks: [],
      scheduledBlocks: [],
      stats: { scheduled: 0, available: 0, utilization: 0 }
    };
  }
  
  const config = SMART_SCHEDULE_CONFIG;
  const blocks = [];
  
  // סינון משימות רלוונטיות (לא הושלמו)
  const pendingTasks = allTasks.filter(t => !t.is_completed);
  
  // מיון לפי דחיפות
  const sortedTasks = sortByUrgency(pendingTasks, dateISO);
  
  // הפרדה לפי סוג
  const { morningTasks, afternoonTasks } = categorizeTasks(sortedTasks);
  
  // === שלב 1: אדמיניסטרציה (08:00-08:15) ===
  blocks.push({
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
  
  // === שלב 2: תמלול בבוקר (08:15-12:00) ===
  let currentMinute = config.transcriptionStart;
  const morningEnd = config.transcriptionEnd;
  
  for (const task of morningTasks) {
    if (currentMinute >= morningEnd) break;
    
    const taskBlocks = scheduleTaskInBlocks(task, currentMinute, morningEnd, config);
    blocks.push(...taskBlocks);
    
    if (taskBlocks.length > 0) {
      currentMinute = taskBlocks[taskBlocks.length - 1].endMinute + config.breakDuration;
    }
  }
  
  // === שלב 3: הגהה/תרגום אחה"צ (12:00-16:00) ===
  currentMinute = Math.max(currentMinute, config.afternoonStart);
  const afternoonEnd = config.afternoonEnd;
  
  // קודם משימות אחה"צ, אז משימות בוקר שנשארו
  const remainingMorningTasks = morningTasks.filter(t => 
    !blocks.some(b => b.taskId === t.id)
  );
  const allAfternoonTasks = [...afternoonTasks, ...remainingMorningTasks];
  
  for (const task of allAfternoonTasks) {
    if (currentMinute >= afternoonEnd) break;
    
    // בדיקה אם המשימה כבר שובצה
    if (blocks.some(b => b.taskId === task.id)) continue;
    
    const taskBlocks = scheduleTaskInBlocks(task, currentMinute, afternoonEnd, config);
    blocks.push(...taskBlocks);
    
    if (taskBlocks.length > 0) {
      currentMinute = taskBlocks[taskBlocks.length - 1].endMinute + config.breakDuration;
    }
  }
  
  // === שלב 4: מילוי זמן שנותר עם משימות נוספות ===
  const unscheduledTasks = sortedTasks.filter(t => 
    !blocks.some(b => b.taskId === t.id)
  );
  
  // מציאת חלונות פנויים ומילוי אותם
  const freeSlots = findFreeSlots(blocks, config.adminEnd, config.dayEnd, config);
  
  for (const slot of freeSlots) {
    for (const task of unscheduledTasks) {
      if (blocks.some(b => b.taskId === task.id)) continue;
      
      const taskBlocks = scheduleTaskInBlocks(task, slot.start, slot.end, config);
      if (taskBlocks.length > 0) {
        blocks.push(...taskBlocks);
        break;
      }
    }
  }
  
  // מיון לפי שעה
  blocks.sort((a, b) => a.startMinute - b.startMinute);
  
  // חישוב סטטיסטיקות
  const totalAvailable = config.dayEnd - config.dayStart;
  const totalScheduled = blocks.reduce((sum, b) => sum + b.duration, 0);
  
  return {
    date: dateISO,
    dayName: WORK_HOURS[dayOfWeek].name,
    isWorkDay: true,
    blocks,
    scheduledBlocks: blocks, // תאימות לאחור
    workHours: { start: 8, end: 16 },
    unscheduledTasks: unscheduledTasks.filter(t => !blocks.some(b => b.taskId === t.id)),
    scheduledMinutes: totalScheduled,
    availableMinutes: totalAvailable,
    freeMinutes: totalAvailable - totalScheduled,
    usagePercent: Math.round((totalScheduled / totalAvailable) * 100),
    stats: {
      scheduled: totalScheduled,
      available: totalAvailable,
      utilization: Math.round((totalScheduled / totalAvailable) * 100),
      blocksCount: blocks.length
    }
  };
}

/**
 * מיון משימות לפי דחיפות
 */
function sortByUrgency(tasks, todayISO) {
  const today = new Date(todayISO);
  
  return [...tasks].sort((a, b) => {
    // משימות בלי דדליין = דדליין היום (הכי דחוף!)
    const aDue = a.due_date ? new Date(a.due_date) : today;
    const bDue = b.due_date ? new Date(b.due_date) : today;
    
    // לפי תאריך יעד
    const dateDiff = aDue - bDue;
    if (dateDiff !== 0) return dateDiff;
    
    // אם אותו תאריך - לפי עדיפות
    const priorityOrder = { urgent: 0, high: 1, normal: 2 };
    const aPriority = priorityOrder[a.priority] ?? 2;
    const bPriority = priorityOrder[b.priority] ?? 2;
    
    return aPriority - bPriority;
  });
}

/**
 * הפרדת משימות לבוקר ואחה"צ
 */
function categorizeTasks(tasks) {
  const config = SMART_SCHEDULE_CONFIG;
  
  const morningTasks = [];
  const afternoonTasks = [];
  
  for (const task of tasks) {
    const taskType = task.task_type?.toLowerCase() || '';
    const taskTitle = task.title?.toLowerCase() || '';
    
    // בדיקה אם זו משימת תמלול
    const isMorningType = config.morningTaskTypes.some(type => 
      taskType.includes(type.toLowerCase()) || taskTitle.includes(type.toLowerCase())
    );
    
    if (isMorningType) {
      morningTasks.push(task);
    } else {
      afternoonTasks.push(task);
    }
  }
  
  return { morningTasks, afternoonTasks };
}

/**
 * שיבוץ משימה בבלוקים של 45 דקות
 */
function scheduleTaskInBlocks(task, startMinute, endMinute, config) {
  const blocks = [];
  const taskDuration = task.estimated_duration || 30;
  let remainingDuration = taskDuration;
  let currentStart = startMinute;
  let blockIndex = 1;
  
  // כמה בלוקים צריך
  const totalBlocks = Math.ceil(taskDuration / config.blockDuration);
  
  while (remainingDuration > 0 && currentStart < endMinute) {
    const blockDuration = Math.min(remainingDuration, config.blockDuration);
    const blockEnd = currentStart + blockDuration;
    
    // בדיקה שלא חורגים מסוף הזמן
    if (blockEnd > endMinute) break;
    
    blocks.push({
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
      isFixed: !!task.due_time,
      blockIndex,
      totalBlocks
    });
    
    remainingDuration -= blockDuration;
    currentStart = blockEnd + config.breakDuration;
    blockIndex++;
  }
  
  return blocks;
}

/**
 * מציאת חלונות פנויים
 */
function findFreeSlots(blocks, dayStart, dayEnd, config) {
  const slots = [];
  const sortedBlocks = [...blocks].sort((a, b) => a.startMinute - b.startMinute);
  
  let currentStart = dayStart;
  
  for (const block of sortedBlocks) {
    if (block.startMinute > currentStart + config.blockDuration) {
      slots.push({
        start: currentStart,
        end: block.startMinute - config.breakDuration
      });
    }
    currentStart = Math.max(currentStart, block.endMinute + config.breakDuration);
  }
  
  // חלון בסוף היום
  if (currentStart + config.blockDuration <= dayEnd) {
    slots.push({
      start: currentStart,
      end: dayEnd
    });
  }
  
  return slots;
}

/**
 * המרת דקות לפורמט שעה
 */
function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * שיבוץ חכם לשבוע שלם
 */
export function smartScheduleWeek(weekStart, allTasks) {
  const days = [];
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    date.setHours(12, 0, 0, 0);
    
    const dayPlan = smartScheduleDay(date, allTasks);
    days.push(dayPlan);
  }
  
  // סטטיסטיקות שבועיות
  const workDays = days.filter(d => d.isWorkDay);
  const totalScheduled = workDays.reduce((sum, d) => sum + d.stats.scheduled, 0);
  const totalAvailable = workDays.reduce((sum, d) => sum + d.stats.available, 0);
  
  return {
    weekStart: weekStart.toISOString().split('T')[0],
    days,
    summary: {
      totalScheduledMinutes: totalScheduled,
      totalAvailableMinutes: totalAvailable,
      usagePercent: totalAvailable > 0 ? Math.round((totalScheduled / totalAvailable) * 100) : 0,
      overloadDays: 0
    },
    stats: {
      totalScheduled,
      totalAvailable,
      utilization: totalAvailable > 0 ? Math.round((totalScheduled / totalAvailable) * 100) : 0,
      workDaysCount: workDays.length
    }
  };
}

export default {
  smartScheduleDay,
  smartScheduleWeek,
  SMART_SCHEDULE_CONFIG
};

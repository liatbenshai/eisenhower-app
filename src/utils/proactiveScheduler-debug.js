/**
 * מתכנן פרואקטיבי
 * ================
 * פילוסופיה: לא לכבות שריפות - לעבוד קדימה!
 * 
 * עקרונות:
 * 1. ממלא ימים פנויים עם משימות עתידיות
 * 2. מתעדף לפי תאריך יעד + עדיפות
 * 3. המטרה: לסיים משימות כמה שיותר מהר
 * 4. לא משאיר זמן פנוי מיותר
 */

import { 
  getAvailableMinutesForDay,
  getWorkMinutesForDay,
  getWorkHoursForDate,
  isWorkDay,
  formatTime,
  formatDuration,
  BUFFER_PERCENTAGE
} from '../config/workSchedule';

/**
 * תכנון פרואקטיבי לשבוע
 * ======================
 * ממלא את כל הזמן הפנוי במשימות, גם עתידיות
 */
export function proactivePlan(allTasks, startDate = new Date(), daysAhead = 14) {
  console.log('🚀 proactivePlan called:', { 
    totalTasks: allTasks?.length,
    startDate: startDate?.toISOString?.(),
    daysAhead 
  });
  
  const schedule = [];
  const assignedTasks = new Set(); // משימות שכבר שובצו
  
  // סינון משימות פעילות בלבד
  const pendingTasks = allTasks.filter(t => !t.is_completed);
  console.log('📋 Pending tasks:', pendingTasks.length, pendingTasks.slice(0, 3).map(t => ({ 
    id: t.id, 
    title: t.title, 
    start_date: t.start_date,
    due_date: t.due_date,
    due_time: t.due_time,
    estimated_duration: t.estimated_duration
  })));
  
  // מיון משימות לפי דחיפות (קרוב יותר = דחוף יותר)
  const sortedTasks = sortByUrgency(pendingTasks);
  
  // עבור כל יום בטווח
  for (let i = 0; i < daysAhead; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    
    if (!isWorkDay(date)) {
      schedule.push({
        date: date.toISOString().split('T')[0],
        dayName: getDayName(date),
        isWorkDay: false,
        slots: [],
        tasks: [],
        stats: { available: 0, scheduled: 0, free: 0 }
      });
      continue;
    }
    
    const dayPlan = planDayProactively(date, sortedTasks, assignedTasks);
    schedule.push(dayPlan);
  }
  
  // חישוב סטטיסטיקות כלליות
  const stats = calculateOverallStats(schedule, pendingTasks, assignedTasks);
  
  return {
    schedule,
    stats,
    unassignedTasks: pendingTasks.filter(t => !assignedTasks.has(t.id))
  };
}

/**
 * תכנון יום בודד באופן פרואקטיבי
 */
function planDayProactively(date, sortedTasks, assignedTasks) {
  const dateISO = date.toISOString().split('T')[0];
  const dayOfWeek = date.getDay();
  const workHours = getWorkHoursForDate(date);
  const availableMinutes = getAvailableMinutesForDay(dayOfWeek);
  const totalMinutes = getWorkMinutesForDay(dayOfWeek);
  
  console.log(`📅 Planning day ${dateISO}:`, { 
    dayOfWeek, 
    availableMinutes, 
    totalMinutes,
    workHours,
    pendingTasks: sortedTasks.length,
    alreadyAssigned: assignedTasks.size
  });
  
  const slots = []; // בלוקי זמן מתוכננים
  const dayTasks = []; // משימות שמשובצות ליום זה
  let scheduledMinutes = 0;
  let currentMinute = workHours.start * 60;
  const endMinute = workHours.end * 60;
  
  // שלב 1: שיבוץ משימות עם שעה קבועה (fixed time)
  const fixedTimeTasks = sortedTasks.filter(t => 
    !assignedTasks.has(t.id) &&
    t.due_time &&
    (t.due_date === dateISO || t.start_date === dateISO)
  );
  
  for (const task of fixedTimeTasks) {
    const [h, m] = task.due_time.split(':').map(Number);
    const startMin = h * 60 + (m || 0);
    const duration = task.estimated_duration || 30;
    const endMin = startMin + duration;
    
    if (startMin >= workHours.start * 60 && endMin <= endMinute) {
      slots.push({
        taskId: task.id,
        task,
        startMinute: startMin,
        endMinute: endMin,
        startTime: formatTime(h, m || 0),
        endTime: minutesToTime(endMin),
        duration,
        isFixed: true,
        source: 'fixed'
      });
      
      assignedTasks.add(task.id);
      dayTasks.push(task);
      scheduledMinutes += duration;
    }
  }
  
  // מיון slots לפי שעת התחלה
  slots.sort((a, b) => a.startMinute - b.startMinute);
  
  // שלב 2: מילוי זמן פנוי עם משימות לפי עדיפות
  let skippedReasons = { assigned: 0, hasTime: 0, noRoom: 0, shouldNotSchedule: 0, noSlot: 0 };
  
  for (const task of sortedTasks) {
    if (assignedTasks.has(task.id)) { skippedReasons.assigned++; continue; }
    if (task.due_time) { skippedReasons.hasTime++; continue; } // כבר טופל
    
    const duration = task.estimated_duration || 30;
    
    // בדיקה אם יש מקום ביום
    if (scheduledMinutes + duration > availableMinutes) { skippedReasons.noRoom++; continue; }
    
    // בדיקה אם המשימה צריכה להיות משובצת (לפי תאריך יעד)
    const shouldSchedule = shouldScheduleTask(task, dateISO);
    if (!shouldSchedule) { skippedReasons.shouldNotSchedule++; continue; }
    
    // מציאת חלון פנוי
    const slot = findFreeSlot(slots, currentMinute, endMinute, duration);
    
    if (slot) {
      slots.push({
        taskId: task.id,
        task,
        startMinute: slot.start,
        endMinute: slot.end,
        startTime: minutesToTime(slot.start),
        endTime: minutesToTime(slot.end),
        duration,
        isFixed: false,
        source: getTaskSource(task, dateISO)
      });
      
      assignedTasks.add(task.id);
      dayTasks.push(task);
      scheduledMinutes += duration;
      
      // מיון מחדש
      slots.sort((a, b) => a.startMinute - b.startMinute);
    } else {
      skippedReasons.noSlot++;
    }
  }
  
  console.log(`📅 Day ${dateISO} result:`, { 
    slotsCount: slots.length, 
    scheduledMinutes, 
    skippedReasons,
    dayTasks: dayTasks.map(t => t.title)
  });
  
  // חישוב הפסקות
  const breaks = calculateBreaks(slots, workHours);
  
  return {
    date: dateISO,
    dayName: getDayName(date),
    isWorkDay: true,
    workHours,
    slots,
    breaks,
    tasks: dayTasks,
    stats: {
      total: totalMinutes,
      available: availableMinutes,
      scheduled: scheduledMinutes,
      free: availableMinutes - scheduledMinutes,
      buffer: totalMinutes - availableMinutes,
      utilizationPercent: Math.round((scheduledMinutes / availableMinutes) * 100)
    }
  };
}

/**
 * בדיקה אם משימה צריכה להיות משובצת ביום מסוים
 */
function shouldScheduleTask(task, dateISO) {
  const today = new Date(dateISO);
  
  // משימה עם תאריך התחלה - רק מהתאריך הזה
  if (task.start_date) {
    const startDate = new Date(task.start_date);
    if (today < startDate) return false;
  }
  
  // משימה עם תאריך יעד בעתיד - אפשר לשבץ מוקדם!
  if (task.due_date) {
    const dueDate = new Date(task.due_date);
    // אם תאריך היעד עבר - דחוף!
    if (today > dueDate) return true;
    // אם תאריך היעד בעתיד - עדיין אפשר לשבץ (זו הנקודה!)
    return true;
  }
  
  // משימה ללא תאריך - אפשר לשבץ בכל יום
  return true;
}

/**
 * מקור המשימה (למה היא משובצת ליום זה)
 */
function getTaskSource(task, dateISO) {
  if (task.start_date === dateISO) return 'start_date';
  if (task.due_date === dateISO) return 'due_date';
  if (task.due_date && new Date(task.due_date) < new Date(dateISO)) return 'overdue';
  if (task.due_date && new Date(task.due_date) > new Date(dateISO)) return 'proactive'; // זה המפתח!
  return 'no_date';
}

/**
 * מיון משימות לפי דחיפות
 */
function sortByUrgency(tasks) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return [...tasks].sort((a, b) => {
    // 1. משימות באיחור קודם
    const aOverdue = a.due_date && new Date(a.due_date) < today;
    const bOverdue = b.due_date && new Date(b.due_date) < today;
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    
    // 2. לפי עדיפות
    const priorityOrder = { urgent: 0, high: 1, normal: 2 };
    const aPriority = priorityOrder[a.priority] ?? 2;
    const bPriority = priorityOrder[b.priority] ?? 2;
    if (aPriority !== bPriority) return aPriority - bPriority;
    
    // 3. לפי תאריך יעד (קרוב יותר = דחוף יותר)
    if (a.due_date && b.due_date) {
      return new Date(a.due_date) - new Date(b.due_date);
    }
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    
    // 4. לפי תאריך יצירה
    return new Date(a.created_at) - new Date(b.created_at);
  });
}

/**
 * מציאת חלון זמן פנוי
 */
function findFreeSlot(existingSlots, startFrom, endAt, duration) {
  let currentStart = startFrom;
  
  const sortedSlots = [...existingSlots].sort((a, b) => a.startMinute - b.startMinute);
  
  for (const slot of sortedSlots) {
    // יש מקום לפני הבלוק הזה?
    if (currentStart + duration <= slot.startMinute) {
      return { start: currentStart, end: currentStart + duration };
    }
    // מתקדמים לאחרי הבלוק
    currentStart = Math.max(currentStart, slot.endMinute + 5); // 5 דקות מרווח
  }
  
  // בדיקה אם יש מקום אחרי כל הבלוקים
  if (currentStart + duration <= endAt) {
    return { start: currentStart, end: currentStart + duration };
  }
  
  return null;
}

/**
 * חישוב הפסקות
 */
function calculateBreaks(slots, workHours) {
  const breaks = [];
  const sortedSlots = [...slots].sort((a, b) => a.startMinute - b.startMinute);
  
  let previousEnd = workHours.start * 60;
  
  for (const slot of sortedSlots) {
    const gap = slot.startMinute - previousEnd;
    if (gap >= 15) { // הפסקה של לפחות 15 דקות
      breaks.push({
        startMinute: previousEnd,
        endMinute: slot.startMinute,
        startTime: minutesToTime(previousEnd),
        endTime: minutesToTime(slot.startMinute),
        duration: gap
      });
    }
    previousEnd = slot.endMinute;
  }
  
  // הפסקה בסוף היום
  const endOfDay = workHours.end * 60;
  if (endOfDay - previousEnd >= 15) {
    breaks.push({
      startMinute: previousEnd,
      endMinute: endOfDay,
      startTime: minutesToTime(previousEnd),
      endTime: minutesToTime(endOfDay),
      duration: endOfDay - previousEnd
    });
  }
  
  return breaks;
}

/**
 * חישוב סטטיסטיקות כלליות
 */
function calculateOverallStats(schedule, allTasks, assignedTasks) {
  const workDays = schedule.filter(d => d.isWorkDay);
  
  const totalAvailable = workDays.reduce((sum, d) => sum + d.stats.available, 0);
  const totalScheduled = workDays.reduce((sum, d) => sum + d.stats.scheduled, 0);
  const totalFree = workDays.reduce((sum, d) => sum + d.stats.free, 0);
  
  const overdueTasks = allTasks.filter(t => {
    if (t.is_completed) return false;
    if (!t.due_date) return false;
    return new Date(t.due_date) < new Date();
  });
  
  const proactivelyScheduled = schedule.reduce((count, day) => {
    return count + (day.slots?.filter(s => s.source === 'proactive')?.length || 0);
  }, 0);
  
  return {
    totalTasks: allTasks.length,
    assignedTasks: assignedTasks.size,
    unassignedTasks: allTasks.length - assignedTasks.size,
    overdueTasks: overdueTasks.length,
    proactivelyScheduled,
    totalAvailableMinutes: totalAvailable,
    totalScheduledMinutes: totalScheduled,
    totalFreeMinutes: totalFree,
    utilizationPercent: totalAvailable > 0 ? Math.round((totalScheduled / totalAvailable) * 100) : 0
  };
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
 * שם היום בעברית
 */
function getDayName(date) {
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  return days[date.getDay()];
}

/**
 * תכנון אוטומטי של משימות ללא תאריך
 * ==================================
 * מחלק משימות ללא תאריך על פני ימים פנויים
 */
export function autoScheduleUnassigned(allTasks, daysAhead = 14) {
  const pendingTasks = allTasks.filter(t => !t.is_completed && !t.due_date && !t.start_date);
  const suggestions = [];
  
  // תכנון בסיסי לראות איפה יש מקום
  const plan = proactivePlan(allTasks, new Date(), daysAhead);
  
  for (const task of pendingTasks) {
    // מציאת היום הראשון עם מספיק מקום
    for (const day of plan.schedule) {
      if (!day.isWorkDay) continue;
      
      const duration = task.estimated_duration || 30;
      if (day.stats.free >= duration) {
        suggestions.push({
          task,
          suggestedDate: day.date,
          suggestedDay: day.dayName,
          reason: `יש ${day.stats.free} דקות פנויות ביום ${day.dayName}`
        });
        break;
      }
    }
  }
  
  return suggestions;
}

export default {
  proactivePlan,
  autoScheduleUnassigned
};

/**
 * תובנות זמן חכמות
 * כולל: אזהרת עומס, הצעת זמן מלמידה, ניתוח דפוסים
 */

import { TASK_TYPES } from '../config/taskTypes';

/**
 * שעות עבודה ביום (בדקות)
 */
const WORK_HOURS_PER_DAY = 8 * 60; // 480 דקות

/**
 * בדיקה האם יום עמוס מדי
 */
export function checkDayOverload(date, tasks, newTaskDuration = 0) {
  const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
  
  // משימות של אותו יום
  const dayTasks = tasks.filter(t => 
    t.due_date === dateStr && !t.is_completed
  );

  // זמן מתוכנן קיים
  const existingPlanned = dayTasks.reduce((sum, t) => 
    sum + (t.estimated_duration || 30), 0
  );

  // זמן כולל כולל המשימה החדשה
  const totalPlanned = existingPlanned + newTaskDuration;

  // חישוב אחוז ניצול
  const utilizationPercent = Math.round((totalPlanned / WORK_HOURS_PER_DAY) * 100);

  // רמת סיכון
  let riskLevel = 'ok';
  let message = '';
  let suggestion = null;

  if (utilizationPercent > 120) {
    riskLevel = 'critical';
    message = `היום עמוס ב-${utilizationPercent - 100}% יותר ממה שאפשר!`;
    suggestion = 'להעביר משימות למחר';
  } else if (utilizationPercent > 100) {
    riskLevel = 'high';
    message = `היום כבר מלא (${utilizationPercent}% ניצול)`;
    suggestion = 'לשקול לדחות משהו';
  } else if (utilizationPercent > 85) {
    riskLevel = 'warning';
    message = `היום כמעט מלא (${utilizationPercent}% ניצול)`;
  }

  return {
    dateStr,
    existingPlanned,
    totalPlanned,
    availableTime: WORK_HOURS_PER_DAY,
    utilizationPercent,
    riskLevel,
    message,
    suggestion,
    tasksCount: dayTasks.length,
    remainingTime: Math.max(0, WORK_HOURS_PER_DAY - totalPlanned)
  };
}

/**
 * קבלת הערכת זמן חכמה מהיסטוריה
 */
export function getSmartEstimation(taskType, tasks, userStats = null) {
  const typeInfo = TASK_TYPES[taskType] || TASK_TYPES.other;
  const defaultDuration = typeInfo.defaultDuration || 30;

  // משימות דומות שהושלמו
  const similarTasks = tasks.filter(t => 
    t.task_type === taskType && 
    t.is_completed && 
    t.time_spent > 0
  );

  if (similarTasks.length < 3) {
    // אין מספיק נתונים - ברירת מחדל
    return {
      suggested: defaultDuration,
      confidence: 'low',
      basedOn: 'default',
      message: null
    };
  }

  // חישוב ממוצע הזמן בפועל
  const totalActual = similarTasks.reduce((sum, t) => sum + t.time_spent, 0);
  const avgActual = Math.round(totalActual / similarTasks.length);

  // חישוב ממוצע ההערכות
  const totalEstimated = similarTasks.reduce((sum, t) => 
    sum + (t.estimated_duration || 30), 0
  );
  const avgEstimated = Math.round(totalEstimated / similarTasks.length);

  // פער באחוזים
  const gapPercent = avgEstimated > 0 
    ? Math.round(((avgActual - avgEstimated) / avgEstimated) * 100)
    : 0;

  // הצעה מותאמת
  let suggestion = avgActual;
  let message = null;
  let confidence = 'medium';

  if (similarTasks.length >= 10) {
    confidence = 'high';
  }

  if (Math.abs(gapPercent) > 20) {
    if (gapPercent > 0) {
      message = `💡 ${typeInfo.name} לוקחים בד"כ ${gapPercent}% יותר מההערכה`;
    } else {
      message = `💡 ${typeInfo.name} לוקחים בד"כ ${Math.abs(gapPercent)}% פחות מההערכה`;
    }
  }

  // עיגול ל-5 דקות
  suggestion = Math.round(suggestion / 5) * 5;

  return {
    suggested: suggestion,
    defaultDuration,
    avgActual,
    avgEstimated,
    gapPercent,
    confidence,
    basedOn: `${similarTasks.length} משימות קודמות`,
    message,
    similarCount: similarTasks.length
  };
}

/**
 * ניתוח דפוסי עבודה להמלצות
 */
export function analyzeWorkPatterns(tasks) {
  const completedTasks = tasks.filter(t => t.is_completed && t.time_spent);
  
  if (completedTasks.length < 5) {
    return null;
  }

  // ניתוח לפי יום בשבוע
  const byDayOfWeek = {};
  completedTasks.forEach(t => {
    if (!t.completed_at) return;
    const day = new Date(t.completed_at).getDay();
    if (!byDayOfWeek[day]) {
      byDayOfWeek[day] = { count: 0, totalTime: 0 };
    }
    byDayOfWeek[day].count++;
    byDayOfWeek[day].totalTime += t.time_spent;
  });

  // ניתוח לפי שעה
  const byHour = {};
  completedTasks.forEach(t => {
    if (!t.completed_at) return;
    const hour = new Date(t.completed_at).getHours();
    if (!byHour[hour]) {
      byHour[hour] = { count: 0, avgDuration: 0 };
    }
    byHour[hour].count++;
  });

  // מציאת השעות הכי פרודוקטיביות
  const productiveHours = Object.entries(byHour)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3)
    .map(([hour]) => parseInt(hour));

  // ימים הכי פרודוקטיביים
  const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const productiveDays = Object.entries(byDayOfWeek)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 2)
    .map(([day]) => dayNames[parseInt(day)]);

  return {
    productiveHours,
    productiveDays,
    totalCompleted: completedTasks.length
  };
}

/**
 * פורמט זמן
 */
export function formatMinutes(minutes) {
  if (!minutes) return '0 דק\'';
  if (minutes < 60) return `${minutes} דק'`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours} שעות`;
  return `${hours}:${mins.toString().padStart(2, '0')}`;
}

export default {
  checkDayOverload,
  getSmartEstimation,
  analyzeWorkPatterns,
  formatMinutes
};

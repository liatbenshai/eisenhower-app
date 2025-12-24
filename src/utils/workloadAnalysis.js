/**
 * ניתוח עומס עבודה
 * המערכת מנתחת את העומס ומזהירה מפני עומס יתר
 */

import { detectTaskCategory, analyzeCategoryDistribution } from './taskCategories';
import { calculateEnergyLevel, analyzeEnergyPatterns } from './energyManagement';
import { isTaskOverdue, isTaskDueToday, isTaskDueTomorrow } from './taskHelpers';

/**
 * ניתוח עומס עבודה כולל
 */
export function analyzeWorkload(tasks, timeBlocks = [], date = new Date()) {
  const activeTasks = tasks.filter(t => !t.is_completed);
  const overdueTasks = activeTasks.filter(t => isTaskOverdue(t));
  const dueToday = activeTasks.filter(t => isTaskDueToday(t));
  const dueTomorrow = activeTasks.filter(t => isTaskDueTomorrow(t));
  
  // חישוב זמן כולל נדרש
  const totalEstimatedTime = activeTasks.reduce((sum, task) => {
    return sum + (task.estimated_duration || 0);
  }, 0);
  
  // חישוב זמן מתוכנן
  const scheduledTime = timeBlocks
    .filter(block => {
      const blockDate = new Date(block.start_time);
      return blockDate.toDateString() === date.toDateString() && !block.is_completed;
    })
    .reduce((sum, block) => {
      const duration = (new Date(block.end_time) - new Date(block.start_time)) / (1000 * 60);
      return sum + duration;
    }, 0);
  
  // ניתוח לפי קטגוריות
  const categoryAnalysis = analyzeCategoryDistribution(activeTasks);
  
  // ניתוח אנרגיה
  const energyPatterns = analyzeEnergyPatterns(tasks, timeBlocks);
  
  // חישוב עומס לפי ימים
  const workloadByDay = calculateWorkloadByDay(activeTasks, timeBlocks);
  
  return {
    totalTasks: activeTasks.length,
    overdueTasks: overdueTasks.length,
    dueToday: dueToday.length,
    dueTomorrow: dueTomorrow.length,
    totalEstimatedTime,
    scheduledTime,
    availableTime: calculateAvailableTime(date),
    utilizationRate: calculateUtilizationRate(scheduledTime, calculateAvailableTime(date)),
    categoryAnalysis,
    energyPatterns,
    workloadByDay,
    riskLevel: calculateRiskLevel(overdueTasks.length, dueToday.length, totalEstimatedTime, calculateAvailableTime(date)),
    recommendations: generateWorkloadRecommendations({
      overdueTasks,
      dueToday,
      dueTomorrow,
      totalEstimatedTime,
      scheduledTime,
      availableTime: calculateAvailableTime(date),
      categoryAnalysis
    })
  };
}

/**
 * חישוב זמן זמין ביום
 */
function calculateAvailableTime(date) {
  const dayOfWeek = date.getDay();
  
  // סוף שבוע - פחות זמן
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return 5 * 60; // 5 שעות
  }
  
  // יום חול - זמן רגיל (מינוס משפחה)
  // נניח 8 שעות עבודה, מינוס 2 שעות משפחה = 6 שעות
  return 6 * 60; // 6 שעות = 360 דקות
}

/**
 * חישוב שיעור ניצול
 */
function calculateUtilizationRate(scheduledTime, availableTime) {
  if (availableTime === 0) return 0;
  return Math.round((scheduledTime / availableTime) * 100);
}

/**
 * חישוב רמת סיכון
 */
function calculateRiskLevel(overdueCount, dueTodayCount, estimatedTime, availableTime) {
  let risk = 0;
  
  // משימות באיחור
  if (overdueCount > 0) risk += 30;
  if (overdueCount > 3) risk += 20;
  
  // משימות היום
  if (dueTodayCount > 5) risk += 20;
  if (dueTodayCount > 10) risk += 20;
  
  // עומס זמן
  if (estimatedTime > availableTime * 1.5) risk += 30;
  if (estimatedTime > availableTime * 2) risk += 20;
  
  if (risk >= 80) return 'critical';
  if (risk >= 60) return 'high';
  if (risk >= 40) return 'medium';
  return 'low';
}

/**
 * חישוב עומס לפי ימים
 */
function calculateWorkloadByDay(tasks, timeBlocks) {
  const workload = {};
  
  // אתחול 7 ימים קדימה
  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    
    workload[dateStr] = {
      date: dateStr,
      tasks: [],
      estimatedTime: 0,
      scheduledTime: 0,
      riskLevel: 'low'
    };
  }
  
  // הוספת משימות
  tasks.forEach(task => {
    if (task.due_date) {
      const taskDate = new Date(task.due_date).toISOString().split('T')[0];
      if (workload[taskDate]) {
        workload[taskDate].tasks.push(task);
        workload[taskDate].estimatedTime += task.estimated_duration || 0;
      }
    }
  });
  
  // הוספת בלוקי זמן
  timeBlocks.forEach(block => {
    if (!block.is_completed) {
      const blockDate = new Date(block.start_time).toISOString().split('T')[0];
      if (workload[blockDate]) {
        const duration = (new Date(block.end_time) - new Date(block.start_time)) / (1000 * 60);
        workload[blockDate].scheduledTime += duration;
      }
    }
  });
  
  // חישוב רמת סיכון לכל יום
  Object.keys(workload).forEach(dateStr => {
    const day = workload[dateStr];
    const availableTime = calculateAvailableTime(new Date(dateStr));
    day.riskLevel = calculateRiskLevel(
      day.tasks.filter(t => isTaskOverdue(t)).length,
      day.tasks.filter(t => isTaskDueToday(t)).length,
      day.estimatedTime,
      availableTime
    );
  });
  
  return workload;
}

/**
 * יצירת המלצות לעומס עבודה
 */
function generateWorkloadRecommendations(analysis) {
  const recommendations = [];
  
  // משימות באיחור
  if (analysis.overdueTasks.length > 0) {
    recommendations.push({
      type: 'overdue',
      priority: 'critical',
      title: 'משימות באיחור',
      message: `יש לך ${analysis.overdueTasks.length} משימות באיחור. כדאי לטפל בהן מיד או לדחות את התאריך.`,
      actions: [
        { label: 'הצג משימות באיחור', action: 'show_overdue' },
        { label: 'דחה תאריכים', action: 'postpone_dates' }
      ]
    });
  }
  
  // עומס יתר
  if (analysis.utilizationRate > 100) {
    recommendations.push({
      type: 'overload',
      priority: 'high',
      title: 'עומס יתר',
      message: `יש לך יותר מדי משימות מתוכננות (${Math.round(analysis.utilizationRate)}% ניצול). חלק מהמשימות לא יושלמו בזמן.`,
      actions: [
        { label: 'דחה משימות', action: 'postpone_tasks' },
        { label: 'האצל משימות', action: 'delegate_tasks' }
      ]
    });
  }
  
  // יותר מדי משימות היום
  if (analysis.dueToday.length > 8) {
    recommendations.push({
      type: 'too_many_today',
      priority: 'high',
      title: 'יותר מדי משימות היום',
      message: `יש לך ${analysis.dueToday.length} משימות היום. זה יותר מדי! כדאי לדחות חלק מהן.`,
      actions: [
        { label: 'ארגן מחדש', action: 'reschedule' }
      ]
    });
  }
  
  // חוסר איזון בקטגוריות
  if (analysis.categoryAnalysis.mostCommon) {
    const mostCommon = analysis.categoryAnalysis.mostCommon;
    const percentage = analysis.categoryAnalysis.distribution[mostCommon.id]?.percentage || 0;
    
    if (percentage > 50) {
      recommendations.push({
        type: 'category_imbalance',
        priority: 'medium',
        title: 'חוסר איזון בקטגוריות',
        message: `${percentage}% מהמשימות שלך הן ${mostCommon.name}. כדאי לגוון.`,
        actions: [
          { label: 'הצג התפלגות', action: 'show_distribution' }
        ]
      });
    }
  }
  
  // המלצה על תכנון אוטומטי
  if (analysis.scheduledTime < analysis.totalEstimatedTime * 0.3) {
    recommendations.push({
      type: 'auto_schedule',
      priority: 'medium',
      title: 'תכנון אוטומטי',
      message: 'יש לך הרבה משימות ללא תכנון. המערכת יכולה לתכנן אותן אוטומטית.',
      actions: [
        { label: 'תכנן אוטומטית', action: 'auto_schedule' }
      ]
    });
  }
  
  return recommendations;
}

/**
 * ניתוח מגמות
 */
export function analyzeTrends(tasks, timeBlocks = [], days = 30) {
  const trends = {
    tasksCompleted: [],
    averageTime: [],
    productivity: [],
    categoryTrends: {}
  };
  
  // ניתוח לפי ימים
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    const dayTasks = tasks.filter(t => {
      if (!t.completed_at) return false;
      const completedDate = new Date(t.completed_at).toISOString().split('T')[0];
      return completedDate === dateStr;
    });
    
    trends.tasksCompleted.push({
      date: dateStr,
      count: dayTasks.length
    });
    
    const totalTime = dayTasks.reduce((sum, t) => sum + (t.time_spent || 0), 0);
    trends.averageTime.push({
      date: dateStr,
      time: dayTasks.length > 0 ? Math.round(totalTime / dayTasks.length) : 0
    });
  }
  
  return trends;
}

export default {
  analyzeWorkload,
  analyzeTrends
};


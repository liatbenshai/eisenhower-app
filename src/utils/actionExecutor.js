/**
 * מנוע יישום המלצות - מבצע פעולות על משימות בהתאם לתובנות
 */

import { 
  smartSchedule, 
  createTasksFromSchedule, 
  getScheduleSummaryText
} from './smartScheduler';

/**
 * עדכון הערכות זמן במשימות עתידיות
 */
export async function adjustFutureEstimations(tasks, editTask, adjustmentPercent, taskType = null) {
  const today = new Date().toISOString().split('T')[0];
  
  const futureTasks = tasks.filter(t => 
    !t.is_completed && 
    t.due_date >= today &&
    t.estimated_duration &&
    (taskType === null || t.task_type === taskType)
  );

  const results = {
    updated: 0,
    failed: 0,
    details: []
  };

  for (const task of futureTasks) {
    try {
      const newDuration = Math.round(task.estimated_duration * (1 + adjustmentPercent / 100));
      await editTask(task.id, { estimatedDuration: newDuration });
      results.updated++;
      results.details.push({
        id: task.id,
        title: task.title,
        oldDuration: task.estimated_duration,
        newDuration
      });
    } catch (err) {
      results.failed++;
      console.error(`Failed to update task ${task.id}:`, err);
    }
  }

  return results;
}

/**
 * שיבוץ חכם מחדש - עם 45 דקות אינטרוולים והפסקות
 */
export async function smartReschedule(tasks, editTask, addTask, options = {}) {
  const today = new Date().toISOString().split('T')[0];
  
  // סינון משימות לשיבוץ
  const tasksToSchedule = tasks.filter(t => 
    !t.is_completed && 
    t.due_date >= today &&
    t.estimated_duration
  );

  // שיבוץ חכם
  const { schedule, results, summary } = smartSchedule(tasksToSchedule, []);
  
  const actionResults = {
    scheduled: 0,
    created: 0,
    failed: 0,
    details: []
  };

  // עדכון משימות קיימות או יצירת חדשות
  for (const result of results) {
    if (!result.success) {
      actionResults.failed++;
      actionResults.details.push({
        title: result.taskTitle,
        error: result.reason
      });
      continue;
    }

    try {
      // אם זה אינטרוול ראשון - עדכן את המשימה המקורית
      if (result.intervalIndex === 1) {
        await editTask(result.taskId, {
          dueDate: result.scheduledDate,
          dueTime: result.scheduledTime,
          estimatedDuration: result.duration
        });
        actionResults.scheduled++;
      } else {
        // אינטרוולים נוספים - צור משימות חדשות
        await addTask({
          title: `${result.taskTitle} (${result.intervalIndex}/${result.totalIntervals})`,
          description: `חלק ${result.intervalIndex} מתוך ${result.totalIntervals}`,
          quadrant: result.quadrant,
          dueDate: result.scheduledDate,
          dueTime: result.scheduledTime,
          estimatedDuration: result.duration,
          taskType: result.taskType,
          parentTaskId: result.taskId
        });
        actionResults.created++;
      }

      actionResults.details.push({
        title: result.taskTitle,
        interval: `${result.intervalIndex}/${result.totalIntervals}`,
        date: result.scheduledDate,
        time: result.scheduledTime
      });
    } catch (err) {
      actionResults.failed++;
      console.error(`Failed to schedule task ${result.taskId}:`, err);
    }
  }

  actionResults.summary = getScheduleSummaryText(results);
  return actionResults;
}

/**
 * הזזת משימות מיום מסוים - עם שיבוץ חכם
 */
export async function rescheduleFromDay(tasks, editTask, addTask, fromDayIndex) {
  const today = new Date();
  const todayISO = today.toISOString().split('T')[0];
  
  // סינון משימות מהיום הבעייתי
  const tasksToMove = tasks.filter(t => {
    if (t.is_completed || !t.due_date || t.due_date < todayISO) return false;
    const taskDate = new Date(t.due_date);
    return taskDate.getDay() === fromDayIndex;
  });

  // מחיקת השיבוץ הנוכחי ושיבוץ מחדש
  const results = {
    moved: 0,
    created: 0,
    failed: 0,
    details: []
  };

  // שיבוץ חכם לכל המשימות
  const allTasks = tasks.filter(t => !t.is_completed && t.due_date >= todayISO);
  const { schedule, results: scheduleResults } = smartSchedule(allTasks, []);

  for (const result of scheduleResults) {
    if (!result.success) continue;
    
    const wasFromProblemDay = tasksToMove.some(t => t.id === result.taskId);
    if (!wasFromProblemDay) continue;

    try {
      if (result.intervalIndex === 1) {
        await editTask(result.taskId, {
          dueDate: result.scheduledDate,
          dueTime: result.scheduledTime,
          estimatedDuration: result.duration
        });
        results.moved++;
      } else {
        await addTask({
          title: `${result.taskTitle} (${result.intervalIndex}/${result.totalIntervals})`,
          quadrant: result.quadrant,
          dueDate: result.scheduledDate,
          dueTime: result.scheduledTime,
          estimatedDuration: result.duration,
          taskType: result.taskType
        });
        results.created++;
      }

      results.details.push({
        title: result.taskTitle,
        date: result.scheduledDate,
        time: result.scheduledTime
      });
    } catch (err) {
      results.failed++;
    }
  }

  return results;
}

/**
 * איזון עומס - שיבוץ חכם מחדש
 */
export async function balanceWorkload(tasks, editTask, addTask, maxMinutesPerDay = 360) {
  return smartReschedule(tasks, editTask, addTask, { maxMinutesPerDay });
}

/**
 * שיבוץ לשעות פרודוקטיביות
 */
export async function optimizeByProductiveHours(tasks, editTask, addTask, productiveHours) {
  // השיבוץ החכם כבר מתחשב בסוגי משימות ושעות
  return smartReschedule(tasks, editTask, addTask, { productiveHours });
}

/**
 * הקדמת דדליינים
 */
export async function addDeadlineBuffer(tasks, editTask, bufferDays = 1) {
  const today = new Date();
  const todayISO = today.toISOString().split('T')[0];
  
  const tasksWithDeadline = tasks.filter(t => 
    !t.is_completed && 
    t.due_date > todayISO
  );

  const results = {
    adjusted: 0,
    failed: 0,
    details: []
  };

  for (const task of tasksWithDeadline) {
    try {
      const currentDate = new Date(task.due_date);
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() - bufferDays);
      
      if (newDate < today) continue;
      
      const newDateISO = newDate.toISOString().split('T')[0];
      
      await editTask(task.id, { dueDate: newDateISO });
      results.adjusted++;
      results.details.push({
        id: task.id,
        title: task.title,
        oldDate: task.due_date,
        newDate: newDateISO
      });
    } catch (err) {
      results.failed++;
    }
  }

  return results;
}

/**
 * יצירת משימות מילוי לזמן מת
 */
export async function createFillerTasks(addTask) {
  const today = new Date().toISOString().split('T')[0];
  
  const fillerTasks = [
    { title: 'מיילים קצרים', duration: 15, type: 'admin' },
    { title: 'קריאת מאמר מקצועי', duration: 20, type: 'learning' },
    { title: 'סידור קבצים', duration: 10, type: 'admin' },
    { title: 'מעקב לקוחות', duration: 15, type: 'communication' },
    { title: 'תכנון מחר', duration: 10, type: 'planning' }
  ];

  const results = {
    created: 0,
    failed: 0,
    details: []
  };

  for (const filler of fillerTasks) {
    try {
      await addTask({
        title: `⚡ ${filler.title}`,
        description: 'משימת מילוי לזמן מת',
        quadrant: 4,
        dueDate: today,
        estimatedDuration: filler.duration,
        taskType: filler.type
      });
      results.created++;
      results.details.push(filler);
    } catch (err) {
      results.failed++;
    }
  }

  return results;
}

/**
 * שיבוץ מחדש אחרי ביטול (בתל"ם)
 */
export async function rescheduleAfterCancellation(tasks, editTask, addTask, cancelledTaskId) {
  // סנן את המשימה שבוטלה
  const remainingTasks = tasks.filter(t => t.id !== cancelledTaskId);
  
  // שבץ מחדש את כל השאר
  return smartReschedule(remainingTasks, editTask, addTask);
}

/**
 * הגדרת הפעולות לכל סוג המלצה
 */
export const ACTION_DEFINITIONS = {
  'estimation-low': {
    name: 'עדכון הערכות',
    description: 'הוסף אחוז לכל ההערכות העתידיות',
    execute: async (context) => {
      const { tasks, editTask, params } = context;
      return adjustFutureEstimations(tasks, editTask, params.adjustmentPercent);
    }
  },
  'estimation-type': {
    name: 'עדכון הערכות לסוג',
    description: 'הוסף אחוז להערכות של סוג משימה ספציפי',
    execute: async (context) => {
      const { tasks, editTask, params } = context;
      return adjustFutureEstimations(tasks, editTask, params.adjustmentPercent, params.taskType);
    }
  },
  'deadlines-low': {
    name: 'הקדמת דדליינים',
    description: 'הקדם את כל הדדליינים ביום אחד',
    execute: async (context) => {
      const { tasks, editTask } = context;
      return addDeadlineBuffer(tasks, editTask, 1);
    }
  },
  'deadlines-day': {
    name: 'שיבוץ חכם מיום בעייתי',
    description: 'הזז משימות ושבץ באינטרוולים של 45 דקות',
    execute: async (context) => {
      const { tasks, editTask, addTask, params } = context;
      return rescheduleFromDay(tasks, editTask, addTask, params.dayIndex);
    }
  },
  'idle-high': {
    name: 'יצירת משימות מילוי',
    description: 'צור משימות קצרות לזמן מת',
    execute: async (context) => {
      const { addTask } = context;
      return createFillerTasks(addTask);
    }
  },
  'hours-productive': {
    name: 'שיבוץ חכם',
    description: 'שבץ משימות עם תמלולים בבוקר והגהות אחר כך',
    execute: async (context) => {
      const { tasks, editTask, addTask, params } = context;
      return optimizeByProductiveHours(tasks, editTask, addTask, params.productiveHours);
    }
  },
  'workload-unbalanced': {
    name: 'איזון חכם',
    description: 'שבץ מחדש עם אינטרוולים של 45 דקות והפסקות',
    execute: async (context) => {
      const { tasks, editTask, addTask } = context;
      return balanceWorkload(tasks, editTask, addTask);
    }
  },
  'workload-high': {
    name: 'הפחתת עומס חכמה',
    description: 'פזר משימות עם שיבוץ חכם',
    execute: async (context) => {
      const { tasks, editTask, addTask } = context;
      return balanceWorkload(tasks, editTask, addTask, 300);
    }
  }
};

export default {
  adjustFutureEstimations,
  smartReschedule,
  rescheduleFromDay,
  balanceWorkload,
  optimizeByProductiveHours,
  addDeadlineBuffer,
  createFillerTasks,
  rescheduleAfterCancellation,
  ACTION_DEFINITIONS
};

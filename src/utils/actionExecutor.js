/**
 * מנוע יישום המלצות - מבצע פעולות על משימות בהתאם לתובנות
 */

import { scheduleLongTask, findFreeSlots } from './autoScheduler';

/**
 * מציאת שעה פנויה ביום מסוים
 */
function findFreeTimeSlot(dateISO, tasks, duration = 60) {
  const slots = findFreeSlots(dateISO, tasks);
  
  // מציאת חלון מתאים
  for (const slot of slots) {
    if (slot.minutes >= duration) {
      const hours = Math.floor(slot.start / 60);
      const mins = slot.start % 60;
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }
  }
  
  // אם אין חלון מתאים, שים ב-9:00
  return '09:00';
}

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
 * הזזת משימות מיום מסוים לימים אחרים - עם שיבוץ אוטומטי
 */
export async function rescheduleFromDay(tasks, editTask, fromDayIndex, targetDays = [0, 1, 2, 3, 4]) {
  const today = new Date();
  const todayISO = today.toISOString().split('T')[0];
  
  const tasksToMove = tasks.filter(t => {
    if (t.is_completed || !t.due_date || t.due_date < todayISO) return false;
    const taskDate = new Date(t.due_date);
    return taskDate.getDay() === fromDayIndex;
  });

  const validTargets = targetDays.filter(d => d !== fromDayIndex);
  
  const results = {
    moved: 0,
    failed: 0,
    details: []
  };

  // עדכון רשימת המשימות לאחר כל הזזה
  let updatedTasks = [...tasks];

  let targetIndex = 0;
  for (const task of tasksToMove) {
    try {
      const taskDate = new Date(task.due_date);
      const currentDay = taskDate.getDay();
      
      const targetDay = validTargets[targetIndex % validTargets.length];
      let daysToAdd = targetDay - currentDay;
      if (daysToAdd <= 0) daysToAdd += 7;
      
      const newDate = new Date(taskDate);
      newDate.setDate(newDate.getDate() + daysToAdd);
      const newDateISO = newDate.toISOString().split('T')[0];
      
      // מציאת שעה פנויה ביום החדש
      const newTime = findFreeTimeSlot(newDateISO, updatedTasks, task.estimated_duration || 60);
      
      await editTask(task.id, { dueDate: newDateISO, dueTime: newTime });
      
      // עדכון הרשימה המקומית
      updatedTasks = updatedTasks.map(t => 
        t.id === task.id ? { ...t, due_date: newDateISO, due_time: newTime } : t
      );
      
      results.moved++;
      results.details.push({
        id: task.id,
        title: task.title,
        oldDate: task.due_date,
        newDate: newDateISO,
        newTime
      });
      
      targetIndex++;
    } catch (err) {
      results.failed++;
      console.error(`Failed to move task ${task.id}:`, err);
    }
  }

  return results;
}

/**
 * שיבוץ מחדש לשעות פרודוקטיביות
 */
export async function optimizeByProductiveHours(tasks, editTask, productiveHours) {
  const today = new Date().toISOString().split('T')[0];
  
  const complexTasks = tasks.filter(t => {
    if (t.is_completed || !t.due_date || t.due_date < today) return false;
    if (!t.estimated_duration || t.estimated_duration < 45) return false;
    
    if (!t.due_time) return true;
    
    const hour = parseInt(t.due_time.split(':')[0]);
    return !productiveHours.includes(hour);
  });

  const results = {
    optimized: 0,
    failed: 0,
    details: []
  };

  let hourIndex = 0;
  for (const task of complexTasks) {
    try {
      const targetHour = productiveHours[hourIndex % productiveHours.length];
      const newTime = `${targetHour.toString().padStart(2, '0')}:00`;
      
      await editTask(task.id, { dueTime: newTime });
      results.optimized++;
      results.details.push({
        id: task.id,
        title: task.title,
        oldTime: task.due_time || 'לא נקבע',
        newTime
      });
      
      hourIndex++;
    } catch (err) {
      results.failed++;
      console.error(`Failed to optimize task ${task.id}:`, err);
    }
  }

  return results;
}

/**
 * איזון עומס בין ימים - עם שיבוץ אוטומטי
 */
export async function balanceWorkload(tasks, editTask, maxMinutesPerDay = 360) {
  const today = new Date();
  const todayISO = today.toISOString().split('T')[0];
  
  const futureTasks = tasks.filter(t => 
    !t.is_completed && 
    t.due_date >= todayISO
  );

  const tasksByDay = {};
  futureTasks.forEach(t => {
    if (!tasksByDay[t.due_date]) {
      tasksByDay[t.due_date] = [];
    }
    tasksByDay[t.due_date].push(t);
  });

  const dayLoads = {};
  Object.entries(tasksByDay).forEach(([date, dayTasks]) => {
    dayLoads[date] = dayTasks.reduce((sum, t) => sum + (t.estimated_duration || 30), 0);
  });

  const overloadedDays = Object.entries(dayLoads)
    .filter(([_, load]) => load > maxMinutesPerDay)
    .sort((a, b) => b[1] - a[1]);

  const results = {
    balanced: 0,
    failed: 0,
    details: []
  };

  let updatedTasks = [...tasks];

  for (const [overloadedDate, load] of overloadedDays) {
    const excess = load - maxMinutesPerDay;
    const dayTasks = tasksByDay[overloadedDate]
      .filter(t => t.quadrant !== 1)
      .sort((a, b) => (b.estimated_duration || 30) - (a.estimated_duration || 30));

    let movedMinutes = 0;
    for (const task of dayTasks) {
      if (movedMinutes >= excess) break;

      const taskDate = new Date(overloadedDate);
      let targetDate = null;
      let targetTime = null;

      for (let i = 1; i <= 7; i++) {
        const checkDate = new Date(taskDate);
        checkDate.setDate(checkDate.getDate() + i);
        const checkDateISO = checkDate.toISOString().split('T')[0];
        const checkDay = checkDate.getDay();
        
        if (checkDay > 4) continue;
        
        const currentLoad = dayLoads[checkDateISO] || 0;
        if (currentLoad + (task.estimated_duration || 30) <= maxMinutesPerDay) {
          targetDate = checkDateISO;
          targetTime = findFreeTimeSlot(checkDateISO, updatedTasks, task.estimated_duration || 30);
          break;
        }
      }

      if (targetDate) {
        try {
          await editTask(task.id, { dueDate: targetDate, dueTime: targetTime });
          
          updatedTasks = updatedTasks.map(t => 
            t.id === task.id ? { ...t, due_date: targetDate, due_time: targetTime } : t
          );
          
          dayLoads[overloadedDate] -= (task.estimated_duration || 30);
          dayLoads[targetDate] = (dayLoads[targetDate] || 0) + (task.estimated_duration || 30);
          
          movedMinutes += (task.estimated_duration || 30);
          results.balanced++;
          results.details.push({
            id: task.id,
            title: task.title,
            oldDate: overloadedDate,
            newDate: targetDate,
            newTime: targetTime
          });
        } catch (err) {
          results.failed++;
          console.error(`Failed to balance task ${task.id}:`, err);
        }
      }
    }
  }

  return results;
}

/**
 * הזזת דדליינים קדימה - עם שמירה על שעה
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
      
      // שמירה על השעה הקיימת או מציאת חדשה
      const newTime = task.due_time || findFreeTimeSlot(newDateISO, tasks, task.estimated_duration || 60);
      
      await editTask(task.id, { dueDate: newDateISO, dueTime: newTime });
      results.adjusted++;
      results.details.push({
        id: task.id,
        title: task.title,
        oldDate: task.due_date,
        newDate: newDateISO
      });
    } catch (err) {
      results.failed++;
      console.error(`Failed to adjust deadline for task ${task.id}:`, err);
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
    { title: 'סידור שולחן/קבצים', duration: 10, type: 'admin' },
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
        description: 'משימת מילוי לזמן מת - עשי אותה כשיש לך כמה דקות פנויות',
        quadrant: 4,
        dueDate: today,
        estimatedDuration: filler.duration,
        taskType: filler.type
      });
      results.created++;
      results.details.push(filler);
    } catch (err) {
      results.failed++;
      console.error(`Failed to create filler task:`, err);
    }
  }

  return results;
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
    name: 'הזזת משימות',
    description: 'הזז משימות מהיום הבעייתי ושבץ בזמנים פנויים',
    execute: async (context) => {
      const { tasks, editTask, params } = context;
      return rescheduleFromDay(tasks, editTask, params.dayIndex);
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
    name: 'שיבוץ לשעות זהב',
    description: 'שבץ משימות מורכבות לשעות הפרודוקטיביות',
    execute: async (context) => {
      const { tasks, editTask, params } = context;
      return optimizeByProductiveHours(tasks, editTask, params.productiveHours);
    }
  },
  'workload-unbalanced': {
    name: 'איזון עומס',
    description: 'פזר משימות באופן אחיד ושבץ בזמנים פנויים',
    execute: async (context) => {
      const { tasks, editTask } = context;
      return balanceWorkload(tasks, editTask);
    }
  },
  'workload-high': {
    name: 'הפחתת עומס',
    description: 'הזז משימות מימים עמוסים ושבץ מחדש',
    execute: async (context) => {
      const { tasks, editTask } = context;
      return balanceWorkload(tasks, editTask, 300);
    }
  }
};

export default {
  adjustFutureEstimations,
  rescheduleFromDay,
  optimizeByProductiveHours,
  balanceWorkload,
  addDeadlineBuffer,
  createFillerTasks,
  ACTION_DEFINITIONS
};

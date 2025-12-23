/**
 * מנוע יישום המלצות - מבצע פעולות על משימות בהתאם לתובנות
 */

/**
 * עדכון הערכות זמן במשימות עתידיות
 * @param {Array} tasks - כל המשימות
 * @param {Function} editTask - פונקציה לעריכת משימה
 * @param {number} adjustmentPercent - אחוז להוספה (לדוגמה: 30 = הוסף 30%)
 * @param {string|null} taskType - סוג משימה ספציפי (אופציונלי)
 */
export async function adjustFutureEstimations(tasks, editTask, adjustmentPercent, taskType = null) {
  const today = new Date().toISOString().split('T')[0];
  
  // סינון משימות עתידיות שלא הושלמו
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
 * הזזת משימות מיום מסוים לימים אחרים
 * @param {Array} tasks - כל המשימות
 * @param {Function} editTask - פונקציה לעריכת משימה
 * @param {number} fromDayIndex - יום המקור (0=ראשון, 4=חמישי)
 * @param {number[]} targetDays - ימי יעד אפשריים
 */
export async function rescheduleFromDay(tasks, editTask, fromDayIndex, targetDays = [0, 1, 2, 3, 4]) {
  const today = new Date();
  const todayISO = today.toISOString().split('T')[0];
  
  // סינון משימות עתידיות מהיום המבוקש
  const tasksToMove = tasks.filter(t => {
    if (t.is_completed || !t.due_date || t.due_date < todayISO) return false;
    const taskDate = new Date(t.due_date);
    return taskDate.getDay() === fromDayIndex;
  });

  // הסרת היום הבעייתי מהיעדים
  const validTargets = targetDays.filter(d => d !== fromDayIndex);
  
  const results = {
    moved: 0,
    failed: 0,
    details: []
  };

  let targetIndex = 0;
  for (const task of tasksToMove) {
    try {
      const taskDate = new Date(task.due_date);
      const currentDay = taskDate.getDay();
      
      // מציאת היום הקרוב ביותר מהיעדים
      const targetDay = validTargets[targetIndex % validTargets.length];
      let daysToAdd = targetDay - currentDay;
      if (daysToAdd <= 0) daysToAdd += 7; // עבור לשבוע הבא אם צריך
      
      const newDate = new Date(taskDate);
      newDate.setDate(newDate.getDate() + daysToAdd);
      const newDateISO = newDate.toISOString().split('T')[0];
      
      await editTask(task.id, { dueDate: newDateISO });
      results.moved++;
      results.details.push({
        id: task.id,
        title: task.title,
        oldDate: task.due_date,
        newDate: newDateISO
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
 * @param {Array} tasks - כל המשימות
 * @param {Function} editTask - פונקציה לעריכת משימה
 * @param {number[]} productiveHours - שעות פרודוקטיביות (לדוגמה: [9, 10, 11])
 */
export async function optimizeByProductiveHours(tasks, editTask, productiveHours) {
  const today = new Date().toISOString().split('T')[0];
  
  // משימות מורכבות (הערכה של יותר מ-45 דקות) שלא בשעות פרודוקטיביות
  const complexTasks = tasks.filter(t => {
    if (t.is_completed || !t.due_date || t.due_date < today) return false;
    if (!t.estimated_duration || t.estimated_duration < 45) return false;
    
    if (!t.due_time) return true; // אין שעה - צריך לקבוע
    
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
 * איזון עומס בין ימים
 * @param {Array} tasks - כל המשימות
 * @param {Function} editTask - פונקציה לעריכת משימה
 * @param {number} maxMinutesPerDay - מקסימום דקות עבודה ביום
 */
export async function balanceWorkload(tasks, editTask, maxMinutesPerDay = 360) {
  const today = new Date();
  const todayISO = today.toISOString().split('T')[0];
  
  // קיבוץ משימות עתידיות לפי יום
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

  // חישוב עומס לכל יום
  const dayLoads = {};
  Object.entries(tasksByDay).forEach(([date, dayTasks]) => {
    dayLoads[date] = dayTasks.reduce((sum, t) => sum + (t.estimated_duration || 30), 0);
  });

  // מציאת ימים עמוסים וימים עם מקום
  const overloadedDays = Object.entries(dayLoads)
    .filter(([_, load]) => load > maxMinutesPerDay)
    .sort((a, b) => b[1] - a[1]);

  const results = {
    balanced: 0,
    failed: 0,
    details: []
  };

  for (const [overloadedDate, load] of overloadedDays) {
    const excess = load - maxMinutesPerDay;
    const dayTasks = tasksByDay[overloadedDate]
      .filter(t => t.quadrant !== 1) // לא להזיז דחוף וחשוב
      .sort((a, b) => (b.estimated_duration || 30) - (a.estimated_duration || 30));

    let movedMinutes = 0;
    for (const task of dayTasks) {
      if (movedMinutes >= excess) break;

      // מציאת יום עם מקום
      const taskDate = new Date(overloadedDate);
      let targetDate = null;

      for (let i = 1; i <= 7; i++) {
        const checkDate = new Date(taskDate);
        checkDate.setDate(checkDate.getDate() + i);
        const checkDateISO = checkDate.toISOString().split('T')[0];
        const checkDay = checkDate.getDay();
        
        // רק ימי עבודה
        if (checkDay > 4) continue;
        
        const currentLoad = dayLoads[checkDateISO] || 0;
        if (currentLoad + (task.estimated_duration || 30) <= maxMinutesPerDay) {
          targetDate = checkDateISO;
          break;
        }
      }

      if (targetDate) {
        try {
          await editTask(task.id, { dueDate: targetDate });
          
          // עדכון העומסים
          dayLoads[overloadedDate] -= (task.estimated_duration || 30);
          dayLoads[targetDate] = (dayLoads[targetDate] || 0) + (task.estimated_duration || 30);
          
          movedMinutes += (task.estimated_duration || 30);
          results.balanced++;
          results.details.push({
            id: task.id,
            title: task.title,
            oldDate: overloadedDate,
            newDate: targetDate
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
 * הזזת דדליינים קדימה (buffer)
 * @param {Array} tasks - כל המשימות
 * @param {Function} editTask - פונקציה לעריכת משימה
 * @param {number} bufferDays - כמה ימים להקדים
 */
export async function addDeadlineBuffer(tasks, editTask, bufferDays = 1) {
  const today = new Date();
  const todayISO = today.toISOString().split('T')[0];
  
  // משימות עתידיות עם דדליין
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
      
      // לא להזיז לפני היום
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
      console.error(`Failed to adjust deadline for task ${task.id}:`, err);
    }
  }

  return results;
}

/**
 * יצירת משימות מילוי לזמן מת
 * @param {Function} addTask - פונקציה להוספת משימה
 */
export async function createFillerTasks(addTask) {
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
        description: 'משימת מילוי לזמן מת',
        quadrant: 4, // לא דחוף ולא חשוב
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
    name: 'עדכן הערכות',
    description: 'הוסף אחוז לכל ההערכות העתידיות',
    execute: async (context) => {
      const { tasks, editTask, params } = context;
      return adjustFutureEstimations(tasks, editTask, params.adjustmentPercent);
    }
  },
  'estimation-type': {
    name: 'עדכן הערכות לסוג זה',
    description: 'הוסף אחוז להערכות של סוג משימה ספציפי',
    execute: async (context) => {
      const { tasks, editTask, params } = context;
      return adjustFutureEstimations(tasks, editTask, params.adjustmentPercent, params.taskType);
    }
  },
  'deadlines-low': {
    name: 'הקדם דדליינים',
    description: 'הקדם את כל הדדליינים ביום אחד',
    execute: async (context) => {
      const { tasks, editTask } = context;
      return addDeadlineBuffer(tasks, editTask, 1);
    }
  },
  'deadlines-day': {
    name: 'הזז משימות מיום זה',
    description: 'הזז משימות מהיום הבעייתי לימים אחרים',
    execute: async (context) => {
      const { tasks, editTask, params } = context;
      return rescheduleFromDay(tasks, editTask, params.dayIndex);
    }
  },
  'idle-high': {
    name: 'צור משימות מילוי',
    description: 'צור משימות קצרות לזמן מת',
    execute: async (context) => {
      const { addTask } = context;
      return createFillerTasks(addTask);
    }
  },
  'hours-productive': {
    name: 'שבץ לשעות זהב',
    description: 'שבץ משימות מורכבות לשעות הפרודוקטיביות',
    execute: async (context) => {
      const { tasks, editTask, params } = context;
      return optimizeByProductiveHours(tasks, editTask, params.productiveHours);
    }
  },
  'workload-unbalanced': {
    name: 'אזן עומס',
    description: 'פזר משימות באופן אחיד על פני השבוע',
    execute: async (context) => {
      const { tasks, editTask } = context;
      return balanceWorkload(tasks, editTask);
    }
  },
  'workload-high': {
    name: 'הפחת עומס',
    description: 'הזז משימות מימים עמוסים מדי',
    execute: async (context) => {
      const { tasks, editTask } = context;
      return balanceWorkload(tasks, editTask, 300); // 5 שעות מקסימום
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

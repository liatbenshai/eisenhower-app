import { format, addDays, subDays } from 'date-fns';

/**
 * פונקציה להזזת משימות לא הושלמו למחר
 */

/**
 * מזיז משימות שלא הושלמו מהיום למחר
 */
export async function moveUncompletedTasksToTomorrow(updateTask, tasks) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = format(today, 'yyyy-MM-dd');
  
  const tomorrow = addDays(today, 1);
  const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');
  
  // משימות שהיו אמורות להיעשות היום ולא הושלמו
  const tasksToMove = tasks.filter(task => {
    if (task.is_completed || task.is_project || task.parent_task_id) return false;
    
    const taskDate = task.due_date || task.start_date;
    if (!taskDate) return false;
    
    // אם המשימה הייתה היום (או לפני היום) ולא הושלמה
    return taskDate <= todayStr && taskDate >= format(subDays(today, 7), 'yyyy-MM-dd');
  });
  
  // הזזת המשימות למחר
  const movedTasks = [];
  for (const task of tasksToMove) {
    try {
      await updateTask(task.id, {
        startDate: tomorrowStr,
        dueDate: tomorrowStr
      });
      movedTasks.push(task);
    } catch (err) {
      console.error(`שגיאה בהזזת משימה ${task.id}:`, err);
    }
  }
  
  return movedTasks;
}


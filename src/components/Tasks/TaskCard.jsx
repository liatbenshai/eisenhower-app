import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { getRelativeDate, formatTime } from '../../utils/dateHelpers';
import { isTaskOverdue, isTaskDueToday } from '../../utils/taskHelpers';
import { detectTaskCategory } from '../../utils/taskCategories';
import toast from 'react-hot-toast';
import TaskTimerWithInterruptions from './TaskTimerWithInterruptions';

// פונקציה לבדיקה אם שלב באיחור או היום
const isSubtaskOverdue = (subtask) => {
  if (!subtask.due_date || subtask.is_completed) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(subtask.due_date);
  return dueDate < today;
};

const isSubtaskDueToday = (subtask) => {
  if (!subtask.due_date || subtask.is_completed) return false;
  const today = new Date().toISOString().split('T')[0];
  return subtask.due_date === today;
};

/**
 * כרטיס משימה
 */
function TaskCard({ 
  task, 
  quadrantId,
  onEdit, 
  onDragStart, 
  onDragEnd 
}) {
  const { toggleComplete, removeTask, loadTasks, tasks } = useTasks();
  const [showActions, setShowActions] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // קבלת המשימה העדכנית מה-TaskContext במקום מה-prop
  const currentTask = tasks.find(t => t.id === task.id) || task;

  // סימון כהושלם
  const handleToggleComplete = async (e) => {
    e.stopPropagation();
    try {
      await toggleComplete(currentTask.id);
      toast.success(currentTask.is_completed ? 'המשימה סומנה כפעילה' : 'המשימה הושלמה!');
    } catch (err) {
      toast.error('שגיאה בעדכון המשימה');
    }
  };

  // מחיקת משימה
  const handleDelete = async (e) => {
    e.stopPropagation();
    setDeleting(true);
    try {
      await removeTask(currentTask.id);
      toast.success('המשימה נמחקה');
    } catch (err) {
      toast.error('שגיאה במחיקת המשימה');
      setDeleting(false);
    }
  };

  // בדיקת סטטוס - שימוש במשימה העדכנית
  const isOverdue = isTaskOverdue(currentTask);
  const isDueToday = isTaskDueToday(currentTask);
  const isProject = currentTask.is_project;
  const isSubtask = !!currentTask.parent_task_id; // משימה שהיא שלב של פרויקט
  const subtasks = currentTask.subtasks || [];
  const [showTimer, setShowTimer] = useState(false);
  
  // זיהוי קטגוריה - שימוש במשימה העדכנית
  const { category } = detectTaskCategory(currentTask);
  
  // חישוב התקדמות פרויקט - לפי שלבים שהושלמו
  const projectProgressByCompletion = isProject && subtasks.length > 0
    ? Math.round((subtasks.filter(st => st.is_completed).length / subtasks.length) * 100)
    : null;
  
  // חישוב התקדמות פרויקט - לפי זמן
  const projectProgressByTime = isProject && subtasks.length > 0
    ? (() => {
        const totalEstimated = subtasks.reduce((sum, st) => sum + (st.estimated_duration || 0), 0);
        const totalSpent = subtasks.reduce((sum, st) => sum + (st.time_spent || 0), 0);
        return totalEstimated > 0 ? Math.min(100, Math.round((totalSpent / totalEstimated) * 100)) : 0;
      })()
    : null;
  
  // התקדמות משולבת (ממוצע של שני המדדים)
  const projectProgress = isProject && subtasks.length > 0
    ? Math.round((projectProgressByCompletion + projectProgressByTime) / 2)
    : null;
  
  // התקדמות למשימה רגילה
  const regularTaskProgress = !isProject && !isSubtask && currentTask.estimated_duration
    ? Math.min(100, Math.round((((currentTask.time_spent || 0) / currentTask.estimated_duration) * 100)))
    : null;
  
  // שלבים קרובים (היום או באיחור)
  const upcomingSubtasks = subtasks.filter(st => 
    !st.is_completed && (isSubtaskDueToday(st) || isSubtaskOverdue(st))
  ).slice(0, 3);

  return (
    <motion.div
      layout
      draggable
      onDragStart={() => onDragStart(currentTask)}
      onDragEnd={onDragEnd}
      onClick={onEdit}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      className={`
        bg-white dark:bg-gray-800/80 
        rounded-lg p-3 
        border border-gray-200 dark:border-gray-700
        cursor-pointer
        transition-all duration-200
        hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600
        ${currentTask.is_completed ? 'opacity-60' : ''}
        ${deleting ? 'opacity-50 scale-95' : ''}
      `}
    >
      <div className="flex items-start gap-3">
        {/* כפתור סימון */}
        <button
          onClick={handleToggleComplete}
          className={`
            flex-shrink-0 w-5 h-5 mt-0.5 rounded border-2 
            transition-all duration-200
            ${currentTask.is_completed 
              ? 'bg-green-500 border-green-500 text-white' 
              : 'border-gray-300 dark:border-gray-600 hover:border-green-500'
            }
          `}
        >
          {currentTask.is_completed && (
            <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* תוכן */}
        <div className="flex-1 min-w-0">
          {/* כותרת */}
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`
              font-medium text-gray-900 dark:text-white text-sm
              ${currentTask.is_completed ? 'line-through text-gray-500' : ''}
            `}>
              {currentTask.title}
            </p>
            {/* תגית דחיפות */}
            {currentTask.priority === 'urgent' && (
              <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full">
                🔴 דחוף
              </span>
            )}
            {currentTask.priority === 'high' && (
              <span className="text-xs px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-full">
                🟡 בינוני
              </span>
            )}
            {isProject && (
              <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                פרויקט
              </span>
            )}
            {isSubtask && (
              <span className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full">
                שלב
              </span>
            )}
            <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full flex items-center gap-1">
              {category.icon} {category.name}
            </span>
          </div>

          {/* תיאור */}
          {currentTask.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
              {currentTask.description}
            </p>
          )}

          {/* כפתור טיימר לכל משימה */}
          {!currentTask.is_completed && (
            <div className="mt-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTimer(!showTimer);
                }}
                className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 flex items-center gap-1"
              >
                ⏱️ {showTimer ? 'הסתר טיימר' : 'טיימר'}
              </button>
              {currentTask.time_spent > 0 && (
                <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">
                  • {currentTask.time_spent} דקות
                </span>
              )}
            </div>
          )}
          
          {/* התקדמות למשימה רגילה */}
          {!isProject && !isSubtask && currentTask.estimated_duration && regularTaskProgress !== null && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-600 dark:text-gray-400">התקדמות</span>
                <span className="font-medium text-blue-600 dark:text-blue-400">
                  {regularTaskProgress}%
                </span>
              </div>
              <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    regularTaskProgress >= 100 
                      ? 'bg-green-500' 
                      : regularTaskProgress >= 75 
                      ? 'bg-blue-500' 
                      : regularTaskProgress >= 50 
                      ? 'bg-yellow-500' 
                      : 'bg-orange-500'
                  }`}
                  style={{ width: `${regularTaskProgress}%` }}
                />
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {currentTask.time_spent || 0} / {currentTask.estimated_duration} דקות
              </div>
            </div>
          )}
          
          {/* סטטוס פרויקט */}
          {isProject && (
            <div className="mt-2 space-y-2">
              {/* התקדמות */}
              {projectProgress !== null && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      התקדמות פרויקט
                    </span>
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                      {projectProgress}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-300 ${
                          projectProgress >= 100 
                            ? 'bg-green-500' 
                            : projectProgress >= 75 
                            ? 'bg-blue-500' 
                            : projectProgress >= 50 
                            ? 'bg-yellow-500' 
                            : 'bg-orange-500'
                        }`}
                        style={{ width: `${projectProgress}%` }}
                      />
                    </div>
                  </div>
                  {projectProgressByTime !== null && projectProgressByCompletion !== null && (
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>זמן: {projectProgressByTime}%</span>
                      <span>•</span>
                      <span>שלבים: {projectProgressByCompletion}%</span>
                    </div>
                  )}
                </div>
              )}
              
              {/* שלבים קרובים */}
              {upcomingSubtasks.length > 0 && (
                <div className="space-y-1">
                  {upcomingSubtasks.map((st, idx) => (
                    <div
                      key={idx}
                      className={`
                        text-xs px-2 py-1 rounded
                        ${isSubtaskOverdue(st) 
                          ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' 
                          : 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400'}
                      `}
                    >
                      <span className="font-medium">{st.title}</span>
                      {st.due_date && (
                        <span className="mr-1"> • {getRelativeDate(st.due_date)}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {/* מספר שלבים */}
              {subtasks.length > 0 && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {subtasks.filter(st => st.is_completed).length} / {subtasks.length} שלבים הושלמו
                </div>
              )}
            </div>
          )}

          {/* תאריך יעד */}
          {currentTask.due_date && (
            <div className={`
              flex items-center gap-1 mt-2 text-xs
              ${isOverdue ? 'text-red-600 dark:text-red-400' : 
                isDueToday ? 'text-orange-600 dark:text-orange-400' : 
                'text-gray-500 dark:text-gray-400'}
            `}>
              <span>📅</span>
              <span>{getRelativeDate(currentTask.due_date)}</span>
              {currentTask.due_time && (
                <span>• {formatTime(currentTask.due_time)}</span>
              )}
              {isOverdue && <span className="font-medium">(באיחור)</span>}
            </div>
          )}
        </div>

        {/* כפתורי פעולה */}
        <div className={`
          flex gap-1 transition-opacity duration-200
          ${showActions ? 'opacity-100' : 'opacity-0 md:opacity-0'}
        `}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
            title="ערוך"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={handleDelete}
            className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-500 hover:text-red-600"
            title="מחק"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* טיימר - עם תמיכה בהפרעות */}
      {showTimer && !currentTask.is_completed && (
        <div 
          onClick={(e) => e.stopPropagation()} 
          className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700"
        >
          <TaskTimerWithInterruptions
            task={currentTask}
            onUpdate={async () => {
              // עדכון המשימה ברשימה בלי לפתוח את הטופס
              await loadTasks();
            }}
            onComplete={async () => {
              // סימון המשימה כהושלמה
              await handleToggleComplete({ stopPropagation: () => {} });
            }}
          />
        </div>
      )}
    </motion.div>
  );
}

export default TaskCard;


import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { getRelativeDate, formatTime } from '../../utils/dateHelpers';
import { isTaskOverdue, isTaskDueToday } from '../../utils/taskHelpers';
import toast from 'react-hot-toast';

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
  const { toggleComplete, removeTask } = useTasks();
  const [showActions, setShowActions] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // סימון כהושלם
  const handleToggleComplete = async (e) => {
    e.stopPropagation();
    try {
      await toggleComplete(task.id);
      toast.success(task.is_completed ? 'המשימה סומנה כפעילה' : 'המשימה הושלמה!');
    } catch (err) {
      toast.error('שגיאה בעדכון המשימה');
    }
  };

  // מחיקת משימה
  const handleDelete = async (e) => {
    e.stopPropagation();
    setDeleting(true);
    try {
      await removeTask(task.id);
      toast.success('המשימה נמחקה');
    } catch (err) {
      toast.error('שגיאה במחיקת המשימה');
      setDeleting(false);
    }
  };

  // בדיקת סטטוס
  const isOverdue = isTaskOverdue(task);
  const isDueToday = isTaskDueToday(task);

  return (
    <motion.div
      layout
      draggable
      onDragStart={() => onDragStart(task)}
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
        ${task.is_completed ? 'opacity-60' : ''}
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
            ${task.is_completed 
              ? 'bg-green-500 border-green-500 text-white' 
              : 'border-gray-300 dark:border-gray-600 hover:border-green-500'
            }
          `}
        >
          {task.is_completed && (
            <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* תוכן */}
        <div className="flex-1 min-w-0">
          {/* כותרת */}
          <p className={`
            font-medium text-gray-900 dark:text-white text-sm
            ${task.is_completed ? 'line-through text-gray-500' : ''}
          `}>
            {task.title}
          </p>

          {/* תיאור */}
          {task.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
              {task.description}
            </p>
          )}

          {/* תאריך יעד */}
          {task.due_date && (
            <div className={`
              flex items-center gap-1 mt-2 text-xs
              ${isOverdue ? 'text-red-600 dark:text-red-400' : 
                isDueToday ? 'text-orange-600 dark:text-orange-400' : 
                'text-gray-500 dark:text-gray-400'}
            `}>
              <span>📅</span>
              <span>{getRelativeDate(task.due_date)}</span>
              {task.due_time && (
                <span>• {formatTime(task.due_time)}</span>
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
    </motion.div>
  );
}

export default TaskCard;


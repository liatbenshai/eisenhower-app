import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import toast from 'react-hot-toast';
import TaskTimer from '../Tasks/TaskTimer';
import { TASK_TYPES } from './DailyView';

/**
 * כרטיס משימה לתצוגה יומית
 */
function DailyTaskCard({ task, onEdit, onUpdate }) {
  const { toggleComplete, removeTask, tasks } = useTasks();
  const [showTimer, setShowTimer] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // קבלת המשימה העדכנית מה-context
  const currentTask = tasks.find(t => t.id === task.id) || task;
  
  // סוג המשימה
  const taskType = TASK_TYPES[currentTask.task_type] || TASK_TYPES.other;

  // סימון כהושלם
  const handleToggleComplete = async (e) => {
    if (e) e.stopPropagation();
    try {
      await toggleComplete(currentTask.id);
      toast.success(currentTask.is_completed ? 'המשימה הוחזרה לפעילה' : '✅ המשימה הושלמה!');
      if (onUpdate) onUpdate();
    } catch (err) {
      toast.error('שגיאה בעדכון');
    }
  };

  // מחיקה
  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!confirm('למחוק את המשימה?')) return;
    setDeleting(true);
    try {
      await removeTask(currentTask.id);
      toast.success('המשימה נמחקה');
    } catch (err) {
      toast.error('שגיאה במחיקה');
      setDeleting(false);
    }
  };

  // חישוב התקדמות
  const estimated = currentTask.estimated_duration || 0;
  const spent = currentTask.time_spent || 0;
  const progress = estimated > 0 ? Math.min(100, Math.round((spent / estimated) * 100)) : 0;
  const isOverTime = spent > estimated && estimated > 0;

  // פורמט דקות
  const formatMinutes = (minutes) => {
    if (minutes < 60) return `${minutes} דק'`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}:${mins.toString().padStart(2, '0')}` : `${hours} שעות`;
  };

  return (
    <motion.div
      layout
      className={`
        card p-4 transition-all duration-200
        ${currentTask.is_completed ? 'opacity-60' : ''}
        ${deleting ? 'opacity-50 scale-95' : ''}
        ${isOverTime ? 'border-l-4 border-l-red-500' : ''}
      `}
    >
      <div className="flex items-start gap-3">
        {/* כפתור סימון */}
        <button
          onClick={handleToggleComplete}
          className={`
            flex-shrink-0 w-6 h-6 rounded-full border-2 mt-0.5
            transition-all duration-200 flex items-center justify-center
            ${currentTask.is_completed 
              ? 'bg-green-500 border-green-500 text-white' 
              : 'border-gray-300 dark:border-gray-600 hover:border-green-500'
            }
          `}
        >
          {currentTask.is_completed && (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* תוכן */}
        <div className="flex-1 min-w-0">
          {/* שורה ראשונה: כותרת וסוג */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg">{taskType.icon}</span>
            <h3 className={`
              font-medium text-gray-900 dark:text-white
              ${currentTask.is_completed ? 'line-through text-gray-500' : ''}
            `}>
              {currentTask.title}
            </h3>
            {currentTask.due_time && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {currentTask.due_time}
              </span>
            )}
          </div>

          {/* שורה שנייה: זמנים */}
          {!currentTask.is_completed && (
            <div className="mt-2 space-y-2">
              {/* סרגל התקדמות */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      isOverTime ? 'bg-red-500' :
                      progress >= 80 ? 'bg-orange-500' :
                      progress >= 50 ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(100, progress)}%` }}
                  />
                </div>
                <span className={`text-sm font-medium ${
                  isOverTime ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'
                }`}>
                  {formatMinutes(spent)} / {formatMinutes(estimated)}
                </span>
              </div>

              {/* אזהרה אם עבר את הזמן */}
              {isOverTime && (
                <div className="text-sm text-red-600 dark:text-red-400">
                  ⚠️ עברת את הזמן המתוכנן ב-{formatMinutes(spent - estimated)}
                </div>
              )}
            </div>
          )}

          {/* תיאור */}
          {currentTask.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {currentTask.description}
            </p>
          )}

          {/* סיכום למשימה שהושלמה */}
          {currentTask.is_completed && estimated > 0 && (
            <div className="mt-2 text-sm">
              {spent > estimated ? (
                <span className="text-orange-600 dark:text-orange-400">
                  הערכת {formatMinutes(estimated)} → לקח {formatMinutes(spent)} (פי {(spent/estimated).toFixed(1)})
                </span>
              ) : (
                <span className="text-green-600 dark:text-green-400">
                  הערכת {formatMinutes(estimated)} → לקח {formatMinutes(spent)} 👍
                </span>
              )}
            </div>
          )}
        </div>

        {/* כפתורי פעולה */}
        <div className="flex items-center gap-1">
          {/* כפתור טיימר */}
          {!currentTask.is_completed && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowTimer(!showTimer);
              }}
              className={`
                p-2 rounded-lg transition-colors
                ${showTimer 
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500'
                }
              `}
              title={showTimer ? 'הסתר טיימר' : 'הצג טיימר'}
            >
              ⏱️
            </button>
          )}
          
          {/* כפתור עריכה */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
            title="ערוך"
          >
            ✏️
          </button>
          
          {/* כפתור מחיקה */}
          <button
            onClick={handleDelete}
            className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-500 hover:text-red-600"
            title="מחק"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* טיימר */}
      {showTimer && !currentTask.is_completed && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <TaskTimer
            task={currentTask}
            onUpdate={onUpdate}
            onComplete={handleToggleComplete}
          />
        </div>
      )}
    </motion.div>
  );
}

export default DailyTaskCard;

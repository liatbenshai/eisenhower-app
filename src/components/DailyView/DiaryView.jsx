import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import TaskTimer from '../Tasks/TaskTimer';
import toast from 'react-hot-toast';

/**
 * סוגי משימות
 */
const TASK_TYPES = {
  transcription: { id: 'transcription', name: 'תמלול', icon: '🎙️', bgColor: 'bg-purple-500', borderColor: '#a855f7' },
  proofreading: { id: 'proofreading', name: 'הגהה', icon: '📝', bgColor: 'bg-blue-500', borderColor: '#3b82f6' },
  email: { id: 'email', name: 'מיילים', icon: '📧', bgColor: 'bg-yellow-500', borderColor: '#eab308' },
  course: { id: 'course', name: 'קורס', icon: '📚', bgColor: 'bg-green-500', borderColor: '#22c55e' },
  client_communication: { id: 'client_communication', name: 'לקוחות', icon: '💬', bgColor: 'bg-pink-500', borderColor: '#ec4899' },
  unexpected: { id: 'unexpected', name: 'בלת"מ', icon: '⚡', bgColor: 'bg-orange-500', borderColor: '#f97316' },
  other: { id: 'other', name: 'אחר', icon: '📋', bgColor: 'bg-gray-500', borderColor: '#6b7280' }
};

/**
 * שעות עבודה
 */
const WORK_HOURS = { start: 8, end: 17 };

/**
 * פורמט דקות
 */
function formatMinutes(minutes) {
  if (!minutes) return '0 דק\'';
  if (minutes < 60) return `${minutes} דק'`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}:${mins.toString().padStart(2, '0')}` : `${hours}ש'`;
}

/**
 * המרת שעה לדקות
 */
function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + (m || 0);
}

/**
 * תצוגת יומן יומי
 */
function DiaryView({ date, tasks, onEditTask, onAddTask, onUpdate }) {
  const { toggleComplete, removeTask } = useTasks();
  const [expandedTask, setExpandedTask] = useState(null);
  const [showCompleted, setShowCompleted] = useState(false);

  // סינון משימות ליום זה
  const dayTasks = useMemo(() => {
    const dateISO = date instanceof Date ? date.toISOString().split('T')[0] : date;
    return tasks.filter(t => t.due_date === dateISO);
  }, [tasks, date]);

  // משימות פעילות (ממוינות לפי שעה)
  const activeTasks = useMemo(() => {
    return dayTasks
      .filter(t => !t.is_completed)
      .sort((a, b) => {
        if (!a.due_time && !b.due_time) return 0;
        if (!a.due_time) return 1;
        if (!b.due_time) return -1;
        return timeToMinutes(a.due_time) - timeToMinutes(b.due_time);
      });
  }, [dayTasks]);

  // משימות שהושלמו
  const completedTasks = useMemo(() => {
    return dayTasks.filter(t => t.is_completed);
  }, [dayTasks]);

  // חישוב סטטיסטיקות
  const stats = useMemo(() => {
    const totalPlanned = activeTasks.reduce((sum, t) => sum + (t.estimated_duration || 30), 0);
    const totalCompleted = completedTasks.reduce((sum, t) => sum + (t.time_spent || t.estimated_duration || 30), 0);
    return { totalPlanned, totalCompleted, active: activeTasks.length, done: completedTasks.length };
  }, [activeTasks, completedTasks]);

  // יצירת שורות שעות
  const hourSlots = useMemo(() => {
    const slots = [];
    for (let hour = WORK_HOURS.start; hour <= WORK_HOURS.end; hour++) {
      slots.push(hour);
    }
    return slots;
  }, []);

  // מיפוי משימות לשעות
  const tasksByHour = useMemo(() => {
    const map = {};
    activeTasks.forEach(task => {
      if (task.due_time) {
        const hour = parseInt(task.due_time.split(':')[0]);
        if (!map[hour]) map[hour] = [];
        map[hour].push(task);
      }
    });
    return map;
  }, [activeTasks]);

  // משימות ללא שעה
  const unscheduledTasks = useMemo(() => {
    return activeTasks.filter(t => !t.due_time);
  }, [activeTasks]);

  // סימון משימה כהושלמה
  const handleComplete = async (task) => {
    try {
      await toggleComplete(task.id);
      toast.success('✅ המשימה הושלמה!');
      if (onUpdate) onUpdate();
    } catch {
      toast.error('שגיאה');
    }
  };

  // מחיקת משימה
  const handleDelete = async (task) => {
    if (!confirm('למחוק?')) return;
    try {
      await removeTask(task.id);
      toast.success('נמחק');
    } catch {
      toast.error('שגיאה');
    }
  };

  // רכיב משימה בודדת
  const TaskItem = ({ task, compact = false }) => {
    const taskType = TASK_TYPES[task.task_type] || TASK_TYPES.other;
    const isExpanded = expandedTask === task.id;
    const duration = task.estimated_duration || 30;
    const spent = task.time_spent || 0;
    const progress = Math.min(100, Math.round((spent / duration) * 100));
    const endTime = task.due_time ? 
      (() => {
        const start = timeToMinutes(task.due_time);
        const end = start + duration;
        const h = Math.floor(end / 60);
        const m = end % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      })() : null;

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`
          group relative bg-white dark:bg-gray-800 rounded-lg border-r-4 
          shadow-sm hover:shadow-md transition-all cursor-pointer
          ${compact ? 'p-2' : 'p-3'}
        `}
        style={{ borderRightColor: taskType.borderColor }}
        onClick={() => setExpandedTask(isExpanded ? null : task.id)}
      >
        <div className="flex items-center gap-3">
          {/* כפתור סימון */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleComplete(task);
            }}
            className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600 
                       hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 
                       flex-shrink-0 transition-all"
          />

          {/* אייקון סוג */}
          <span className={`text-lg flex-shrink-0 ${taskType.bgColor} w-8 h-8 rounded-lg 
                           flex items-center justify-center text-white`}>
            {taskType.icon}
          </span>

          {/* תוכן */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 dark:text-white truncate">
                {task.title}
              </span>
              {task.priority === 'urgent' && (
                <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 rounded">
                  דחוף
                </span>
              )}
            </div>
            
            {/* סרגל התקדמות קטן */}
            {spent > 0 && (
              <div className="mt-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden w-24">
                <div 
                  className={`h-full ${progress >= 100 ? 'bg-red-500' : 'bg-green-500'}`}
                  style={{ width: `${Math.min(100, progress)}%` }}
                />
              </div>
            )}
          </div>

          {/* זמנים */}
          <div className="text-left flex-shrink-0">
            {task.due_time && (
              <div className="text-sm font-mono font-medium text-gray-900 dark:text-white">
                {task.due_time}
                {endTime && (
                  <span className="text-gray-400 dark:text-gray-500"> - {endTime}</span>
                )}
              </div>
            )}
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {formatMinutes(duration)}
            </div>
          </div>

          {/* כפתורי פעולה */}
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditTask(task);
              }}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              title="ערוך"
            >
              ✏️
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(task);
              }}
              className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
              title="מחק"
            >
              🗑️
            </button>
          </div>
        </div>

        {/* טיימר מורחב */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-3 mt-3 border-t border-gray-200 dark:border-gray-700">
                <TaskTimer
                  task={task}
                  onUpdate={onUpdate}
                  onComplete={() => handleComplete(task)}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  return (
    <div className="diary-view">
      {/* כותרת עם סטטיסטיקות */}
      <div className="mb-4 p-4 bg-gradient-to-l from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.active}</div>
              <div className="text-xs text-gray-500">משימות</div>
            </div>
            <div className="w-px h-10 bg-blue-200 dark:bg-blue-700"></div>
            <div className="text-center">
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{formatMinutes(stats.totalPlanned)}</div>
              <div className="text-xs text-gray-500">זמן מתוכנן</div>
            </div>
            {stats.done > 0 && (
              <>
                <div className="w-px h-10 bg-blue-200 dark:bg-blue-700"></div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.done}</div>
                  <div className="text-xs text-gray-500">הושלמו ✓</div>
                </div>
              </>
            )}
          </div>

          {/* כפתור הוספה */}
          <button
            onClick={onAddTask}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <span>+</span>
            <span>משימה</span>
          </button>
        </div>
      </div>

      {/* תצוגת יומן עם שעות */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* משימות ללא שעה */}
        {unscheduledTasks.length > 0 && (
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
            <div className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1">
              <span>📌</span>
              <span>ללא שעה קבועה ({unscheduledTasks.length})</span>
            </div>
            <div className="space-y-2">
              {unscheduledTasks.map(task => (
                <TaskItem key={task.id} task={task} compact />
              ))}
            </div>
          </div>
        )}

        {/* שעות היום */}
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {hourSlots.map(hour => {
            const hourTasks = tasksByHour[hour] || [];
            const now = new Date();
            const currentHour = now.getHours();
            const isCurrentHour = hour === currentHour && 
              date instanceof Date && date.toDateString() === now.toDateString();
            const isPast = hour < currentHour && 
              date instanceof Date && date.toDateString() === now.toDateString();

            return (
              <div 
                key={hour} 
                className={`
                  flex min-h-[60px] transition-colors
                  ${isCurrentHour ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
                  ${isPast ? 'bg-gray-50 dark:bg-gray-900/50' : ''}
                `}
              >
                {/* עמודת שעה */}
                <div className={`
                  w-16 flex-shrink-0 p-2 text-left border-l border-gray-200 dark:border-gray-700
                  ${isCurrentHour ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-gray-50 dark:bg-gray-900/30'}
                `}>
                  <span className={`
                    text-sm font-mono font-bold
                    ${isCurrentHour ? 'text-blue-600 dark:text-blue-400' : 
                      isPast ? 'text-gray-400 dark:text-gray-600' : 'text-gray-700 dark:text-gray-300'}
                  `}>
                    {hour.toString().padStart(2, '0')}:00
                  </span>
                  {isCurrentHour && (
                    <div className="text-xs text-blue-500 mt-0.5">עכשיו</div>
                  )}
                </div>

                {/* עמודת משימות */}
                <div className="flex-1 p-2">
                  {hourTasks.length > 0 ? (
                    <div className="space-y-2">
                      {hourTasks.map(task => (
                        <TaskItem key={task.id} task={task} />
                      ))}
                    </div>
                  ) : (
                    <div 
                      className="h-full min-h-[44px] border-2 border-dashed border-gray-200 dark:border-gray-700 
                                 rounded-lg flex items-center justify-center text-gray-400 dark:text-gray-600
                                 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/10
                                 cursor-pointer transition-all"
                      onClick={() => onAddTask(hour)}
                    >
                      <span className="text-sm">+ הוסף משימה ל-{hour}:00</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* משימות שהושלמו - מכווץ */}
      {completedTasks.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            <span className={`transform transition-transform ${showCompleted ? 'rotate-90' : ''}`}>▶</span>
            <span>✅ הושלמו היום ({completedTasks.length})</span>
            <span className="text-xs text-gray-400">
              {formatMinutes(stats.totalCompleted)}
            </span>
          </button>

          <AnimatePresence>
            {showCompleted && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-2 space-y-2 opacity-60">
                  {completedTasks.map(task => {
                    const taskType = TASK_TYPES[task.task_type] || TASK_TYPES.other;
                    return (
                      <div 
                        key={task.id}
                        className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                      >
                        <span className="text-green-500">✓</span>
                        <span>{taskType.icon}</span>
                        <span className="line-through text-gray-500 dark:text-gray-400 flex-1">
                          {task.title}
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatMinutes(task.time_spent || task.estimated_duration)}
                        </span>
                        <button
                          onClick={() => toggleComplete(task.id)}
                          className="text-xs text-blue-500 hover:text-blue-700"
                        >
                          החזר
                        </button>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

export default DiaryView;

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import TaskTimer from '../Tasks/TaskTimer';
import toast from 'react-hot-toast';

/**
 * סוגי משימות
 */
const TASK_TYPES = {
  transcription: { id: 'transcription', name: 'תמלול', icon: '🎙️', gradient: 'from-purple-500 to-indigo-600', bg: 'bg-purple-500' },
  proofreading: { id: 'proofreading', name: 'הגהה', icon: '📝', gradient: 'from-blue-500 to-cyan-600', bg: 'bg-blue-500' },
  email: { id: 'email', name: 'מיילים', icon: '📧', gradient: 'from-amber-500 to-yellow-600', bg: 'bg-amber-500' },
  course: { id: 'course', name: 'קורס', icon: '📚', gradient: 'from-emerald-500 to-teal-600', bg: 'bg-emerald-500' },
  client_communication: { id: 'client_communication', name: 'לקוחות', icon: '💬', gradient: 'from-pink-500 to-rose-600', bg: 'bg-pink-500' },
  unexpected: { id: 'unexpected', name: 'בלת"מ', icon: '⚡', gradient: 'from-orange-500 to-red-600', bg: 'bg-orange-500' },
  other: { id: 'other', name: 'אחר', icon: '📋', gradient: 'from-gray-500 to-slate-600', bg: 'bg-gray-500' }
};

const WORK_HOURS = { start: 8, end: 17 };

/**
 * פורמט דקות
 */
function formatMinutes(minutes) {
  if (!minutes) return '0 דק\'';
  if (minutes < 60) return `${minutes} דק'`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}:${mins.toString().padStart(2, '0')}` : `${hours} שעות`;
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
 * האם זה היום?
 */
function isToday(date) {
  const today = new Date();
  const d = date instanceof Date ? date : new Date(date);
  return d.toDateString() === today.toDateString();
}

/**
 * תצוגת יומן יומי - עיצוב חדש ונקי
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
  const completedTasks = useMemo(() => dayTasks.filter(t => t.is_completed), [dayTasks]);

  // משימות ללא שעה
  const unscheduledTasks = useMemo(() => activeTasks.filter(t => !t.due_time), [activeTasks]);

  // משימות עם שעה
  const scheduledTasks = useMemo(() => activeTasks.filter(t => t.due_time), [activeTasks]);

  // סטטיסטיקות
  const stats = useMemo(() => {
    const totalPlanned = activeTasks.reduce((sum, t) => sum + (t.estimated_duration || 30), 0);
    const totalCompleted = completedTasks.reduce((sum, t) => sum + (t.time_spent || t.estimated_duration || 30), 0);
    return { totalPlanned, totalCompleted, active: activeTasks.length, done: completedTasks.length };
  }, [activeTasks, completedTasks]);

  // השעה הנוכחית
  const currentHour = new Date().getHours();
  const currentMinute = new Date().getMinutes();
  const now = currentHour * 60 + currentMinute;
  const isTodayView = isToday(date);

  // סימון משימה
  const handleComplete = useCallback(async (task, e) => {
    if (e) e.stopPropagation();
    try {
      await toggleComplete(task.id);
      toast.success('✅ הושלם!', { duration: 1500 });
      if (onUpdate) onUpdate();
    } catch {
      toast.error('שגיאה');
    }
  }, [toggleComplete, onUpdate]);

  // מחיקת משימה
  const handleDelete = useCallback(async (task, e) => {
    if (e) e.stopPropagation();
    if (!confirm('למחוק את המשימה?')) return;
    try {
      await removeTask(task.id);
      toast.success('נמחק');
    } catch {
      toast.error('שגיאה');
    }
  }, [removeTask]);

  // רכיב משימה בודדת
  const TaskCard = ({ task }) => {
    const taskType = TASK_TYPES[task.task_type] || TASK_TYPES.other;
    const isExpanded = expandedTask === task.id;
    const duration = task.estimated_duration || 30;
    const spent = task.time_spent || 0;
    const progress = Math.min(100, Math.round((spent / duration) * 100));
    
    // חישוב האם המשימה עכשיו
    const taskStart = task.due_time ? timeToMinutes(task.due_time) : null;
    const taskEnd = taskStart ? taskStart + duration : null;
    const isNow = isTodayView && taskStart && now >= taskStart && now < taskEnd;
    const isPast = isTodayView && taskEnd && now >= taskEnd;
    
    // שעת סיום
    const endTime = task.due_time ? 
      (() => {
        const end = timeToMinutes(task.due_time) + duration;
        const h = Math.floor(end / 60);
        const m = end % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      })() : null;

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`
          relative bg-white dark:bg-gray-800 rounded-xl overflow-hidden
          border-r-4 transition-all duration-200 cursor-pointer
          ${isNow 
            ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-100 dark:shadow-blue-900/30' 
            : isPast 
              ? 'opacity-50' 
              : 'shadow-sm hover:shadow-md'
          }
        `}
        style={{ borderRightColor: isNow ? '#3b82f6' : undefined }}
        onClick={() => setExpandedTask(isExpanded ? null : task.id)}
      >
        <div className="p-4">
          {/* שורה עליונה */}
          <div className="flex items-start gap-3">
            {/* כפתור סימון */}
            <button
              onClick={(e) => handleComplete(task, e)}
              className="mt-1 w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600 
                         hover:border-green-500 hover:bg-green-500 flex-shrink-0 transition-all
                         flex items-center justify-center group"
            >
              <span className="text-white text-xs opacity-0 group-hover:opacity-100">✓</span>
            </button>
            
            {/* אייקון */}
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white text-lg flex-shrink-0 ${taskType.bg}`}>
              {taskType.icon}
            </div>
            
            {/* תוכן */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className={`font-medium text-gray-900 dark:text-white truncate ${isPast ? 'line-through' : ''}`}>
                  {task.title}
                </h3>
                {isNow && (
                  <span className="px-2 py-0.5 bg-blue-500 text-white text-xs font-bold rounded-full animate-pulse flex-shrink-0">
                    עכשיו
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400" dir="ltr">
                {task.due_time && (
                  <span className="flex items-center gap-1 font-mono">
                    {task.due_time.substring(0, 5)} → {endTime}
                  </span>
                )}
                <span className="text-gray-400">•</span>
                <span>{formatMinutes(duration)}</span>
                {spent > 0 && (
                  <span className="text-blue-600 dark:text-blue-400 font-medium">
                    (עבדת {formatMinutes(spent)})
                  </span>
                )}
              </div>
              
              {/* פס התקדמות */}
              {progress > 0 && (
                <div className="mt-2 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${progress >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </div>
            
            {/* כפתורי פעולות */}
            <div className="flex gap-1 flex-shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); onEditTask(task); }}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                ✏️
              </button>
              <button
                onClick={(e) => handleDelete(task, e)}
                className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
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
                <div className="pt-4 mt-4 border-t border-gray-100 dark:border-gray-700">
                  <TaskTimer
                    task={task}
                    onUpdate={onUpdate}
                    onComplete={() => handleComplete(task)}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-4">
      {/* כרטיס סטטיסטיקות */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-5 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold">{stats.active}</div>
              <div className="text-sm opacity-80">משימות</div>
            </div>
            <div className="w-px h-10 bg-white/30" />
            <div className="text-center">
              <div className="text-3xl font-bold">{formatMinutes(stats.totalPlanned).replace(" דק'", "d").replace(" שעות", "h")}</div>
              <div className="text-sm opacity-80">זמן</div>
            </div>
            {stats.done > 0 && (
              <>
                <div className="w-px h-10 bg-white/30" />
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-300">{stats.done} ✓</div>
                  <div className="text-sm opacity-80">הושלמו</div>
                </div>
              </>
            )}
          </div>

          <button
            onClick={onAddTask}
            className="px-5 py-2.5 bg-white/20 hover:bg-white/30 rounded-xl font-medium transition-all flex items-center gap-2"
          >
            <span className="text-xl">+</span>
            משימה
          </button>
        </div>
      </div>

      {/* משימות ללא שעה */}
      {unscheduledTasks.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2 mb-3 text-amber-800 dark:text-amber-200">
            <span className="text-xl">📌</span>
            <span className="font-medium">ללא שעה ({unscheduledTasks.length})</span>
          </div>
          <div className="space-y-2">
            {unscheduledTasks.map(task => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </div>
      )}

      {/* ציר זמן */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
        {Array.from({ length: WORK_HOURS.end - WORK_HOURS.start + 1 }, (_, i) => WORK_HOURS.start + i).map(hour => {
          const hourTasks = scheduledTasks.filter(t => {
            const taskHour = parseInt(t.due_time?.split(':')[0] || 0);
            return taskHour === hour;
          });
          
          const isCurrentHour = isTodayView && hour === currentHour;
          const isPastHour = isTodayView && hour < currentHour;

          // חישוב הפסקות בין משימות באותה שעה
          const tasksWithBreaks = [];
          hourTasks.forEach((task, idx) => {
            if (idx > 0) {
              const prevTask = hourTasks[idx - 1];
              const prevEnd = timeToMinutes(prevTask.due_time) + (prevTask.estimated_duration || 30);
              const currentStart = timeToMinutes(task.due_time);
              const breakMinutes = currentStart - prevEnd;
              
              if (breakMinutes > 0) {
                tasksWithBreaks.push({
                  isBreak: true,
                  minutes: breakMinutes,
                  startTime: prevEnd,
                  key: `break-${prevTask.id}-${task.id}`
                });
              }
            }
            tasksWithBreaks.push({ isBreak: false, task, key: task.id });
          });

          return (
            <div 
              key={hour} 
              className={`
                flex border-b border-gray-100 dark:border-gray-700 last:border-b-0
                ${isCurrentHour ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
                ${isPastHour ? 'bg-gray-50/50 dark:bg-gray-900/30' : ''}
              `}
            >
              {/* שעה */}
              <div className={`
                w-16 flex-shrink-0 py-3 px-2 text-center border-l border-gray-100 dark:border-gray-700
                ${isCurrentHour ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-gray-50 dark:bg-gray-900/50'}
              `}>
                <div className={`text-sm font-mono font-bold ${
                  isCurrentHour ? 'text-blue-600 dark:text-blue-400' : 
                  isPastHour ? 'text-gray-400' : 'text-gray-600 dark:text-gray-400'
                }`}>
                  {hour}:00
                </div>
                {isCurrentHour && (
                  <div className="text-[10px] text-blue-500 mt-0.5">עכשיו</div>
                )}
              </div>

              {/* משימות */}
              <div className="flex-1 p-2 min-h-[60px]">
                {tasksWithBreaks.length > 0 ? (
                  <div className="space-y-2">
                    {tasksWithBreaks.map(item => 
                      item.isBreak ? (
                        <div 
                          key={item.key}
                          className="flex items-center gap-2 py-1 px-3 text-xs text-gray-400"
                        >
                          <div className="flex-1 border-t border-dashed border-gray-300 dark:border-gray-600" />
                          <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                            ☕ הפסקה {item.minutes} דק'
                          </span>
                          <div className="flex-1 border-t border-dashed border-gray-300 dark:border-gray-600" />
                        </div>
                      ) : (
                        <TaskCard key={item.key} task={item.task} />
                      )
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => onAddTask(hour)}
                    className="w-full h-full min-h-[48px] border-2 border-dashed border-gray-200 dark:border-gray-700 
                               rounded-xl text-gray-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50/50
                               dark:hover:bg-blue-900/20 transition-all text-sm"
                  >
                    + הוסף
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* הושלמו */}
      {completedTasks.length > 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800 overflow-hidden">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="w-full p-3 flex items-center justify-between hover:bg-green-100 dark:hover:bg-green-900/30"
          >
            <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
              <span>✅</span>
              <span className="font-medium">הושלמו ({completedTasks.length})</span>
              <span className="text-sm text-green-600">{formatMinutes(stats.totalCompleted)}</span>
            </div>
            <span className={`transform transition-transform ${showCompleted ? 'rotate-90' : ''}`}>▶</span>
          </button>

          <AnimatePresence>
            {showCompleted && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                exit={{ height: 0 }}
                className="overflow-hidden"
              >
                <div className="p-3 pt-0 space-y-1">
                  {completedTasks.map(task => {
                    const taskType = TASK_TYPES[task.task_type] || TASK_TYPES.other;
                    return (
                      <div key={task.id} className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded-lg opacity-60">
                        <span className="text-green-500">✓</span>
                        <span>{taskType.icon}</span>
                        <span className="flex-1 line-through text-gray-500 text-sm">{task.title}</span>
                        <span className="text-xs text-gray-400">{formatMinutes(task.time_spent || task.estimated_duration)}</span>
                        <button onClick={() => toggleComplete(task.id)} className="text-xs text-blue-500 hover:underline">החזר</button>
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

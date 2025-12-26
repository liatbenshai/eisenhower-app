import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { TASK_TYPES } from '../../config/taskTypes';
import { formatDuration } from '../../config/workSchedule';
import SimpleTaskForm from './SimpleTaskForm';
import TaskTimerWithInterruptions from '../Tasks/TaskTimerWithInterruptions';
import Modal from '../UI/Modal';
import Button from '../UI/Button';
import toast from 'react-hot-toast';
import { supabase } from '../../services/supabase';

/**
 * דשבורד ממוקד - תצוגה נקייה למה שחשוב עכשיו
 */
function FocusedDashboard() {
  const { tasks, loading, toggleComplete, loadTasks } = useTasks();
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const notifiedTasks = useRef(new Set());
  const audioRef = useRef(null);

  // יצירת אלמנט אודיו להתראות
  useEffect(() => {
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleEs+m9LLqWs4JFCl3OsAAADv7+/v7+/v7+/v7+/v7+/v');
  }, []);

  // בקשת הרשאה להתראות
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      setNotificationsEnabled(true);
    }
  }, []);

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationsEnabled(permission === 'granted');
      if (permission === 'granted') {
        toast.success('🔔 התראות הופעלו!');
      }
    }
  };

  // משימות להיום
  const todayTasks = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return tasks
      .filter(t => {
        // משימות להיום או ללא תאריך
        const isToday = t.due_date === today || !t.due_date;
        // סינון משימות שהושלמו
        if (!showCompleted && t.is_completed) return false;
        return isToday;
      })
      .sort((a, b) => {
        // משימות שהושלמו בסוף
        if (a.is_completed !== b.is_completed) {
          return a.is_completed ? 1 : -1;
        }
        // לפי שעה
        if (a.due_time && b.due_time) {
          return a.due_time.localeCompare(b.due_time);
        }
        if (a.due_time) return -1;
        if (b.due_time) return 1;
        // לפי עדיפות
        const priorityOrder = { urgent: 0, high: 1, normal: 2 };
        return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
      });
  }, [tasks, showCompleted]);

  // המשימה הנוכחית (הבאה בתור)
  const currentTask = useMemo(() => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    // מציאת משימה פעילה או הבאה בתור
    const activeTasks = todayTasks.filter(t => !t.is_completed);
    
    // אם יש משימה עם טיימר פעיל
    if (activeTaskId) {
      const activeTask = activeTasks.find(t => t.id === activeTaskId);
      if (activeTask) return activeTask;
    }
    
    // מציאת המשימה הבאה לפי שעה
    for (const task of activeTasks) {
      if (task.due_time) {
        const [h, m] = task.due_time.split(':').map(Number);
        const taskMinutes = h * 60 + (m || 0);
        const taskEnd = taskMinutes + (task.estimated_duration || 30);
        
        // משימה שהגיע זמנה או עוברת עכשיו
        if (currentMinutes >= taskMinutes - 5 && currentMinutes <= taskEnd) {
          return task;
        }
      }
    }
    
    // אחרת - המשימה הראשונה ברשימה
    return activeTasks[0] || null;
  }, [todayTasks, activeTaskId]);

  // משימות קרובות (ב-15 הדקות הבאות)
  const upcomingTasks = useMemo(() => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    return todayTasks.filter(t => {
      if (t.is_completed || !t.due_time) return false;
      if (t.id === currentTask?.id) return false;
      
      const [h, m] = t.due_time.split(':').map(Number);
      const taskMinutes = h * 60 + (m || 0);
      const diff = taskMinutes - currentMinutes;
      
      return diff > 0 && diff <= 30;
    });
  }, [todayTasks, currentTask]);

  // בדיקת התראות
  useEffect(() => {
    const checkNotifications = () => {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      
      todayTasks.forEach(task => {
        if (task.is_completed || !task.due_time) return;
        
        const [h, m] = task.due_time.split(':').map(Number);
        const taskMinutes = h * 60 + (m || 0);
        const diff = taskMinutes - currentMinutes;
        
        // התראה 5 דקות לפני
        const warningKey = `warning-${task.id}`;
        if (diff > 0 && diff <= 5 && !notifiedTasks.current.has(warningKey)) {
          notifiedTasks.current.add(warningKey);
          
          // צליל
          if (soundEnabled && audioRef.current) {
            audioRef.current.play().catch(() => {});
          }
          
          // התראת מערכת
          if (notificationsEnabled) {
            new Notification('⏰ משימה מתחילה בקרוב', {
              body: `${task.title} - בעוד ${diff} דקות`,
              icon: '/icon.svg',
              tag: `task-warning-${task.id}`,
              requireInteraction: true
            });
          }
          
          // טוסט
          toast(`⏰ ${task.title} מתחילה בעוד ${diff} דקות`, {
            duration: 10000,
            icon: '🔔'
          });
        }
        
        // התראה כשהגיע הזמן (או עברו עד 2 דקות)
        const startKey = `start-${task.id}`;
        if (diff <= 0 && diff >= -2 && !notifiedTasks.current.has(startKey)) {
          notifiedTasks.current.add(startKey);
          
          if (soundEnabled && audioRef.current) {
            audioRef.current.play().catch(() => {});
          }
          
          // התראת מערכת
          if (notificationsEnabled) {
            new Notification('🚀 הגיע הזמן!', {
              body: task.title,
              icon: '/icon.svg',
              tag: `task-start-${task.id}`,
              requireInteraction: true
            });
          }
          
          toast.success(`🚀 הגיע הזמן: ${task.title}`, {
            duration: 15000
          });
        }
      });
    };
    
    // בדיקה כל 15 שניות
    checkNotifications();
    const interval = setInterval(checkNotifications, 15000);
    
    return () => clearInterval(interval);
  }, [todayTasks, notificationsEnabled, soundEnabled]);

  // סטטיסטיקות יום
  const dayStats = useMemo(() => {
    const completed = todayTasks.filter(t => t.is_completed).length;
    const total = todayTasks.length;
    const totalMinutes = todayTasks
      .filter(t => !t.is_completed)
      .reduce((sum, t) => sum + (t.estimated_duration || 30), 0);
    
    return {
      completed,
      total,
      pending: total - completed,
      remainingTime: totalMinutes,
      progress: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  }, [todayTasks]);

  // השלמת משימה
  const handleComplete = async (task) => {
    try {
      await toggleComplete(task.id);
      if (!task.is_completed) {
        toast.success('✅ כל הכבוד!');
      }
    } catch (err) {
      toast.error('שגיאה בעדכון');
    }
  };

  // פתיחת טופס
  const handleAddTask = () => {
    setEditingTask(null);
    setShowTaskForm(true);
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
    setShowTaskForm(true);
  };

  const handleCloseForm = () => {
    setShowTaskForm(false);
    setEditingTask(null);
    loadTasks();
  };

  // התחלת עבודה על משימה
  const handleStartTask = (task) => {
    setActiveTaskId(task.id);
  };

  // פורמט שעה
  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    return `${h}:${m || '00'}`;
  };

  // בדיקה אם משימה באיחור
  const isOverdue = (task) => {
    if (!task.due_time || task.is_completed) return false;
    const now = new Date();
    const [h, m] = task.due_time.split(':').map(Number);
    const taskMinutes = h * 60 + (m || 0);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    return currentMinutes > taskMinutes + (task.estimated_duration || 30);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="focused-dashboard p-4 max-w-2xl mx-auto">
      {/* כותרת עם תאריך */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 text-center"
      >
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {new Date().toLocaleDateString('he-IL', { 
            weekday: 'long', 
            day: 'numeric', 
            month: 'long' 
          })}
        </h1>
        
        {/* סרגל התקדמות */}
        <div className="mt-3 flex items-center justify-center gap-4">
          <div className="flex-1 max-w-xs">
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${dayStats.progress}%` }}
                className="h-full bg-green-500 rounded-full"
              />
            </div>
          </div>
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {dayStats.completed}/{dayStats.total} ({dayStats.progress}%)
          </span>
        </div>
      </motion.div>

      {/* התראות קרובות */}
      {upcomingTasks.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl"
        >
          <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
            <span>⏰</span>
            <span className="text-sm font-medium">בקרוב:</span>
            {upcomingTasks.map(t => (
              <span key={t.id} className="text-sm">
                {t.title} ({formatTime(t.due_time)})
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {/* המשימה הנוכחית - בולטת */}
      {currentTask && !currentTask.is_completed && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6"
        >
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-2">
            <span className="animate-pulse">🎯</span>
            עכשיו
          </div>
          
          <CurrentTaskCard
            task={currentTask}
            onComplete={() => handleComplete(currentTask)}
            onEdit={() => handleEditTask(currentTask)}
            isActive={activeTaskId === currentTask.id}
            onStart={() => handleStartTask(currentTask)}
            onUpdate={loadTasks}
          />
        </motion.div>
      )}

      {/* הגדרות התראות */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {!notificationsEnabled && 'Notification' in window && (
            <button
              onClick={requestNotificationPermission}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              🔔 הפעל התראות
            </button>
          )}
          
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`text-sm flex items-center gap-1 ${
              soundEnabled ? 'text-green-600' : 'text-gray-400'
            }`}
          >
            {soundEnabled ? '🔊' : '🔇'} צליל
          </button>
        </div>
        
        <button
          onClick={() => setShowCompleted(!showCompleted)}
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700"
        >
          {showCompleted ? '🙈 הסתר הושלמו' : '👁️ הצג הושלמו'}
        </button>
      </div>

      {/* כפתור הוספה */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mb-4"
      >
        <Button onClick={handleAddTask} className="w-full py-3">
          + משימה חדשה
        </Button>
      </motion.div>

      {/* רשימת המשימות */}
      <div className="space-y-2">
        <AnimatePresence>
          {todayTasks
            .filter(t => t.id !== currentTask?.id || t.is_completed)
            .map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onComplete={() => handleComplete(task)}
                onEdit={() => handleEditTask(task)}
                isOverdue={isOverdue(task)}
              />
            ))}
        </AnimatePresence>
      </div>

      {/* הודעה כשאין משימות */}
      {todayTasks.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <span className="text-5xl mb-4 block">🎉</span>
          <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">
            אין משימות להיום
          </h3>
          <p className="text-sm text-gray-500 mt-2">
            הוסיפי משימה חדשה או תהני מהיום!
          </p>
        </motion.div>
      )}

      {/* סיכום תחתון */}
      {dayStats.pending > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl text-center"
        >
          <p className="text-sm text-gray-600 dark:text-gray-400">
            נשארו <span className="font-bold text-gray-900 dark:text-white">{dayStats.pending}</span> משימות
            {dayStats.remainingTime > 0 && (
              <> • עוד <span className="font-bold text-gray-900 dark:text-white">{formatDuration(dayStats.remainingTime)}</span> עבודה</>
            )}
          </p>
        </motion.div>
      )}

      {/* מודל טופס */}
      <Modal
        isOpen={showTaskForm}
        onClose={handleCloseForm}
        title={editingTask ? 'עריכת משימה' : 'משימה חדשה'}
      >
        <SimpleTaskForm
          task={editingTask}
          onClose={handleCloseForm}
          taskTypes={TASK_TYPES}
          defaultDate={new Date().toISOString().split('T')[0]}
        />
      </Modal>
    </div>
  );
}

/**
 * כרטיס המשימה הנוכחית - בולט
 */
function CurrentTaskCard({ task, onComplete, onEdit, isActive, onStart, onUpdate }) {
  const taskType = TASK_TYPES[task.task_type] || TASK_TYPES.other;
  
  return (
    <div className={`
      p-5 rounded-2xl border-2 shadow-lg
      ${task.priority === 'urgent' 
        ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700' 
        : 'bg-white dark:bg-gray-800 border-blue-300 dark:border-blue-700'}
    `}>
      <div className="flex items-start gap-4">
        {/* אייקון */}
        <div className="text-3xl">{taskType.icon}</div>
        
        {/* תוכן */}
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
            {task.title}
          </h3>
          
          <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400 mb-3">
            {task.due_time && (
              <span className="flex items-center gap-1">
                🕐 {task.due_time}
              </span>
            )}
            {task.estimated_duration && (
              <span className="flex items-center gap-1">
                ⏱️ {formatDuration(task.estimated_duration)}
              </span>
            )}
            <span 
              className="px-2 py-0.5 rounded-full text-xs"
              style={{ backgroundColor: taskType.bgColor || '#f3f4f6' }}
            >
              {taskType.name}
            </span>
          </div>
          
          {/* טיימר */}
          {isActive ? (
            <div className="mt-3">
              <TaskTimerWithInterruptions
                task={task}
                onComplete={onComplete}
                onUpdate={onUpdate}
              />
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={onStart}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                ▶️ התחל לעבוד
              </button>
              <button
                onClick={onComplete}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
              >
                ✅ סיימתי
              </button>
              <button
                onClick={onEdit}
                className="px-3 py-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                ✏️
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * שורת משימה פשוטה
 */
function TaskRow({ task, onComplete, onEdit, isOverdue }) {
  const taskType = TASK_TYPES[task.task_type] || TASK_TYPES.other;
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      className={`
        p-3 rounded-xl border flex items-center gap-3 transition-all
        ${task.is_completed 
          ? 'bg-gray-50 dark:bg-gray-800/30 border-gray-200 dark:border-gray-700 opacity-60' 
          : isOverdue
            ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300'}
      `}
    >
      {/* כפתור השלמה */}
      <button
        onClick={onComplete}
        className={`
          w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all
          ${task.is_completed 
            ? 'bg-green-500 border-green-500 text-white' 
            : 'border-gray-300 dark:border-gray-600 hover:border-green-400'}
        `}
      >
        {task.is_completed && '✓'}
      </button>
      
      {/* אייקון סוג */}
      <span className="text-lg">{taskType.icon}</span>
      
      {/* תוכן */}
      <div className="flex-1 min-w-0">
        <div className={`font-medium truncate ${
          task.is_completed 
            ? 'text-gray-400 line-through' 
            : 'text-gray-900 dark:text-white'
        }`}>
          {task.title}
        </div>
        
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {task.due_time && (
            <span className={isOverdue && !task.is_completed ? 'text-red-500 font-medium' : ''}>
              {task.due_time}
            </span>
          )}
          {task.estimated_duration && (
            <span>{formatDuration(task.estimated_duration)}</span>
          )}
        </div>
      </div>
      
      {/* תגית עדיפות */}
      {task.priority === 'urgent' && !task.is_completed && (
        <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs rounded-full">
          דחוף
        </span>
      )}
      
      {/* כפתור עריכה */}
      <button
        onClick={onEdit}
        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
      >
        ✏️
      </button>
    </motion.div>
  );
}

export default FocusedDashboard;

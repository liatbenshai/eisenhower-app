import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { TASK_TYPES } from '../DailyView/DailyView';
import toast from 'react-hot-toast';

/**
 * שעות העבודה
 */
const WORK_HOURS = {
  start: 8,
  end: 16
};

/**
 * התראות חכמות
 */
function SmartNotifications({ onTaskClick }) {
  const { tasks } = useTasks();
  const [dismissed, setDismissed] = useState(new Set());
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // בקשת הרשאה להתראות
  useEffect(() => {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        setNotificationsEnabled(true);
      }
    }
  }, []);

  const requestPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationsEnabled(permission === 'granted');
      if (permission === 'granted') {
        toast.success('התראות הופעלו!');
      }
    }
  };

  // חישוב התראות
  const notifications = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentHour = now.getHours();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const alerts = [];

    tasks.forEach(task => {
      if (task.is_completed) return;
      if (dismissed.has(task.id)) return;

      const taskType = TASK_TYPES[task.task_type] || TASK_TYPES.other;

      // משימה שמתחילה בקרוב (תוך 15 דקות)
      if (task.due_date === today && task.due_time) {
        const [hour, min] = task.due_time.split(':').map(Number);
        const taskMinutes = hour * 60 + (min || 0);
        const diff = taskMinutes - currentMinutes;

        if (diff > 0 && diff <= 15) {
          alerts.push({
            id: `upcoming-${task.id}`,
            taskId: task.id,
            type: 'upcoming',
            priority: 1,
            icon: '⏰',
            title: 'משימה מתחילה בקרוב',
            message: `${taskType.icon} ${task.title} - בעוד ${diff} דקות`,
            task,
            color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
          });
        }

        // משימה שהגיע זמנה (איחור)
        if (diff < 0 && diff > -60) {
          alerts.push({
            id: `overdue-${task.id}`,
            taskId: task.id,
            type: 'overdue',
            priority: 0,
            icon: '🔴',
            title: 'משימה באיחור',
            message: `${taskType.icon} ${task.title} - היה אמור להתחיל לפני ${Math.abs(diff)} דקות`,
            task,
            color: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          });
        }
      }

      // משימה ללא תאריך
      if (!task.due_date && !task.due_time) {
        alerts.push({
          id: `unscheduled-${task.id}`,
          taskId: task.id,
          type: 'unscheduled',
          priority: 3,
          icon: '📌',
          title: 'משימה לא משובצת',
          message: `${taskType.icon} ${task.title}`,
          task,
          color: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
        });
      }
    });

    // בדיקת זמן פנוי - אם יש הרבה זמן פנוי ויש משימות לא משובצות
    const todayTasks = tasks.filter(t => t.due_date === today && !t.is_completed);
    const scheduledMinutes = todayTasks.reduce((sum, t) => sum + (t.estimated_duration || 30), 0);
    const totalWorkMinutes = (WORK_HOURS.end - WORK_HOURS.start) * 60;
    const freeMinutes = totalWorkMinutes - scheduledMinutes;
    const unscheduledCount = tasks.filter(t => !t.is_completed && !t.due_date).length;

    if (freeMinutes > 120 && unscheduledCount > 0 && currentHour >= WORK_HOURS.start && currentHour < WORK_HOURS.end) {
      alerts.push({
        id: 'free-time',
        type: 'suggestion',
        priority: 4,
        icon: '💡',
        title: 'יש לך זמן פנוי',
        message: `יש לך ${Math.floor(freeMinutes / 60)} שעות פנויות ו-${unscheduledCount} משימות לא משובצות`,
        color: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
      });
    }

    // התראה על סוף יום העבודה
    const endOfDayMinutes = WORK_HOURS.end * 60;
    const minutesToEnd = endOfDayMinutes - currentMinutes;
    const pendingTodayTasks = todayTasks.filter(t => !t.is_completed).length;

    if (minutesToEnd > 0 && minutesToEnd <= 60 && pendingTodayTasks > 0) {
      alerts.push({
        id: 'end-of-day',
        type: 'warning',
        priority: 2,
        icon: '🌅',
        title: 'יום העבודה מסתיים בקרוב',
        message: `נשארו ${minutesToEnd} דקות ו-${pendingTodayTasks} משימות פתוחות`,
        color: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
      });
    }

    // מיון לפי עדיפות
    return alerts.sort((a, b) => a.priority - b.priority);
  }, [tasks, dismissed]);

  // סגירת התראה
  const dismissNotification = (id, taskId) => {
    if (taskId) {
      setDismissed(prev => new Set([...prev, taskId]));
    } else {
      setDismissed(prev => new Set([...prev, id]));
    }
  };

  // שליחת התראת מערכת
  const sendSystemNotification = (title, body) => {
    if (notificationsEnabled && document.hidden) {
      new Notification(title, {
        body,
        icon: '/icon.svg',
        tag: 'task-reminder'
      });
    }
  };

  // אפקט לשליחת התראות מערכת
  useEffect(() => {
    const upcomingAlerts = notifications.filter(n => n.type === 'upcoming');
    upcomingAlerts.forEach(alert => {
      sendSystemNotification(alert.title, alert.message);
    });
  }, [notifications, notificationsEnabled]);

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 mb-4">
      {/* כותרת */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <span>🔔</span>
          התראות ({notifications.length})
        </h3>
        
        {!notificationsEnabled && 'Notification' in window && (
          <button
            onClick={requestPermission}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            הפעל התראות מערכת
          </button>
        )}
      </div>

      {/* רשימת התראות */}
      <AnimatePresence>
        {notifications.slice(0, 5).map((notification) => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className={`
              p-3 rounded-lg border flex items-start gap-3
              ${notification.color}
            `}
          >
            <span className="text-xl">{notification.icon}</span>
            
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 dark:text-white text-sm">
                {notification.title}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
                {notification.message}
              </div>
            </div>

            <div className="flex items-center gap-1">
              {notification.task && onTaskClick && (
                <button
                  onClick={() => onTaskClick(notification.task)}
                  className="p-1.5 rounded hover:bg-white/50 dark:hover:bg-black/20 text-gray-500 hover:text-gray-700"
                  title="פתח משימה"
                >
                  ✏️
                </button>
              )}
              <button
                onClick={() => dismissNotification(notification.id, notification.taskId)}
                className="p-1.5 rounded hover:bg-white/50 dark:hover:bg-black/20 text-gray-400 hover:text-gray-600"
                title="סגור"
              >
                ✕
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {notifications.length > 5 && (
        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
          +{notifications.length - 5} התראות נוספות
        </div>
      )}
    </div>
  );
}

export default SmartNotifications;

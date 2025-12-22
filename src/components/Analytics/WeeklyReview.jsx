import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../hooks/useAuth';
import { TASK_TYPES } from '../DailyView/DailyView';
import { getAllTaskTypeLearning } from '../../services/supabase';
import { useEffect } from 'react';

/**
 * ימות השבוע
 */
const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

/**
 * פורמט דקות
 */
function formatMinutes(minutes) {
  if (minutes < 60) return `${Math.round(minutes)} דק'`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (mins === 0) return `${hours} שעות`;
  return `${hours}:${mins.toString().padStart(2, '0')}`;
}

/**
 * סקירה שבועית
 */
function WeeklyReview({ onClose }) {
  const { tasks } = useTasks();
  const { user } = useAuth();
  const [learningData, setLearningData] = useState([]);

  // טעינת נתוני למידה
  useEffect(() => {
    if (user?.id) {
      getAllTaskTypeLearning(user.id)
        .then(data => setLearningData(data || []))
        .catch(err => console.error('שגיאה בטעינת נתוני למידה:', err));
    }
  }, [user?.id]);

  // חישוב תאריכי השבוע
  const weekDates = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek);
    
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
  }, []);

  // סטטיסטיקות השבוע
  const weekStats = useMemo(() => {
    const weekTasks = tasks.filter(t => weekDates.includes(t.due_date));
    
    const completed = weekTasks.filter(t => t.is_completed);
    const pending = weekTasks.filter(t => !t.is_completed);
    
    // זמן עבודה לפי ימים
    const timeByDay = {};
    DAY_NAMES.forEach((name, index) => {
      timeByDay[index] = 0;
    });
    
    completed.forEach(task => {
      const date = new Date(task.due_date);
      const day = date.getDay();
      timeByDay[day] += task.time_spent || task.estimated_duration || 30;
    });

    // היום הכי פרודוקטיבי
    let mostProductiveDay = 0;
    let maxTime = 0;
    Object.entries(timeByDay).forEach(([day, time]) => {
      if (time > maxTime) {
        maxTime = time;
        mostProductiveDay = parseInt(day);
      }
    });

    // זמן לפי סוג משימה
    const timeByType = {};
    weekTasks.forEach(task => {
      const type = task.task_type || 'other';
      if (!timeByType[type]) {
        timeByType[type] = { estimated: 0, actual: 0, count: 0 };
      }
      timeByType[type].estimated += task.estimated_duration || 30;
      timeByType[type].actual += task.time_spent || task.estimated_duration || 30;
      timeByType[type].count++;
    });

    // חישוב דיוק הערכות
    let totalEstimated = 0;
    let totalActual = 0;
    completed.forEach(task => {
      if (task.time_spent && task.estimated_duration) {
        totalEstimated += task.estimated_duration;
        totalActual += task.time_spent;
      }
    });
    const accuracyPercent = totalEstimated > 0 
      ? Math.round((1 - Math.abs(totalActual - totalEstimated) / totalEstimated) * 100)
      : 0;

    // משימות שנדחו
    const delayed = weekTasks.filter(t => t.was_delayed);

    return {
      totalTasks: weekTasks.length,
      completedCount: completed.length,
      pendingCount: pending.length,
      completionRate: weekTasks.length > 0 ? Math.round((completed.length / weekTasks.length) * 100) : 0,
      totalWorkMinutes: Object.values(timeByDay).reduce((a, b) => a + b, 0),
      timeByDay,
      mostProductiveDay,
      timeByType,
      accuracyPercent,
      delayedCount: delayed.length
    };
  }, [tasks, weekDates]);

  // תובנות אוטומטיות
  const insights = useMemo(() => {
    const list = [];

    // יום פרודוקטיבי
    if (weekStats.mostProductiveDay >= 0 && weekStats.timeByDay[weekStats.mostProductiveDay] > 0) {
      list.push({
        icon: '📅',
        text: `יום ${DAY_NAMES[weekStats.mostProductiveDay]} היה הכי פרודוקטיבי`,
        type: 'positive'
      });
    }

    // דיוק הערכות
    if (weekStats.accuracyPercent > 0) {
      if (weekStats.accuracyPercent >= 80) {
        list.push({
          icon: '🎯',
          text: `דיוק ההערכות שלך מצוין! ${weekStats.accuracyPercent}%`,
          type: 'positive'
        });
      } else if (weekStats.accuracyPercent < 60) {
        list.push({
          icon: '⏰',
          text: `ההערכות היו לא מדויקות (${weekStats.accuracyPercent}%) - נסי להוסיף בופר`,
          type: 'warning'
        });
      }
    }

    // משימות שנדחו
    if (weekStats.delayedCount > 3) {
      list.push({
        icon: '🔄',
        text: `${weekStats.delayedCount} משימות נדחו השבוע - אולי ללוח צפוף מדי?`,
        type: 'warning'
      });
    }

    // שיעור השלמה
    if (weekStats.completionRate >= 90) {
      list.push({
        icon: '🏆',
        text: 'שיעור השלמה מעולה! המשיכי ככה',
        type: 'positive'
      });
    } else if (weekStats.completionRate < 50) {
      list.push({
        icon: '💡',
        text: 'שיעור השלמה נמוך - אולי לקחת פחות משימות?',
        type: 'warning'
      });
    }

    // למידה לפי סוג
    learningData.forEach(learning => {
      if (learning.total_tasks >= 5) {
        const taskType = TASK_TYPES[learning.task_type];
        if (learning.average_ratio > 1.2) {
          list.push({
            icon: taskType?.icon || '📋',
            text: `${taskType?.name || learning.task_type} לוקח ${Math.round((learning.average_ratio - 1) * 100)}% יותר מההערכה`,
            type: 'info'
          });
        }
      }
    });

    return list;
  }, [weekStats, learningData]);

  // מקסימום לגרף
  const maxDayTime = Math.max(...Object.values(weekStats.timeByDay), 60);

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto">
      {/* כותרת */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">📊 סיכום השבוע</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {new Date(weekDates[0]).toLocaleDateString('he-IL')} - {new Date(weekDates[6]).toLocaleDateString('he-IL')}
        </p>
      </div>

      {/* סטטיסטיקות ראשיות */}
      <div className="grid grid-cols-3 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center"
        >
          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
            {weekStats.completedCount}
          </div>
          <div className="text-xs text-blue-700 dark:text-blue-300">הושלמו</div>
          <div className="text-xs text-gray-500 mt-1">מתוך {weekStats.totalTasks}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 text-center"
        >
          <div className="text-3xl font-bold text-green-600 dark:text-green-400">
            {formatMinutes(weekStats.totalWorkMinutes).replace(' שעות', 'h').replace(" דק'", 'm')}
          </div>
          <div className="text-xs text-green-700 dark:text-green-300">שעות עבודה</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3 text-center"
        >
          <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
            {weekStats.accuracyPercent}%
          </div>
          <div className="text-xs text-purple-700 dark:text-purple-300">דיוק הערכות</div>
        </motion.div>
      </div>

      {/* גרף ימים */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700"
      >
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          📅 שעות עבודה לפי יום
        </h3>
        <div className="flex items-end justify-between gap-2 h-32">
          {[0, 1, 2, 3, 4].map(day => {
            const time = weekStats.timeByDay[day];
            const height = time > 0 ? (time / maxDayTime) * 100 : 5;
            const isMax = day === weekStats.mostProductiveDay && time > 0;
            
            return (
              <div key={day} className="flex-1 flex flex-col items-center">
                <div 
                  className={`
                    w-full rounded-t transition-all
                    ${isMax ? 'bg-green-500' : 'bg-blue-400 dark:bg-blue-600'}
                  `}
                  style={{ height: `${height}%` }}
                />
                <div className="mt-2 text-xs text-gray-500">{DAY_NAMES[day].slice(0, 1)}</div>
                <div className="text-xs font-medium">
                  {time > 0 ? formatMinutes(time).replace(" דק'", "").replace(" שעות", "h") : '-'}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* פילוח לפי סוג */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700"
      >
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          📊 לפי סוג משימה
        </h3>
        <div className="space-y-2">
          {Object.entries(weekStats.timeByType)
            .sort((a, b) => b[1].actual - a[1].actual)
            .slice(0, 5)
            .map(([type, data]) => {
              const taskType = TASK_TYPES[type] || TASK_TYPES.other;
              const pct = weekStats.totalWorkMinutes > 0 
                ? Math.round((data.actual / weekStats.totalWorkMinutes) * 100) 
                : 0;
              
              return (
                <div key={type} className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded ${taskType.color}`}>
                    {taskType.icon}
                  </span>
                  <span className="flex-1 text-sm">{taskType.name}</span>
                  <span className="text-sm font-medium">{formatMinutes(data.actual)}</span>
                  <span className="text-xs text-gray-500 w-10 text-left">{pct}%</span>
                </div>
              );
            })}
        </div>
      </motion.div>

      {/* תובנות */}
      {insights.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4 border border-yellow-200 dark:border-yellow-800"
        >
          <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-3 flex items-center gap-2">
            <span>💡</span> תובנות
          </h3>
          <div className="space-y-2">
            {insights.map((insight, index) => (
              <div 
                key={index}
                className={`
                  flex items-center gap-2 text-sm p-2 rounded
                  ${insight.type === 'positive' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' : ''}
                  ${insight.type === 'warning' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200' : ''}
                  ${insight.type === 'info' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200' : ''}
                `}
              >
                <span>{insight.icon}</span>
                <span>{insight.text}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* כפתור סגירה */}
      <button
        onClick={onClose}
        className="w-full py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
      >
        סגור
      </button>
    </div>
  );
}

export default WeeklyReview;

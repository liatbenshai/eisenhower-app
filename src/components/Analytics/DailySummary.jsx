import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TASK_TYPES } from '../../config/taskTypes';

/**
 * סיכום יומי אוטומטי
 * מציג בסוף יום עבודה סיכום של מה הושלם, מה נדחה, ותובנות
 */
function DailySummary({ tasks, date, onClose, onMoveTasks }) {
  const [showDetails, setShowDetails] = useState(false);

  const dateStr = date instanceof Date ? date.toISOString().split('T')[0] : date;
  
  // ניתוח המשימות של היום
  const summary = useMemo(() => {
    const dayTasks = tasks.filter(t => t.due_date === dateStr);
    const completed = dayTasks.filter(t => t.is_completed);
    const incomplete = dayTasks.filter(t => !t.is_completed);
    
    // זמן שהושקע
    const totalTimeSpent = completed.reduce((sum, t) => sum + (t.time_spent || 0), 0);
    const totalEstimated = completed.reduce((sum, t) => sum + (t.estimated_duration || 30), 0);
    
    // דיוק הערכות
    const accuracy = totalEstimated > 0 ? Math.round((totalEstimated / totalTimeSpent) * 100) : 100;
    
    // ניתוח לפי סוג משימה
    const byType = {};
    completed.forEach(t => {
      const type = t.task_type || 'other';
      if (!byType[type]) {
        byType[type] = { estimated: 0, actual: 0, count: 0 };
      }
      byType[type].estimated += t.estimated_duration || 30;
      byType[type].actual += t.time_spent || t.estimated_duration || 30;
      byType[type].count++;
    });

    // מציאת הסוג עם הפער הגדול ביותר
    let biggestGap = null;
    let maxGapPercent = 0;
    Object.entries(byType).forEach(([type, data]) => {
      if (data.actual > 0 && data.estimated > 0) {
        const gapPercent = Math.abs((data.actual - data.estimated) / data.estimated * 100);
        if (gapPercent > maxGapPercent && gapPercent > 20) {
          maxGapPercent = gapPercent;
          biggestGap = {
            type,
            estimated: data.estimated,
            actual: data.actual,
            percent: Math.round(gapPercent),
            isOver: data.actual > data.estimated
          };
        }
      }
    });

    return {
      completed,
      incomplete,
      totalTimeSpent,
      totalEstimated,
      accuracy,
      byType,
      biggestGap
    };
  }, [tasks, dateStr]);

  // פורמט זמן
  const formatTime = (minutes) => {
    if (!minutes) return '0 דק\'';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} דק'`;
    if (mins === 0) return `${hours} שעות`;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  };

  // העברת משימות למחר
  const handleMoveTomorrow = () => {
    if (onMoveTasks && summary.incomplete.length > 0) {
      const tomorrow = new Date(date);
      tomorrow.setDate(tomorrow.getDate() + 1);
      onMoveTasks(summary.incomplete, tomorrow.toISOString().split('T')[0]);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden max-w-lg mx-auto"
    >
      {/* כותרת */}
      <div className="bg-gradient-to-l from-blue-500 to-indigo-600 p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">📊 סיכום היום</h2>
            <p className="text-blue-100 mt-1">
              {new Date(dateStr).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      {/* סטטיסטיקות ראשיות */}
      <div className="p-6">
        <div className="grid grid-cols-3 gap-4 mb-6">
          {/* הושלמו */}
          <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              {summary.completed.length}
            </div>
            <div className="text-sm text-green-700 dark:text-green-300 mt-1">הושלמו ✓</div>
            <div className="text-xs text-green-600 dark:text-green-400 mt-1">
              {formatTime(summary.totalTimeSpent)}
            </div>
          </div>

          {/* נדחו */}
          <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl">
            <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
              {summary.incomplete.length}
            </div>
            <div className="text-sm text-orange-700 dark:text-orange-300 mt-1">נדחו</div>
          </div>

          {/* דיוק הערכות */}
          <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
            <div className={`text-3xl font-bold ${
              summary.accuracy >= 80 ? 'text-green-600' : 
              summary.accuracy >= 60 ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {summary.accuracy}%
            </div>
            <div className="text-sm text-blue-700 dark:text-blue-300 mt-1">דיוק הערכות</div>
          </div>
        </div>

        {/* תובנה עיקרית */}
        {summary.biggestGap && (
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl mb-4 border border-amber-200 dark:border-amber-700">
            <div className="flex items-start gap-3">
              <span className="text-2xl">💡</span>
              <div>
                <h4 className="font-bold text-amber-800 dark:text-amber-200">תובנה</h4>
                <p className="text-amber-700 dark:text-amber-300 text-sm mt-1">
                  {TASK_TYPES[summary.biggestGap.type]?.icon} <strong>{TASK_TYPES[summary.biggestGap.type]?.name || summary.biggestGap.type}</strong>
                  {' '}
                  {summary.biggestGap.isOver ? 'לקחו' : 'לקחו'} 
                  {' '}
                  <strong>{summary.biggestGap.percent}% {summary.biggestGap.isOver ? 'יותר' : 'פחות'}</strong>
                  {' '}
                  מהמתוכנן
                  {' '}
                  ({formatTime(summary.biggestGap.estimated)} → {formatTime(summary.biggestGap.actual)})
                </p>
              </div>
            </div>
          </div>
        )}

        {/* פירוט לפי סוג */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
        >
          <span className="font-medium text-gray-700 dark:text-gray-300">פירוט לפי סוג משימה</span>
          <span className={`transform transition-transform ${showDetails ? 'rotate-180' : ''}`}>▼</span>
        </button>

        <AnimatePresence>
          {showDetails && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 space-y-2">
                {Object.entries(summary.byType).map(([type, data]) => {
                  const taskType = TASK_TYPES[type] || TASK_TYPES.other;
                  const diff = data.actual - data.estimated;
                  const diffPercent = data.estimated > 0 ? Math.round((diff / data.estimated) * 100) : 0;
                  
                  return (
                    <div key={type} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
                      <div className="flex items-center gap-2">
                        <span className={`w-8 h-8 ${taskType.bg} rounded-lg flex items-center justify-center text-white`}>
                          {taskType.icon}
                        </span>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{taskType.name}</div>
                          <div className="text-xs text-gray-500">{data.count} משימות</div>
                        </div>
                      </div>
                      <div className="text-left">
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {formatTime(data.estimated)} → {formatTime(data.actual)}
                        </div>
                        {diff !== 0 && (
                          <div className={`text-xs font-medium ${diff > 0 ? 'text-red-500' : 'text-green-500'}`}>
                            {diff > 0 ? '+' : ''}{diffPercent}%
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* משימות שלא הושלמו */}
        {summary.incomplete.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h4 className="font-bold text-gray-900 dark:text-white mb-3">
              ⏳ משימות שלא הושלמו ({summary.incomplete.length})
            </h4>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {summary.incomplete.map(task => {
                const taskType = TASK_TYPES[task.task_type] || TASK_TYPES.other;
                return (
                  <div key={task.id} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded">
                    <span>{taskType.icon}</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{task.title}</span>
                  </div>
                );
              })}
            </div>
            <button
              onClick={handleMoveTomorrow}
              className="mt-3 w-full py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
            >
              📅 העבר הכל למחר
            </button>
          </div>
        )}
      </div>

      {/* כפתור סגירה */}
      <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onClose}
          className="w-full py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
        >
          סגור
        </button>
      </div>
    </motion.div>
  );
}

export default DailySummary;

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TASK_TYPES } from '../../config/taskTypes';

/**
 * כרטיס סיכום יומי מפורט
 */
function DailySummaryCard({ tasks, stats, date }) {
  // ניתוח לפי סוג משימה
  const tasksByType = useMemo(() => {
    const byType = {};
    tasks.forEach(task => {
      const type = task.task_type || 'other';
      if (!byType[type]) {
        byType[type] = {
          type,
          total: 0,
          completed: 0,
          timeSpent: 0,
          estimated: 0
        };
      }
      byType[type].total++;
      if (task.is_completed) {
        byType[type].completed++;
        byType[type].timeSpent += task.time_spent || 0;
      }
      byType[type].estimated += task.estimated_duration || 30;
    });
    return Object.values(byType).sort((a, b) => b.total - a.total);
  }, [tasks]);

  // ניתוח לפי רבע
  const tasksByQuadrant = useMemo(() => {
    const byQuadrant = { 1: [], 2: [], 3: [], 4: [] };
    tasks.forEach(task => {
      const q = task.quadrant || 4;
      byQuadrant[q].push(task);
    });
    return byQuadrant;
  }, [tasks]);

  // פורמט זמן
  const formatTime = (minutes) => {
    if (!minutes) return '0 דק\'';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} דק'`;
    if (mins === 0) return `${hours}:00`;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  };

  // צבעי רבעים
  const quadrantColors = {
    1: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', name: 'דחוף וחשוב' },
    2: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', name: 'חשוב' },
    3: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', name: 'דחוף' },
    4: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-300', name: 'אחר' }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-6"
    >
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        📅 סיכום היום
        <span className="text-sm font-normal text-gray-500">
          {date.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'short' })}
        </span>
      </h3>

      {/* התקדמות כללית */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">התקדמות</span>
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {stats.completed}/{stats.total} משימות ({stats.completionRate}%)
          </span>
        </div>
        <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${stats.completionRate}%` }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full"
          />
        </div>
      </div>

      {/* זמנים */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {formatTime(stats.totalTimeSpent)}
          </div>
          <div className="text-xs text-green-700 dark:text-green-300">זמן שהושקע</div>
        </div>
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {formatTime(stats.totalEstimated)}
          </div>
          <div className="text-xs text-blue-700 dark:text-blue-300">זמן שנותר</div>
        </div>
      </div>

      {/* התפלגות לפי רבע */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">לפי עדיפות</h4>
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map(q => {
            const qTasks = tasksByQuadrant[q];
            const completed = qTasks.filter(t => t.is_completed).length;
            return (
              <div key={q} className={`p-2 rounded-lg ${quadrantColors[q].bg}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-medium ${quadrantColors[q].text}`}>
                    {quadrantColors[q].name}
                  </span>
                  <span className={`text-sm font-bold ${quadrantColors[q].text}`}>
                    {completed}/{qTasks.length}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* התפלגות לפי סוג משימה */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">לפי סוג</h4>
        <div className="space-y-2">
          {tasksByType.slice(0, 5).map(typeData => {
            const taskType = TASK_TYPES[typeData.type] || { icon: '📋', name: typeData.type };
            const progress = typeData.total > 0 
              ? Math.round((typeData.completed / typeData.total) * 100) 
              : 0;
            
            return (
              <div key={typeData.type} className="flex items-center gap-3">
                <span className="text-lg">{taskType.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300">{taskType.name}</span>
                    <span className="text-gray-500">{typeData.completed}/{typeData.total}</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mt-1">
                    <div 
                      className="h-full bg-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* משימות ממתינות */}
      {stats.pending > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium text-orange-600 dark:text-orange-400 mb-2">
            ⏳ {stats.pending} משימות ממתינות
          </h4>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {tasks.filter(t => !t.is_completed).slice(0, 5).map(task => {
              const taskType = TASK_TYPES[task.task_type] || { icon: '📋' };
              return (
                <div key={task.id} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <span>{taskType.icon}</span>
                  <span className="truncate">{task.title}</span>
                  {task.estimated_duration && (
                    <span className="text-xs text-gray-400">({task.estimated_duration} דק')</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default DailySummaryCard;

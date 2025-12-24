import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TASK_TYPES } from '../../config/taskTypes';

/**
 * כרטיס סיכום שבועי עם גרפים
 */
function WeeklySummaryCard({ stats, startOfWeek, endOfWeek }) {
  // פורמט זמן
  const formatTime = (minutes) => {
    if (!minutes) return '0';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} דק'`;
    if (mins === 0) return `${hours} שעות`;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  };

  // מציאת היום הכי פרודוקטיבי
  const mostProductiveDay = useMemo(() => {
    let maxCompleted = 0;
    let bestDay = null;
    Object.entries(stats.byDay).forEach(([dayIndex, dayData]) => {
      if (dayData.completed > maxCompleted) {
        maxCompleted = dayData.completed;
        bestDay = dayData;
      }
    });
    return bestDay;
  }, [stats.byDay]);

  // מציאת היום עם הכי הרבה זמן עבודה
  const mostTimeDay = useMemo(() => {
    let maxTime = 0;
    let bestDay = null;
    Object.entries(stats.byDay).forEach(([dayIndex, dayData]) => {
      if (dayData.timeSpent > maxTime) {
        maxTime = dayData.timeSpent;
        bestDay = dayData;
      }
    });
    return bestDay;
  }, [stats.byDay]);

  // מקסימום משימות ביום (לחישוב הגובה היחסי של העמודות)
  const maxTasksInDay = useMemo(() => {
    return Math.max(...Object.values(stats.byDay).map(d => d.total), 1);
  }, [stats.byDay]);

  // סוגי המשימות הנפוצים ביותר
  const topTypes = useMemo(() => {
    return Object.entries(stats.byType)
      .map(([type, data]) => ({
        type,
        ...data,
        total: data.completed + data.pending
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [stats.byType]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-6"
    >
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        📊 סיכום השבוע
        <span className="text-sm font-normal text-gray-500">
          {startOfWeek.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })} - {endOfWeek.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}
        </span>
      </h3>

      {/* סטטיסטיקות ראשיות */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.total}</div>
          <div className="text-xs text-blue-700 dark:text-blue-300">סה"כ משימות</div>
        </div>
        <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.completed}</div>
          <div className="text-xs text-green-700 dark:text-green-300">הושלמו</div>
        </div>
        <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{formatTime(stats.totalTimeSpent)}</div>
          <div className="text-xs text-purple-700 dark:text-purple-300">זמן עבודה</div>
        </div>
        <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
          <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.completionRate}%</div>
          <div className="text-xs text-orange-700 dark:text-orange-300">אחוז השלמה</div>
        </div>
      </div>

      {/* גרף עמודות - משימות לפי יום */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">משימות לפי יום</h4>
        <div className="flex items-end justify-between gap-2 h-32">
          {Object.entries(stats.byDay).map(([dayIndex, dayData]) => {
            const height = (dayData.total / maxTasksInDay) * 100;
            const completedHeight = dayData.total > 0 
              ? (dayData.completed / dayData.total) * height 
              : 0;
            const today = new Date().toISOString().split('T')[0];
            const isToday = dayData.date === today;
            
            return (
              <div key={dayIndex} className="flex-1 flex flex-col items-center">
                <div 
                  className="w-full relative rounded-t-md overflow-hidden"
                  style={{ height: `${height}%`, minHeight: dayData.total > 0 ? '20px' : '4px' }}
                >
                  {/* רקע - כל המשימות */}
                  <div className="absolute inset-0 bg-gray-200 dark:bg-gray-600"></div>
                  {/* משימות שהושלמו */}
                  <motion.div 
                    initial={{ height: 0 }}
                    animate={{ height: `${(dayData.completed / Math.max(dayData.total, 1)) * 100}%` }}
                    transition={{ duration: 0.5, delay: parseInt(dayIndex) * 0.1 }}
                    className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-green-500 to-green-400"
                  />
                </div>
                <div className={`text-xs mt-2 ${isToday ? 'font-bold text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>
                  {dayData.name.slice(0, 2)}
                </div>
                <div className="text-xs text-gray-400">
                  {dayData.completed}/{dayData.total}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-center gap-4 mt-3 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span>הושלמו</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-gray-300 dark:bg-gray-600 rounded"></div>
            <span>ממתינות</span>
          </div>
        </div>
      </div>

      {/* התפלגות לפי סוג */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">לפי סוג משימה</h4>
        <div className="space-y-2">
          {topTypes.map(typeData => {
            const taskType = TASK_TYPES[typeData.type] || { icon: '📋', name: typeData.type };
            const completionRate = typeData.total > 0 
              ? Math.round((typeData.completed / typeData.total) * 100) 
              : 0;
            
            return (
              <div key={typeData.type} className="flex items-center gap-3">
                <span className="text-lg w-8 text-center">{taskType.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-700 dark:text-gray-300">{taskType.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{formatTime(typeData.timeSpent)}</span>
                      <span className="text-gray-500">{typeData.completed}/{typeData.total}</span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"
                      style={{ width: `${completionRate}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* תובנות */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">תובנות השבוע</h4>
        
        {mostProductiveDay && mostProductiveDay.completed > 0 && (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-start gap-3">
            <span className="text-xl">🏆</span>
            <div>
              <div className="text-sm font-medium text-green-700 dark:text-green-300">היום הכי פרודוקטיבי</div>
              <div className="text-xs text-green-600 dark:text-green-400">
                יום {mostProductiveDay.name} - {mostProductiveDay.completed} משימות הושלמו
              </div>
            </div>
          </div>
        )}

        {mostTimeDay && mostTimeDay.timeSpent > 0 && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-start gap-3">
            <span className="text-xl">⏱️</span>
            <div>
              <div className="text-sm font-medium text-blue-700 dark:text-blue-300">הכי הרבה זמן עבודה</div>
              <div className="text-xs text-blue-600 dark:text-blue-400">
                יום {mostTimeDay.name} - {formatTime(mostTimeDay.timeSpent)}
              </div>
            </div>
          </div>
        )}

        {stats.averageTasksPerDay > 0 && (
          <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg flex items-start gap-3">
            <span className="text-xl">📈</span>
            <div>
              <div className="text-sm font-medium text-purple-700 dark:text-purple-300">ממוצע יומי</div>
              <div className="text-xs text-purple-600 dark:text-purple-400">
                כ-{stats.averageTasksPerDay} משימות ביום
              </div>
            </div>
          </div>
        )}

        {stats.pending > 0 && (
          <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <div className="text-sm font-medium text-orange-700 dark:text-orange-300">משימות פתוחות</div>
              <div className="text-xs text-orange-600 dark:text-orange-400">
                {stats.pending} משימות עדיין ממתינות השבוע
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default WeeklySummaryCard;

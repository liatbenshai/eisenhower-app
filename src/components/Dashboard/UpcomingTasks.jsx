import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TASK_TYPES } from '../../config/taskTypes';

/**
 * רכיב משימות קרובות
 * מציג משימות לימים הקרובים עם התראות
 */
function UpcomingTasks({ tasks }) {
  // חישוב משימות קרובות
  const upcomingData = useMemo(() => {
    const today = new Date();
    const todayISO = today.toISOString().split('T')[0];
    
    // 7 ימים קדימה
    const upcomingDays = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      upcomingDays.push(date.toISOString().split('T')[0]);
    }

    // משימות באיחור
    const overdue = tasks.filter(t => 
      !t.is_completed && 
      t.due_date && 
      t.due_date < todayISO
    );

    // משימות לפי יום
    const byDay = {};
    upcomingDays.forEach(dateISO => {
      byDay[dateISO] = tasks.filter(t => 
        !t.is_completed && 
        t.due_date === dateISO
      );
    });

    // משימות דחופות
    const urgent = tasks.filter(t => 
      !t.is_completed && 
      t.quadrant === 1 &&
      t.due_date &&
      t.due_date <= upcomingDays[2] // תוך 3 ימים
    );

    // משימות ללא תאריך
    const noDate = tasks.filter(t => 
      !t.is_completed && 
      !t.due_date
    );

    // עומס לפי יום
    const loadByDay = {};
    Object.entries(byDay).forEach(([dateISO, dayTasks]) => {
      const totalMinutes = dayTasks.reduce((sum, t) => sum + (t.estimated_duration || 30), 0);
      const availableMinutes = 8 * 60; // 8 שעות
      loadByDay[dateISO] = {
        totalMinutes,
        availableMinutes,
        utilizationPercent: Math.round((totalMinutes / availableMinutes) * 100),
        overloaded: totalMinutes > availableMinutes
      };
    });

    return {
      overdue,
      byDay,
      urgent,
      noDate,
      loadByDay,
      upcomingDays,
      totalUpcoming: Object.values(byDay).flat().length
    };
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

  // פורמט תאריך
  const formatDate = (dateISO) => {
    const date = new Date(dateISO);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (dateISO === today.toISOString().split('T')[0]) return 'היום';
    if (dateISO === tomorrow.toISOString().split('T')[0]) return 'מחר';

    const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    return `יום ${dayNames[date.getDay()]}`;
  };

  // צבעי רבעים
  const quadrantColors = {
    1: 'border-l-red-500',
    2: 'border-l-blue-500',
    3: 'border-l-orange-500',
    4: 'border-l-gray-400'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-6"
    >
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
        📋 משימות קרובות
      </h3>

      {/* התראות */}
      {(upcomingData.overdue.length > 0 || upcomingData.urgent.length > 0) && (
        <div className="space-y-2 mb-4">
          {upcomingData.overdue.length > 0 && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-xl">🚨</span>
                <div>
                  <div className="text-sm font-medium text-red-700 dark:text-red-300">
                    {upcomingData.overdue.length} משימות באיחור!
                  </div>
                  <div className="text-xs text-red-600 dark:text-red-400">
                    {upcomingData.overdue.slice(0, 2).map(t => t.title).join(', ')}
                    {upcomingData.overdue.length > 2 && ` ועוד ${upcomingData.overdue.length - 2}...`}
                  </div>
                </div>
              </div>
            </div>
          )}

          {upcomingData.urgent.length > 0 && (
            <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚡</span>
                <div>
                  <div className="text-sm font-medium text-orange-700 dark:text-orange-300">
                    {upcomingData.urgent.length} משימות דחופות וחשובות
                  </div>
                  <div className="text-xs text-orange-600 dark:text-orange-400">
                    חייבות להסתיים תוך 3 ימים
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ציר זמן */}
      <div className="space-y-4">
        {upcomingData.upcomingDays.slice(0, 5).map(dateISO => {
          const dayTasks = upcomingData.byDay[dateISO];
          const dayLoad = upcomingData.loadByDay[dateISO];
          
          if (dayTasks.length === 0) {
            return (
              <div key={dateISO} className="flex items-center gap-3 opacity-50">
                <div className="w-16 text-sm text-gray-500">{formatDate(dateISO)}</div>
                <div className="flex-1 h-8 border-l-2 border-dashed border-gray-300 dark:border-gray-600 pl-4 flex items-center">
                  <span className="text-xs text-gray-400">אין משימות</span>
                </div>
              </div>
            );
          }

          return (
            <div key={dateISO}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {formatDate(dateISO)}
                  </span>
                  <span className="text-xs text-gray-500">
                    {dayTasks.length} משימות
                  </span>
                </div>
                <div className={`text-xs px-2 py-0.5 rounded-full ${
                  dayLoad.overloaded 
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                    : dayLoad.utilizationPercent > 70
                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                      : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                }`}>
                  {formatTime(dayLoad.totalMinutes)}
                </div>
              </div>
              
              <div className="space-y-1 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                {dayTasks.slice(0, 4).map(task => {
                  const taskType = TASK_TYPES[task.task_type] || { icon: '📋' };
                  return (
                    <div 
                      key={task.id}
                      className={`flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg border-l-4 ${quadrantColors[task.quadrant] || 'border-l-gray-400'}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span>{taskType.icon}</span>
                        <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                          {task.title}
                        </span>
                      </div>
                      {task.estimated_duration && (
                        <span className="text-xs text-gray-500 flex-shrink-0">
                          {task.estimated_duration} דק'
                        </span>
                      )}
                    </div>
                  );
                })}
                {dayTasks.length > 4 && (
                  <div className="text-xs text-gray-500 text-center py-1">
                    + עוד {dayTasks.length - 4} משימות
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* משימות ללא תאריך */}
      {upcomingData.noDate.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
            📌 ללא תאריך ({upcomingData.noDate.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {upcomingData.noDate.slice(0, 5).map(task => {
              const taskType = TASK_TYPES[task.task_type] || { icon: '📋' };
              return (
                <div 
                  key={task.id}
                  className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-300 flex items-center gap-1"
                >
                  <span>{taskType.icon}</span>
                  <span className="truncate max-w-[100px]">{task.title}</span>
                </div>
              );
            })}
            {upcomingData.noDate.length > 5 && (
              <span className="text-xs text-gray-500">
                +{upcomingData.noDate.length - 5}
              </span>
            )}
          </div>
        </div>
      )}

      {/* סה"כ */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-center">
        <span className="text-sm text-gray-500">
          סה"כ {upcomingData.totalUpcoming + upcomingData.overdue.length} משימות פתוחות
        </span>
      </div>
    </motion.div>
  );
}

export default UpcomingTasks;

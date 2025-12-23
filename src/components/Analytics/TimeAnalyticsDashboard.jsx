import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { TASK_TYPES } from '../DailyView/DailyView';
import { getWeeklyIdleStats, formatIdleTime, getTodayIdleStats } from '../../utils/idleTimeTracker';

/**
 * דשבורד פרודוקטיביות מקיף
 */
function TimeAnalyticsDashboard() {
  const { tasks } = useTasks();
  const [timeRange, setTimeRange] = useState('week');
  const [activeTab, setActiveTab] = useState('overview'); // overview, tasks, deadlines, idle

  // חישוב תאריכי הטווח
  const dateRange = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let startDate;
    if (timeRange === 'week') {
      startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 7);
    } else if (timeRange === 'month') {
      startDate = new Date(today);
      startDate.setMonth(startDate.getMonth() - 1);
    } else {
      startDate = new Date(2020, 0, 1);
    }
    
    return { start: startDate, end: today };
  }, [timeRange]);

  // סינון משימות לפי טווח
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const taskDate = new Date(task.completed_at || task.due_date || task.created_at);
      return taskDate >= dateRange.start && taskDate <= dateRange.end;
    });
  }, [tasks, dateRange]);

  // משימות שהושלמו
  const completedTasks = useMemo(() => {
    return filteredTasks.filter(t => t.is_completed);
  }, [filteredTasks]);

  // סטטיסטיקות כלליות
  const generalStats = useMemo(() => {
    const totalTasks = completedTasks.length;
    const totalEstimated = completedTasks.reduce((sum, t) => sum + (t.estimated_duration || 0), 0);
    const totalActual = completedTasks.reduce((sum, t) => sum + (t.time_spent || 0), 0);
    const avgEfficiency = totalActual > 0 ? (totalEstimated / totalActual) * 100 : 100;
    
    // עמידה בדדליינים
    const tasksWithDeadline = completedTasks.filter(t => t.due_date);
    const tasksOnTime = tasksWithDeadline.filter(t => {
      if (!t.completed_at) return true;
      const dueDate = new Date(t.due_date);
      const completedDate = new Date(t.completed_at);
      return completedDate <= dueDate;
    });
    const onTimeRate = tasksWithDeadline.length > 0 
      ? Math.round((tasksOnTime.length / tasksWithDeadline.length) * 100) 
      : 100;
    
    return {
      totalTasks,
      totalEstimated,
      totalActual,
      avgEfficiency: Math.round(avgEfficiency),
      timeDiff: totalActual - totalEstimated,
      onTimeRate,
      tasksOnTime: tasksOnTime.length,
      tasksWithDeadline: tasksWithDeadline.length
    };
  }, [completedTasks]);

  // זמן מת
  const idleStats = useMemo(() => {
    const weekly = getWeeklyIdleStats();
    const today = getTodayIdleStats();
    
    const totalIdleMinutes = weekly.reduce((sum, day) => sum + day.totalMinutes, 0);
    const avgIdlePerDay = weekly.length > 0 ? Math.round(totalIdleMinutes / weekly.length) : 0;
    
    return {
      today: today.totalMinutes,
      weekly: totalIdleMinutes,
      avgPerDay: avgIdlePerDay,
      byDay: weekly
    };
  }, []);

  // סטטיסטיקות לפי סוג משימה
  const statsByType = useMemo(() => {
    const stats = {};
    
    Object.keys(TASK_TYPES).forEach(typeId => {
      stats[typeId] = {
        type: TASK_TYPES[typeId],
        count: 0,
        totalEstimated: 0,
        totalActual: 0,
        onTime: 0,
        late: 0
      };
    });

    completedTasks.forEach(task => {
      const typeId = task.task_type || 'other';
      if (stats[typeId]) {
        stats[typeId].count++;
        stats[typeId].totalEstimated += task.estimated_duration || 0;
        stats[typeId].totalActual += task.time_spent || 0;
        
        if (task.due_date && task.completed_at) {
          const dueDate = new Date(task.due_date);
          const completedDate = new Date(task.completed_at);
          if (completedDate <= dueDate) {
            stats[typeId].onTime++;
          } else {
            stats[typeId].late++;
          }
        }
      }
    });

    return Object.values(stats).filter(s => s.count > 0).sort((a, b) => b.totalActual - a.totalActual);
  }, [completedTasks]);

  // סטטיסטיקות לפי יום
  const statsByDay = useMemo(() => {
    const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי'];
    const stats = days.map((name, index) => ({
      name,
      index,
      count: 0,
      totalMinutes: 0,
      idleMinutes: 0
    }));

    completedTasks.forEach(task => {
      const date = new Date(task.completed_at || task.due_date);
      const dayIndex = date.getDay();
      if (dayIndex < 5) {
        stats[dayIndex].count++;
        stats[dayIndex].totalMinutes += task.time_spent || 0;
      }
    });

    // הוספת זמן מת לפי יום
    idleStats.byDay.forEach(day => {
      const date = new Date(day.date);
      const dayIndex = date.getDay();
      if (dayIndex < 5) {
        stats[dayIndex].idleMinutes += day.totalMinutes;
      }
    });

    return stats;
  }, [completedTasks, idleStats]);

  // פירוט משימות אחרונות
  const recentTasks = useMemo(() => {
    return completedTasks
      .sort((a, b) => new Date(b.completed_at || b.due_date) - new Date(a.completed_at || a.due_date))
      .slice(0, 20);
  }, [completedTasks]);

  // משימות באיחור
  const lateTasks = useMemo(() => {
    return completedTasks.filter(t => {
      if (!t.due_date || !t.completed_at) return false;
      return new Date(t.completed_at) > new Date(t.due_date);
    }).sort((a, b) => {
      const aLate = new Date(a.completed_at) - new Date(a.due_date);
      const bLate = new Date(b.completed_at) - new Date(b.due_date);
      return bLate - aLate;
    });
  }, [completedTasks]);

  // פורמט דקות
  const formatMinutes = (minutes) => {
    if (!minutes || minutes === 0) return '0 דק\'';
    if (minutes < 60) return `${minutes} דק'`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours} שעות`;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  };

  const formatHours = (minutes) => {
    return (minutes / 60).toFixed(1);
  };

  const maxDayMinutes = Math.max(...statsByDay.map(d => d.totalMinutes + d.idleMinutes), 1);

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      {/* כותרת */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <span>📊</span>
          דשבורד פרודוקטיביות
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          ניתוח הזמנים, היעילות ועמידה בדדליינים
        </p>
      </motion.div>

      {/* בחירת טווח זמן */}
      <div className="flex flex-wrap gap-2 mb-6">
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {[
            { id: 'week', label: 'שבוע' },
            { id: 'month', label: 'חודש' },
            { id: 'all', label: 'הכל' }
          ].map(range => (
            <button
              key={range.id}
              onClick={() => setTimeRange(range.id)}
              className={`
                px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                ${timeRange === range.id
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }
              `}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* טאבים */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-2">
        {[
          { id: 'overview', label: 'סקירה כללית', icon: '📈' },
          { id: 'tasks', label: 'משימות', icon: '✅' },
          { id: 'deadlines', label: 'דדליינים', icon: '⏰' },
          { id: 'idle', label: 'זמן מת', icon: '⏸️' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap
              ${activeTab === tab.id
                ? 'bg-blue-500 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }
            `}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* תוכן לפי טאב */}
      {activeTab === 'overview' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          {/* כרטיסי סיכום */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card p-4 text-center">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {generalStats.totalTasks}
              </div>
              <div className="text-sm text-gray-500">משימות הושלמו</div>
            </div>

            <div className="card p-4 text-center">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                {formatHours(generalStats.totalActual)}
              </div>
              <div className="text-sm text-gray-500">שעות עבודה</div>
            </div>

            <div className="card p-4 text-center">
              <div className={`text-3xl font-bold ${
                generalStats.onTimeRate >= 80 ? 'text-green-600' :
                generalStats.onTimeRate >= 60 ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {generalStats.onTimeRate}%
              </div>
              <div className="text-sm text-gray-500">עמידה בדדליינים</div>
            </div>

            <div className="card p-4 text-center">
              <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                {formatIdleTime(idleStats.weekly)}
              </div>
              <div className="text-sm text-gray-500">זמן מת (שבועי)</div>
            </div>
          </div>

          {/* גרף ימים */}
          <div className="card p-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              📅 התפלגות זמן לפי יום
            </h2>
            
            <div className="flex items-end justify-between gap-3 h-48">
              {statsByDay.map((day, index) => {
                const workHeight = maxDayMinutes > 0 ? (day.totalMinutes / maxDayMinutes) * 100 : 0;
                const idleHeight = maxDayMinutes > 0 ? (day.idleMinutes / maxDayMinutes) * 100 : 0;
                
                return (
                  <div key={index} className="flex-1 flex flex-col items-center">
                    <div className="text-xs text-gray-500 mb-1 text-center">
                      {day.totalMinutes > 0 && <div className="text-green-600">{formatHours(day.totalMinutes)}ש</div>}
                      {day.idleMinutes > 0 && <div className="text-orange-500">{formatIdleTime(day.idleMinutes)}</div>}
                    </div>
                    <div className="w-full flex flex-col-reverse" style={{ height: '120px' }}>
                      {/* עבודה */}
                      <div 
                        className="w-full bg-green-500 dark:bg-green-600 rounded-t transition-all duration-500"
                        style={{ height: `${workHeight}%` }}
                      />
                      {/* זמן מת */}
                      <div 
                        className="w-full bg-orange-400 dark:bg-orange-500 transition-all duration-500"
                        style={{ height: `${idleHeight}%` }}
                      />
                    </div>
                    <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-2">
                      {day.name}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* מקרא */}
            <div className="flex justify-center gap-4 mt-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span className="text-gray-600 dark:text-gray-400">עבודה</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-orange-400 rounded"></div>
                <span className="text-gray-600 dark:text-gray-400">זמן מת</span>
              </div>
            </div>
          </div>

          {/* יעילות לפי סוג */}
          <div className="card p-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              ⏱️ זמן לפי סוג משימה
            </h2>
            
            {statsByType.length === 0 ? (
              <div className="text-center py-8 text-gray-500">אין נתונים</div>
            ) : (
              <div className="space-y-3">
                {statsByType.map((stat) => {
                  const efficiency = stat.totalActual > 0 
                    ? Math.round((stat.totalEstimated / stat.totalActual) * 100) 
                    : 100;
                  
                  return (
                    <div key={stat.type.id} className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded text-sm ${stat.type.color}`}>
                        {stat.type.icon}
                      </span>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium">{stat.type.name}</span>
                          <span className="text-gray-500">
                            {formatMinutes(stat.totalActual)} ({stat.count})
                          </span>
                        </div>
                        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${
                              efficiency >= 90 ? 'bg-green-500' :
                              efficiency >= 70 ? 'bg-yellow-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(100, efficiency)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {activeTab === 'tasks' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card p-4"
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            ✅ משימות שהושלמו ({recentTasks.length})
          </h2>
          
          {recentTasks.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <div className="text-4xl mb-2">📭</div>
              <div>אין משימות שהושלמו בטווח הנבחר</div>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {recentTasks.map((task) => {
                const taskType = TASK_TYPES[task.task_type] || TASK_TYPES.other;
                const estimated = task.estimated_duration || 0;
                const actual = task.time_spent || 0;
                const diff = actual - estimated;
                
                return (
                  <div 
                    key={task.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <span className={`px-2 py-1 rounded text-sm ${taskType.color}`}>
                      {taskType.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 dark:text-white truncate">
                        {task.title}
                      </div>
                      <div className="text-xs text-gray-500">
                        {task.due_date && new Date(task.due_date).toLocaleDateString('he-IL')}
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-medium">
                        {formatMinutes(actual)}
                      </div>
                      {estimated > 0 && (
                        <div className={`text-xs ${
                          diff <= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {diff > 0 ? '+' : ''}{formatMinutes(Math.abs(diff))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      )}

      {activeTab === 'deadlines' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          {/* סיכום עמידה בדדליינים */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-4 text-center">
              <div className="text-3xl font-bold text-green-600">
                {generalStats.tasksOnTime}
              </div>
              <div className="text-sm text-gray-500">בזמן</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-3xl font-bold text-red-600">
                {lateTasks.length}
              </div>
              <div className="text-sm text-gray-500">באיחור</div>
            </div>
            <div className="card p-4 text-center">
              <div className={`text-3xl font-bold ${
                generalStats.onTimeRate >= 80 ? 'text-green-600' : 'text-red-600'
              }`}>
                {generalStats.onTimeRate}%
              </div>
              <div className="text-sm text-gray-500">אחוז הצלחה</div>
            </div>
          </div>

          {/* משימות באיחור */}
          <div className="card p-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              ⚠️ משימות שהסתיימו באיחור ({lateTasks.length})
            </h2>
            
            {lateTasks.length === 0 ? (
              <div className="text-center py-8 text-green-600">
                <div className="text-4xl mb-2">🎉</div>
                <div>מעולה! אין משימות באיחור</div>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {lateTasks.map((task) => {
                  const taskType = TASK_TYPES[task.task_type] || TASK_TYPES.other;
                  const lateBy = Math.ceil(
                    (new Date(task.completed_at) - new Date(task.due_date)) / (1000 * 60 * 60 * 24)
                  );
                  
                  return (
                    <div 
                      key={task.id}
                      className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800"
                    >
                      <span className={`px-2 py-1 rounded text-sm ${taskType.color}`}>
                        {taskType.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 dark:text-white truncate">
                          {task.title}
                        </div>
                        <div className="text-xs text-gray-500">
                          יעד: {new Date(task.due_date).toLocaleDateString('he-IL')}
                        </div>
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-bold text-red-600">
                          {lateBy} {lateBy === 1 ? 'יום' : 'ימים'} איחור
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {activeTab === 'idle' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          {/* סיכום זמן מת */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-4 text-center">
              <div className="text-3xl font-bold text-orange-600">
                {formatIdleTime(idleStats.today)}
              </div>
              <div className="text-sm text-gray-500">היום</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-3xl font-bold text-orange-600">
                {formatIdleTime(idleStats.weekly)}
              </div>
              <div className="text-sm text-gray-500">השבוע</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-3xl font-bold text-orange-600">
                {formatIdleTime(idleStats.avgPerDay)}
              </div>
              <div className="text-sm text-gray-500">ממוצע ליום</div>
            </div>
          </div>

          {/* גרף זמן מת לפי יום */}
          <div className="card p-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              ⏸️ זמן מת לפי יום
            </h2>
            
            {idleStats.byDay.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">📊</div>
                <div>אין נתונים על זמן מת</div>
              </div>
            ) : (
              <div className="space-y-3">
                {idleStats.byDay.map((day, index) => {
                  const maxIdle = Math.max(...idleStats.byDay.map(d => d.totalMinutes), 1);
                  const width = (day.totalMinutes / maxIdle) * 100;
                  
                  return (
                    <div key={index} className="flex items-center gap-3">
                      <div className="w-20 text-sm text-gray-600 dark:text-gray-400">
                        {new Date(day.date).toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric' })}
                      </div>
                      <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-orange-500 rounded-full transition-all duration-500"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                      <div className="w-16 text-left text-sm font-medium text-gray-900 dark:text-white">
                        {formatIdleTime(day.totalMinutes)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* טיפים לצמצום זמן מת */}
          <div className="card p-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              💡 טיפים לצמצום זמן מת
            </h2>
            
            <div className="space-y-3 text-sm">
              {idleStats.avgPerDay > 60 && (
                <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-orange-800 dark:text-orange-200">
                  <strong>⚠️ זמן מת גבוה:</strong> יותר משעה ביום בממוצע. 
                  נסי לתכנן מראש מה לעשות בין משימות.
                </div>
              )}
              
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-800 dark:text-blue-200">
                <strong>💡 טיפ:</strong> הכיני רשימת משימות קטנות שאפשר לעשות בזמן מת - 
                מיילים קצרים, קריאה, סידור.
              </div>
              
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-800 dark:text-green-200">
                <strong>✨ זכרי:</strong> קצת זמן מת זה בריא! 
                מנוחות קצרות משפרות את הפרודוקטיביות הכללית.
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default TimeAnalyticsDashboard;

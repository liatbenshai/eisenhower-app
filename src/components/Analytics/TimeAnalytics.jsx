import { useMemo } from 'react';
import { useTasks } from '../../hooks/useTasks';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths } from 'date-fns';
import { he } from 'date-fns/locale';

/**
 * ניתוח זמן - לראות איפה הזמן הולך
 */
function TimeAnalytics() {
  const { tasks } = useTasks();
  
  // חישוב סטטיסטיקות זמן
  const timeStats = useMemo(() => {
    const now = new Date();
    const last7Days = subDays(now, 7);
    const last30Days = subDays(now, 30);
    
    // זמן כולל שבוצע
    const totalTimeSpent = tasks.reduce((sum, task) => sum + (task.time_spent || 0), 0);
    
    // זמן משוער כולל
    const totalEstimated = tasks.reduce((sum, task) => sum + (task.estimated_duration || 0), 0);
    
    // משימות שהושלמו ב-7 ימים האחרונים
    const completedLast7Days = tasks.filter(task => {
      if (!task.completed_at) return false;
      const completedDate = new Date(task.completed_at);
      return completedDate >= last7Days;
    });
    
    // זמן שבוצע ב-7 ימים האחרונים
    const timeSpentLast7Days = completedLast7Days.reduce((sum, task) => sum + (task.time_spent || 0), 0);
    
    // זמן שבוצע ב-30 ימים האחרונים
    const completedLast30Days = tasks.filter(task => {
      if (!task.completed_at) return false;
      const completedDate = new Date(task.completed_at);
      return completedDate >= last30Days;
    });
    const timeSpentLast30Days = completedLast30Days.reduce((sum, task) => sum + (task.time_spent || 0), 0);
    
    // זמן לפי רבע
    const timeByQuadrant = {
      1: tasks.filter(t => t.quadrant === 1).reduce((sum, t) => sum + (t.time_spent || 0), 0),
      2: tasks.filter(t => t.quadrant === 2).reduce((sum, t) => sum + (t.time_spent || 0), 0),
      3: tasks.filter(t => t.quadrant === 3).reduce((sum, t) => sum + (t.time_spent || 0), 0),
      4: tasks.filter(t => t.quadrant === 4).reduce((sum, t) => sum + (t.time_spent || 0), 0)
    };
    
    // פרויקטים עם הכי הרבה זמן
    const projects = tasks.filter(t => t.is_project);
    const topProjects = projects
      .map(project => {
        const subtasks = tasks.filter(t => t.parent_task_id === project.id);
        const projectTime = subtasks.reduce((sum, st) => sum + (st.time_spent || 0), 0);
        return { ...project, totalTime: projectTime };
      })
      .sort((a, b) => b.totalTime - a.totalTime)
      .slice(0, 5);
    
    // יעילות (זמן שבוצע / זמן משוער)
    const efficiency = totalEstimated > 0 
      ? Math.round((totalTimeSpent / totalEstimated) * 100)
      : 0;
    
    return {
      totalTimeSpent,
      totalEstimated,
      timeSpentLast7Days,
      timeSpentLast30Days,
      timeByQuadrant,
      topProjects,
      efficiency,
      completedLast7Days: completedLast7Days.length,
      completedLast30Days: completedLast30Days.length
    };
  }, [tasks]);
  
  const formatMinutes = (minutes) => {
    if (minutes < 60) return `${minutes} דקות`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours} שעות ${mins} דקות` : `${hours} שעות`;
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          ניתוח זמן
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          לראות איפה הזמן שלך הולך
        </p>
      </div>
      
      {/* סטטיסטיקות כלליות */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <span className="text-2xl">⏱️</span>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">זמן כולל שבוצע</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {formatMinutes(timeStats.totalTimeSpent)}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <span className="text-2xl">📊</span>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">יעילות</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {timeStats.efficiency}%
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <span className="text-2xl">📅</span>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">7 ימים אחרונים</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {formatMinutes(timeStats.timeSpentLast7Days)}
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* זמן לפי רבע */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          זמן לפי רבע
        </h3>
        <div className="space-y-3">
          {[
            { id: 1, name: 'דחוף וחשוב', color: 'red', icon: '🔴' },
            { id: 2, name: 'חשוב אך לא דחוף', color: 'blue', icon: '🔵' },
            { id: 3, name: 'דחוף אך לא חשוב', color: 'orange', icon: '🟠' },
            { id: 4, name: 'לא דחוף ולא חשוב', color: 'gray', icon: '⚫' }
          ].map(quadrant => {
            const time = timeStats.timeByQuadrant[quadrant.id];
            const percentage = timeStats.totalTimeSpent > 0 
              ? Math.round((time / timeStats.totalTimeSpent) * 100)
              : 0;
            
            return (
              <div key={quadrant.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{quadrant.icon}</span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {quadrant.name}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                      {formatMinutes(time)}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">
                      {' '}({percentage}%)
                    </span>
                  </div>
                </div>
                <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      quadrant.color === 'red' ? 'bg-red-500' :
                      quadrant.color === 'blue' ? 'bg-blue-500' :
                      quadrant.color === 'orange' ? 'bg-orange-500' :
                      'bg-gray-500'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* פרויקטים עם הכי הרבה זמן */}
      {timeStats.topProjects.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            פרויקטים עם הכי הרבה זמן
          </h3>
          <div className="space-y-3">
            {timeStats.topProjects.map((project, index) => (
              <div key={project.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-gray-400 dark:text-gray-500">
                    #{index + 1}
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {project.title}
                  </span>
                </div>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  {formatMinutes(project.totalTime)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default TimeAnalytics;


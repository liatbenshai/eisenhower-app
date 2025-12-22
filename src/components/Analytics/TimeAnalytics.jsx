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
    console.log('⏱️ TimeAnalytics: מחשב סטטיסטיקות עבור', tasks.length, 'משימות');
    
    const now = new Date();
    const last7Days = subDays(now, 7);
    const last30Days = subDays(now, 30);
    
    // זמן כולל שבוצע (כל המשימות - גם פעילות וגם הושלמו)
    const totalTimeSpent = tasks.reduce((sum, task) => sum + (task.time_spent || 0), 0);
    
    // זמן משוער כולל (כל המשימות)
    const totalEstimated = tasks.reduce((sum, task) => sum + (task.estimated_duration || 0), 0);
    
    // משימות שהושלמו ב-7 ימים האחרונים
    const completedLast7Days = tasks.filter(task => {
      if (!task.is_completed || !task.completed_at) return false;
      try {
        const completedDate = new Date(task.completed_at);
        if (isNaN(completedDate.getTime())) {
          console.warn('⚠️ תאריך השלמה לא תקין:', task.completed_at);
          return false;
        }
        return completedDate >= last7Days && completedDate <= now;
      } catch (err) {
        console.error('שגיאה בניתוח תאריך:', err);
        return false;
      }
    });
    
    // זמן שבוצע ב-7 ימים האחרונים (כל המשימות עם זמן שבוצע, לא רק הושלמו)
    const timeSpentLast7Days = tasks.reduce((sum, task) => {
      const timeSpent = task.time_spent || 0;
      if (timeSpent === 0) return sum;
      
      // אם המשימה הושלמה ב-7 ימים האחרונים, מוסיפים את הזמן
      if (task.completed_at) {
        try {
          const completedDate = new Date(task.completed_at);
          if (completedDate >= last7Days && completedDate <= now) {
            return sum + timeSpent;
          }
        } catch (err) {
          console.error('שגיאה בניתוח תאריך:', err);
        }
      }
      // אם המשימה פעילה ועודכנה ב-7 ימים האחרונים, מוסיפים את הזמן
      if (!task.is_completed && task.updated_at) {
        try {
          const updatedDate = new Date(task.updated_at);
          if (updatedDate >= last7Days) {
            return sum + timeSpent;
          }
        } catch (err) {
          console.error('שגיאה בניתוח תאריך עדכון:', err);
        }
      }
      // גם אם אין תאריך עדכון, אבל יש זמן שבוצע, נוסיף אותו (למקרה שהמשימה עודכנה היום)
      if (!task.is_completed && !task.updated_at && timeSpent > 0) {
        return sum + timeSpent;
      }
      return sum;
    }, 0);
    
    // זמן שבוצע ב-30 ימים האחרונים (כל המשימות)
    const timeSpentLast30Days = tasks.reduce((sum, task) => {
      const timeSpent = task.time_spent || 0;
      if (timeSpent === 0) return sum;
      
      if (task.completed_at) {
        const completedDate = new Date(task.completed_at);
        if (completedDate >= last30Days) {
          return sum + timeSpent;
        }
      }
      
      if (!task.is_completed) {
        if (task.updated_at) {
          const updatedDate = new Date(task.updated_at);
          if (updatedDate >= last30Days) {
            return sum + timeSpent;
          }
        } else {
          // אם אין תאריך עדכון - כנראה עודכן לאחרונה
          return sum + timeSpent;
        }
      }
      
      return sum;
    }, 0);
    
    // זמן לפי רבע (כל המשימות - פעילות והושלמו)
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
  
  // בדיקה אם יש נתונים (כל משימות עם זמן, לא רק הושלמו)
  const hasData = timeStats.totalTimeSpent > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          ניתוח זמן
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          איפה הזמן שלך הולך - כל המשימות עם זמן שבוצע (פעילות והושלמו)
        </p>
      </div>

      {/* הודעה אם אין נתונים */}
      {!hasData && (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <span className="text-4xl mb-4 block">⏱️</span>
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
            אין עדיין נתוני זמן
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            השלימי משימות ועקבי אחר הזמן שלוקח לך כדי לראות ניתוחים
          </p>
          <div className="max-w-md mx-auto p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              💡 <strong>כיצד זה עובד:</strong><br/>
              1. הוסיפי זמן משוער למשימות (אופציונלי)<br/>
              2. השתמשי בטיימר או עדכני ידנית את הזמן שבוצע<br/>
              3. הזמן יישמר אוטומטית - גם למשימות פעילות!<br/>
              4. המערכת תנתח איפה הזמן הולך על כל המשימות (פעילות והושלמו)
            </p>
          </div>
        </div>
      )}
      
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


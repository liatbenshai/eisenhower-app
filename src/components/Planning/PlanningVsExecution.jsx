import { useMemo } from 'react';
import { useTasks } from '../../hooks/useTasks';
import { format, startOfWeek, endOfWeek, startOfDay, endOfDay, isSameDay, subDays } from 'date-fns';
import { he } from 'date-fns/locale';

/**
 * השוואה בין תכנון לביצוע - מה תוכנן לעומת מה בוצע בפועל
 */
function PlanningVsExecution() {
  const { tasks } = useTasks();
  
  // חישוב השוואה
  const comparison = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    const weekStart = startOfWeek(now, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 0 });
    
    // כל המשימות עם זמן משוער או זמן שבוצע
    const tasksWithTime = tasks.filter(t => 
      !t.is_project && !t.parent_task_id && 
      ((t.estimated_duration || 0) > 0 || (t.time_spent || 0) > 0)
    );
    
    // חישוב כולל - תכנון vs ביצוע
    const totalPlanned = tasksWithTime.reduce((sum, t) => sum + (t.estimated_duration || 0), 0);
    const totalActual = tasksWithTime.reduce((sum, t) => sum + (t.time_spent || 0), 0);
    
    // דיוק בהערכות - רק משימות עם זמן משוער וזמן שבוצע
    const tasksWithBoth = tasksWithTime.filter(t => 
      (t.estimated_duration || 0) > 0 && (t.time_spent || 0) > 0
    );
    
    const accuracyStats = tasksWithBoth.map(task => {
      const estimated = task.estimated_duration || 0;
      const actual = task.time_spent || 0;
      const diff = actual - estimated;
      const accuracy = estimated > 0 ? Math.round((estimated / actual) * 100) : 0;
      const overEstimate = diff > 0; // ביצעת יותר מהמשוער
      
      return {
        ...task,
        estimated,
        actual,
        diff: Math.abs(diff),
        accuracy,
        overEstimate,
        percentageDiff: estimated > 0 ? Math.round((diff / estimated) * 100) : 0
      };
    });
    
    // משימות שמעריכות נמוך מדי (ביצעת הרבה יותר מהמשוער)
    const underestimated = accuracyStats.filter(t => t.overEstimate && t.percentageDiff > 20);
    
    // משימות שמעריכות גבוה מדי (ביצעת פחות מהמשוער)
    const overestimated = accuracyStats.filter(t => !t.overEstimate && t.percentageDiff < -20);
    
    // משימות מדויקות (ביצעת קרוב למשוער - עד 20% הבדל)
    const accurate = accuracyStats.filter(t => Math.abs(t.percentageDiff) <= 20);
    
    // ממוצע דיוק
    const avgAccuracy = accuracyStats.length > 0
      ? Math.round(accuracyStats.reduce((sum, t) => sum + (100 - Math.abs(t.percentageDiff)), 0) / accuracyStats.length)
      : 0;
    
    // תכנון vs ביצוע - היום
    const todayTasks = tasksWithTime.filter(t => {
      if (t.due_date) {
        const dueDate = startOfDay(new Date(t.due_date));
        return isSameDay(dueDate, today);
      }
      return false;
    });
    
    const todayPlanned = todayTasks.reduce((sum, t) => sum + (t.estimated_duration || 0), 0);
    const todayActual = todayTasks.reduce((sum, t) => sum + (t.time_spent || 0), 0);
    
    // תכנון vs ביצוע - השבוע
    const weekTasks = tasksWithTime.filter(t => {
      if (t.due_date) {
        const dueDate = new Date(t.due_date);
        return dueDate >= weekStart && dueDate <= weekEnd;
      }
      return false;
    });
    
    const weekPlanned = weekTasks.reduce((sum, t) => sum + (t.estimated_duration || 0), 0);
    const weekActual = weekTasks.reduce((sum, t) => sum + (t.time_spent || 0), 0);
    
    // משימות שהושלמו היום
    const completedToday = tasks.filter(t => {
      if (!t.is_completed || !t.completed_at) return false;
      const completedDate = startOfDay(new Date(t.completed_at));
      return isSameDay(completedDate, today);
    });
    
    // משימות שצריך היה להשלים היום (על פי due_date)
    const plannedToday = tasks.filter(t => {
      if (!t.due_date || t.is_completed) return false;
      const dueDate = startOfDay(new Date(t.due_date));
      return isSameDay(dueDate, today);
    });
    
    return {
      totalPlanned,
      totalActual,
      tasksWithBoth,
      accuracyStats,
      underestimated,
      overestimated,
      accurate,
      avgAccuracy,
      todayPlanned,
      todayActual,
      weekPlanned,
      weekActual,
      completedToday: completedToday.length,
      plannedToday: plannedToday.length,
      tasksWithTime
    };
  }, [tasks]);
  
  const formatTime = (minutes) => {
    if (minutes < 60) return `${minutes} דקות`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours} שעות ${mins} דקות` : `${hours} שעות`;
  };
  
  const getDiffColor = (diff) => {
    if (Math.abs(diff) < 10) return 'text-green-600 dark:text-green-400';
    if (Math.abs(diff) < 30) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };
  
  const getDiffBg = (diff) => {
    if (Math.abs(diff) < 10) return 'bg-green-100 dark:bg-green-900/20 border-green-300 dark:border-green-700';
    if (Math.abs(diff) < 30) return 'bg-yellow-100 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700';
    return 'bg-red-100 dark:bg-red-900/20 border-red-300 dark:border-red-700';
  };
  
  return (
    <div className="space-y-6">
      {/* כותרת */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          תכנון vs ביצוע
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          השוואה בין מה שתיכננת לעשות לבין מה שביצעת בפועל
        </p>
      </div>
      
      {/* סיכום כללי */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <span className="text-2xl">📅</span>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">זמן מתוכנן כולל</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {formatTime(comparison.totalPlanned)}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <span className="text-2xl">⏱️</span>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">זמן שבוצע כולל</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {formatTime(comparison.totalActual)}
              </p>
            </div>
          </div>
        </div>
        
        <div className={`rounded-xl shadow-sm border-2 p-4 ${getDiffBg(comparison.totalActual - comparison.totalPlanned)}`}>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg">
              <span className="text-2xl">📊</span>
            </div>
            <div>
              <p className="text-sm font-medium mb-1">הבדל</p>
              <p className={`text-xl font-bold ${getDiffColor(comparison.totalActual - comparison.totalPlanned)}`}>
                {comparison.totalActual >= comparison.totalPlanned ? '+' : ''}
                {formatTime(Math.abs(comparison.totalActual - comparison.totalPlanned))}
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* היום */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          היום ({format(new Date(), 'dd/MM/yyyy', { locale: he })})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">זמן מתוכנן</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {formatTime(comparison.todayPlanned)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">זמן שבוצע</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatTime(comparison.todayActual)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">משימות מתוכננות</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {comparison.plannedToday}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">משימות שהושלמו</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {comparison.completedToday}
            </p>
          </div>
        </div>
        {comparison.todayPlanned > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">התקדמות לפי זמן:</span>
              <span className={`font-bold ${getDiffColor(comparison.todayActual - comparison.todayPlanned)}`}>
                {Math.round((comparison.todayActual / comparison.todayPlanned) * 100)}%
              </span>
            </div>
            <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mt-2">
              <div
                className={`h-full transition-all duration-300 ${
                  comparison.todayActual >= comparison.todayPlanned
                    ? 'bg-green-500'
                    : comparison.todayActual >= comparison.todayPlanned * 0.8
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(100, (comparison.todayActual / comparison.todayPlanned) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>
      
      {/* השבוע */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          השבוע ({format(comparison.weekPlanned > 0 ? startOfWeek(new Date(), { weekStartsOn: 0 }) : new Date(), 'dd/MM', { locale: he })} - {format(endOfWeek(new Date(), { weekStartsOn: 0 }), 'dd/MM', { locale: he })})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">זמן מתוכנן</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {formatTime(comparison.weekPlanned)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">זמן שבוצע</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatTime(comparison.weekActual)}
            </p>
          </div>
        </div>
        {comparison.weekPlanned > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">התקדמות לפי זמן:</span>
              <span className={`font-bold ${getDiffColor(comparison.weekActual - comparison.weekPlanned)}`}>
                {Math.round((comparison.weekActual / comparison.weekPlanned) * 100)}%
              </span>
            </div>
            <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mt-2">
              <div
                className={`h-full transition-all duration-300 ${
                  comparison.weekActual >= comparison.weekPlanned
                    ? 'bg-green-500'
                    : comparison.weekActual >= comparison.weekPlanned * 0.8
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(100, (comparison.weekActual / comparison.weekPlanned) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>
      
      {/* דיוק בהערכות */}
      {comparison.accuracyStats.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            דיוק בהערכות זמן
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-700">
              <p className="text-sm text-green-700 dark:text-green-300 mb-1">מדויקות</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {comparison.accurate.length}
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                עד 20% הבדל
              </p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-700">
              <p className="text-sm text-red-700 dark:text-red-300 mb-1">העריכתי נמוך מדי</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {comparison.underestimated.length}
              </p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                ביצעת יותר מ-20% מהמשוער
              </p>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 border border-orange-200 dark:border-orange-700">
              <p className="text-sm text-orange-700 dark:text-orange-300 mb-1">העריכתי גבוה מדי</p>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {comparison.overestimated.length}
              </p>
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                ביצעת פחות מ-20% מהמשוער
              </p>
            </div>
          </div>
          
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">ממוצע דיוק</span>
              <span className={`text-lg font-bold ${
                comparison.avgAccuracy >= 80 ? 'text-green-600 dark:text-green-400' :
                comparison.avgAccuracy >= 60 ? 'text-yellow-600 dark:text-yellow-400' :
                'text-red-600 dark:text-red-400'
              }`}>
                {comparison.avgAccuracy}%
              </span>
            </div>
            <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  comparison.avgAccuracy >= 80 ? 'bg-green-500' :
                  comparison.avgAccuracy >= 60 ? 'bg-yellow-500' :
                  'bg-red-500'
                }`}
                style={{ width: `${comparison.avgAccuracy}%` }}
              />
            </div>
          </div>
          
          {/* משימות עם הערכות לא מדויקות */}
          {(comparison.underestimated.length > 0 || comparison.overestimated.length > 0) && (
            <div className="space-y-4">
              {comparison.underestimated.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-red-600 dark:text-red-400 mb-2">
                    הערכתי נמוך מדי - המשימות הבאות לקחו יותר זמן מהמשוער:
                  </h4>
                  <div className="space-y-2">
                    {comparison.underestimated.slice(0, 5).map(task => (
                      <div key={task.id} className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-gray-900 dark:text-white">{task.title}</span>
                          <span className="text-xs font-bold text-red-600 dark:text-red-400">
                            +{task.percentageDiff}%
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                          <span>תוכנן: {formatTime(task.estimated)}</span>
                          <span>בוצע: {formatTime(task.actual)}</span>
                          <span className="text-red-600 dark:text-red-400">
                            עודף: {formatTime(task.diff)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {comparison.overestimated.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-orange-600 dark:text-orange-400 mb-2">
                    הערכתי גבוה מדי - המשימות הבאות לקחו פחות זמן מהמשוער:
                  </h4>
                  <div className="space-y-2">
                    {comparison.overestimated.slice(0, 5).map(task => (
                      <div key={task.id} className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-700">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-gray-900 dark:text-white">{task.title}</span>
                          <span className="text-xs font-bold text-orange-600 dark:text-orange-400">
                            {task.percentageDiff}%
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                          <span>תוכנן: {formatTime(task.estimated)}</span>
                          <span>בוצע: {formatTime(task.actual)}</span>
                          <span className="text-orange-600 dark:text-orange-400">
                            חסכית: {formatTime(task.diff)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* כל המשימות - השוואה מפורטת */}
      {comparison.tasksWithBoth.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            השוואה מפורטת - כל המשימות
          </h3>
          <div className="space-y-3">
            {comparison.tasksWithBoth
              .sort((a, b) => Math.abs(b.percentageDiff) - Math.abs(a.percentageDiff))
              .map(task => {
                const diff = task.actual - task.estimated;
                return (
                  <div key={task.id} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900 dark:text-white">{task.title}</span>
                      <span className={`text-xs px-2 py-1 rounded font-bold ${
                        Math.abs(task.percentageDiff) <= 20
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                          : task.overEstimate
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                          : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                      }`}>
                        {task.overEstimate ? '+' : ''}{task.percentageDiff}%
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">תוכנן:</span>
                        <span className="ml-2 font-medium text-blue-600 dark:text-blue-400">
                          {formatTime(task.estimated)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">בוצע:</span>
                        <span className="ml-2 font-medium text-green-600 dark:text-green-400">
                          {formatTime(task.actual)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">הבדל:</span>
                        <span className={`ml-2 font-medium ${getDiffColor(diff)}`}>
                          {diff >= 0 ? '+' : ''}{formatTime(Math.abs(diff))}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">סטטוס:</span>
                        <span className={`ml-2 font-medium ${
                          task.is_completed 
                            ? 'text-green-600 dark:text-green-400' 
                            : 'text-blue-600 dark:text-blue-400'
                        }`}>
                          {task.is_completed ? 'הושלמה' : 'פעילה'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
      
      {/* הודעה אם אין נתונים */}
      {comparison.tasksWithTime.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <span className="text-4xl mb-4 block">📊</span>
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
            אין עדיין נתוני תכנון וביצוע
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            כדי לראות השוואה בין תכנון לביצוע, הוסיפי זמן משוער למשימות ועקבי אחר הזמן שבוצע
          </p>
          <div className="max-w-md mx-auto p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              💡 <strong>כיצד זה עובד:</strong><br/>
              1. הוסיפי זמן משוער למשימות (כמה זמן את חושבת שזה יקח)<br/>
              2. עקבי אחר הזמן שבוצע (עם טיימר או ידנית)<br/>
              3. המערכת תשווה ותראה לך אם הערכת נכון או לא<br/>
              4. תלמדי להיות יותר מדויקת בהערכות!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlanningVsExecution;


import { useState, useEffect, useMemo } from 'react';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../hooks/useAuth';
import { analyzeWorkPatterns } from '../../utils/smartRecommendations';
import { 
  getTimeManagementRecommendations, 
  getUserTaskTypeStats,
  predictTaskDuration 
} from '../../utils/taskTypeLearning';
import { format, isToday, addDays, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { he } from 'date-fns/locale';
import toast from 'react-hot-toast';

/**
 * המלצות לתכנון זמן - מערכת לומדת
 */
function TimePlanningRecommendations() {
  const { tasks, loadTasks } = useTasks();
  const { user } = useAuth();
  const [patterns, setPatterns] = useState(null);
  const [taskTypeStats, setTaskTypeStats] = useState([]);
  const [timeRecommendations, setTimeRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);

  // טעינת נתונים
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // ניתוח דפוסי עבודה
        if (tasks && tasks.length > 0) {
          const analysis = analyzeWorkPatterns(tasks, []);
          setPatterns(analysis);
        }

        // טעינת סטטיסטיקות למידה
        if (user?.id) {
          const stats = await getUserTaskTypeStats(user.id);
          setTaskTypeStats(stats || []);

          // המלצות לניהול זמן
          const recommendations = await getTimeManagementRecommendations(user.id);
          setTimeRecommendations(recommendations || []);
        }
      } catch (err) {
        console.error('שגיאה בטעינת המלצות:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [tasks, user?.id]);

  // משימות פעילות
  const activeTasks = useMemo(() => {
    return tasks?.filter(t => !t.is_completed && !t.is_project && !t.parent_task_id) || [];
  }, [tasks]);

  // משימות שיש להן תאריך יעד בשבוע הקרוב
  const upcomingTasks = useMemo(() => {
    const today = new Date();
    const weekEnd = addDays(today, 7);
    return activeTasks.filter(task => {
      if (!task.due_date) return false;
      const dueDate = new Date(task.due_date);
      return dueDate >= today && dueDate <= weekEnd;
    }).sort((a, b) => {
      const dateA = new Date(a.due_date);
      const dateB = new Date(b.due_date);
      return dateA - dateB;
    });
  }, [activeTasks]);

  // ניתוח עומס שבועי
  const weeklyLoad = useMemo(() => {
    if (!upcomingTasks.length) return null;

    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 0 });

    const loadByDay = {};
    upcomingTasks.forEach(task => {
      if (!task.due_date) return;
      const dueDate = new Date(task.due_date);
      if (isWithinInterval(dueDate, { start: weekStart, end: weekEnd })) {
        const dayKey = format(dueDate, 'EEEE', { locale: he });
        if (!loadByDay[dayKey]) {
          loadByDay[dayKey] = { count: 0, totalTime: 0 };
        }
        loadByDay[dayKey].count++;
        loadByDay[dayKey].totalTime += (task.estimated_duration || 0);
      }
    });

    return loadByDay;
  }, [upcomingTasks]);

  // המלצות על בסיס דפוסי עבודה
  const patternRecommendations = useMemo(() => {
    if (!patterns) return [];

    const recommendations = [];

    // שעות פרודוקטיביות
    if (patterns.hourPatterns) {
      const bestHours = Object.keys(patterns.hourPatterns)
        .map(hour => ({
          hour: parseInt(hour),
          score: patterns.hourPatterns[hour].productivity,
          count: patterns.hourPatterns[hour].count
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      if (bestHours.length > 0 && bestHours[0].count >= 3) {
        recommendations.push({
          type: 'productive_hours',
          priority: 'high',
          title: 'שעות פרודוקטיביות',
          message: `השעות הכי פרודוקטיביות שלך: ${bestHours.map(h => `${h.hour}:00`).join(', ')}`,
          details: `מומלץ לתכנן משימות חשובות בשעות אלו`
        });
      }
    }

    // ימים פרודוקטיביים
    if (patterns.dayPatterns) {
      const bestDays = Object.keys(patterns.dayPatterns)
        .map(day => ({
          day,
          score: patterns.dayPatterns[day].productivity,
          count: patterns.dayPatterns[day].count
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 2);

      if (bestDays.length > 0 && bestDays[0].count >= 3) {
        const dayNames = {
          'Sunday': 'ראשון',
          'Monday': 'שני',
          'Tuesday': 'שלישי',
          'Wednesday': 'רביעי',
          'Thursday': 'חמישי',
          'Friday': 'שישי',
          'Saturday': 'שבת'
        };

        recommendations.push({
          type: 'productive_days',
          priority: 'medium',
          title: 'ימים פרודוקטיביים',
          message: `הימים הכי פרודוקטיביים שלך: ${bestDays.map(d => dayNames[d.day]).join(', ')}`,
          details: `נצל את הימים האלה למשימות מורכבות וחשובות`
        });
      }
    }

    return recommendations;
  }, [patterns]);

  // המלצות על בסיס הערכות זמן
  const estimationRecommendations = useMemo(() => {
    if (!taskTypeStats.length) return [];

    const recommendations = [];

    taskTypeStats.forEach(stat => {
      // אם יש בעיה בדיוק הערכות
      if (stat.total_estimates >= 5 && stat.average_accuracy_percentage < 70) {
        recommendations.push({
          type: 'estimation_accuracy',
          priority: 'medium',
          title: 'שיפור הערכות זמן',
          message: `בסוג משימות "${stat.task_type}" אתה נוטה להעריך לא מדויק`,
          details: `הממוצע שלך: ${stat.average_accuracy_percentage}% דיוק. נסה להיות יותר שמרני בהערכות.`
        });
      }

      // אם יש ממוצע זמן טוב - להשתמש בו
      if (stat.completed_tasks >= 5 && stat.average_time > 0) {
        recommendations.push({
          type: 'use_average',
          priority: 'low',
          title: 'המלצה על זמן משוער',
          message: `לסוג משימות "${stat.task_type}" - זמן ממוצע: ${Math.round(stat.average_time)} דקות`,
          details: `המערכת למדה מההיסטוריה שלך - השתמש בזמן הזה כהנחיה`
        });
      }
    });

    return recommendations;
  }, [taskTypeStats]);

  // המלצות על בסיס עומס שבועי
  const workloadRecommendations = useMemo(() => {
    if (!weeklyLoad || Object.keys(weeklyLoad).length === 0) return [];

    const recommendations = [];
    const maxLoad = Math.max(...Object.values(weeklyLoad).map(d => d.count));

    // אם יש יום עמוס מדי
    Object.entries(weeklyLoad).forEach(([day, load]) => {
      if (load.count > 5 || load.totalTime > 480) {
        recommendations.push({
          type: 'overload',
          priority: 'high',
          title: 'עומס יתר',
          message: `יום ${day} עמוס מדי: ${load.count} משימות, ${Math.round(load.totalTime / 60)} שעות משוערות`,
          details: `מומלץ להזיז חלק מהמשימות לימים אחרים`
        });
      }
    });

    return recommendations;
  }, [weeklyLoad]);

  // שילוב כל ההמלצות
  const allRecommendations = useMemo(() => {
    return [
      ...patternRecommendations,
      ...estimationRecommendations,
      ...workloadRecommendations,
      ...timeRecommendations
    ].sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }, [patternRecommendations, estimationRecommendations, workloadRecommendations, timeRecommendations]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  // אם אין מספיק נתונים
  const completedTasks = tasks?.filter(t => t.is_completed) || [];
  if (completedTasks.length < 5) {
    return (
      <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <span className="text-4xl mb-4 block">🧠</span>
        <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
          המערכת עדיין לומדת
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          השלמי עוד {5 - completedTasks.length} משימות כדי לקבל המלצות מותאמות
        </p>
        <div className="max-w-md mx-auto p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            💡 <strong>איך המערכת לומדת:</strong><br/>
            1. המערכת בודקת מתי אתה הכי פרודוקטיבי<br/>
            2. היא לומדת כמה זמן באמת לוקח לך כל סוג משימה<br/>
            3. היא מנתחת את הדפוסים שלך ומציעה מתי לעבוד על מה<br/>
            4. ככל שתתני יותר משימות, ההמלצות יהיו יותר מדויקות
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* כותרת */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          המלצות לתכנון זמן
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          המלצות חכמות מותאמות אישית על בסיס דפוסי העבודה שלך
        </p>
      </div>

      {/* סטטיסטיקות למידה */}
      {taskTypeStats.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            מה המערכת למדה עלייך
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {taskTypeStats.slice(0, 6).map(stat => (
              <div key={stat.id} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="font-medium text-gray-900 dark:text-white mb-2">
                  {stat.task_type}
                </div>
                <div className="space-y-1 text-sm">
                  <div className="text-gray-600 dark:text-gray-400">
                    {stat.completed_tasks} משימות הושלמו
                  </div>
                  {stat.average_time > 0 && (
                    <div className="text-gray-600 dark:text-gray-400">
                      זמן ממוצע: {Math.round(stat.average_time)} דקות
                    </div>
                  )}
                  {stat.total_estimates > 0 && (
                    <div className="text-gray-600 dark:text-gray-400">
                      דיוק הערכות: {stat.average_accuracy_percentage}%
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* המלצות */}
      {allRecommendations.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            המלצות עבורך
          </h3>
          {allRecommendations.map((rec, index) => (
            <div
              key={index}
              className={`p-4 rounded-xl border-2 ${
                rec.priority === 'high'
                  ? 'border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-700'
                  : rec.priority === 'medium'
                  ? 'border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700'
                  : 'border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl">
                  {rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🔵'}
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-gray-900 dark:text-white mb-1">
                    {rec.title}
                  </h4>
                  <p className="text-gray-700 dark:text-gray-300 mb-1">
                    {rec.message}
                  </p>
                  {rec.details && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {rec.details}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <span className="text-4xl mb-4 block">✅</span>
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
            הכל נראה טוב!
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            אין המלצות מיוחדות כרגע. המשיכי לעבוד והמערכת תמשיך ללמוד
          </p>
        </div>
      )}

      {/* תצוגת עומס שבועי */}
      {weeklyLoad && Object.keys(weeklyLoad).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            עומס השבוע הקרוב
          </h3>
          <div className="space-y-3">
            {Object.entries(weeklyLoad).map(([day, load]) => (
              <div key={day} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">{day}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {load.count} משימות • {Math.round(load.totalTime / 60)} שעות משוערות
                  </div>
                </div>
                <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      load.count > 5 || load.totalTime > 480
                        ? 'bg-red-500'
                        : load.count > 3 || load.totalTime > 240
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(100, (load.totalTime / 480) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* משימות קרבות עם המלצות */}
      {upcomingTasks.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            המלצות למשימות הקרובות
          </h3>
          <div className="space-y-3">
            {upcomingTasks.slice(0, 5).map(task => {
              // חיזוי זמן אופטימלי
              let recommendedTime = null;
              if (user?.id && task.task_type) {
                // נשתמש בסטטיסטיקות אם יש
                const stat = taskTypeStats.find(s => s.task_type === task.task_type);
                if (stat && stat.average_time > 0) {
                  recommendedTime = stat.average_time;
                }
              }

              return (
                <div key={task.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                        {task.title}
                      </h4>
                      <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        {task.due_date && (
                          <div>📅 תאריך יעד: {format(new Date(task.due_date), 'dd/MM/yyyy', { locale: he })}</div>
                        )}
                        {recommendedTime && (
                          <div className="text-blue-600 dark:text-blue-400">
                            💡 המלצת זמן: {Math.round(recommendedTime)} דקות (על בסיס ניסיון קודם)
                          </div>
                        )}
                        {task.estimated_duration && recommendedTime && (
                          <div className={`text-sm ${
                            Math.abs(task.estimated_duration - recommendedTime) > recommendedTime * 0.2
                              ? 'text-orange-600 dark:text-orange-400'
                              : 'text-green-600 dark:text-green-400'
                          }`}>
                            {task.estimated_duration > recommendedTime * 1.2
                              ? `⚠️ הערכת יתר - בדרך כלל לוקח ${Math.round(recommendedTime)} דקות`
                              : task.estimated_duration < recommendedTime * 0.8
                              ? `⚠️ הערכת חסר - בדרך כלל לוקח ${Math.round(recommendedTime)} דקות`
                              : '✅ הערכה טובה'
                            }
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default TimePlanningRecommendations;


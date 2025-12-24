import { useState, useEffect, useMemo } from 'react';
import { useTasks } from '../../hooks/useTasks';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, subWeeks, addWeeks } from 'date-fns';
import { he } from 'date-fns/locale';
import Button from '../UI/Button';

/**
 * מעקב הרגלים - מתי הכי פרודוקטיבי
 */
function HabitTracker() {
  const { tasks } = useTasks();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedMetric, setSelectedMetric] = useState('productivity'); // productivity, time, tasks

  // חישוב ימי השבוע
  const weekDays = useMemo(() => {
    const weekStart = startOfWeek(currentWeek, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: weekStart, end: weekEnd });
  }, [currentWeek]);

  // ניתוח הרגלים
  const habitsAnalysis = useMemo(() => {
    if (!tasks || tasks.length === 0) {
      console.log('📊 Habits: אין משימות');
      return null;
    }

    const completedTasks = tasks.filter(t => {
      const isCompleted = t.is_completed;
      const hasCompletedAt = t.completed_at && t.completed_at !== null;
      if (isCompleted && !hasCompletedAt) {
        console.warn('⚠️ משימה הושלמה אבל אין completed_at:', t.title);
      }
      return isCompleted && hasCompletedAt;
    });
    
    console.log(`📊 Habits: מצאתי ${completedTasks.length} משימות שהושלמו מתוך ${tasks.length}`);
    
    if (completedTasks.length === 0) {
      console.log('📊 Habits: אין משימות שהושלמו');
      return null;
    }
    
    // ניתוח לפי שעות
    const hourStats = {};
    completedTasks.forEach(task => {
      if (!task.completed_at) return;
      try {
        const completedDate = new Date(task.completed_at);
        if (isNaN(completedDate.getTime())) {
          console.warn('⚠️ תאריך לא תקין:', task.completed_at);
          return;
        }
        const hour = completedDate.getHours();
        if (!hourStats[hour]) {
          hourStats[hour] = { count: 0, totalTime: 0, tasks: [] };
        }
        hourStats[hour].count++;
        hourStats[hour].totalTime += task.time_spent || 0;
        hourStats[hour].tasks.push(task);
      } catch (err) {
        console.error('שגיאה בניתוח משימה:', err, task);
      }
    });

    // ניתוח לפי ימים
    const dayStats = {};
    const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    completedTasks.forEach(task => {
      if (!task.completed_at) return;
      const dayIndex = new Date(task.completed_at).getDay();
      const dayName = dayNames[dayIndex];
      if (!dayStats[dayName]) {
        dayStats[dayName] = { count: 0, totalTime: 0, tasks: [] };
      }
      dayStats[dayName].count++;
      dayStats[dayName].totalTime += task.time_spent || 0;
      dayStats[dayName].tasks.push(task);
    });

    // ניתוח לפי שבועות
    const weeklyStats = [];
    const weeksBack = 8;
    for (let i = 0; i < weeksBack; i++) {
      const weekStart = startOfWeek(subWeeks(new Date(), i), { weekStartsOn: 0 });
      const weekEnd = endOfWeek(subWeeks(new Date(), i), { weekStartsOn: 0 });
      
      const weekTasks = completedTasks.filter(task => {
        if (!task.completed_at) return false;
        const taskDate = new Date(task.completed_at);
        return taskDate >= weekStart && taskDate <= weekEnd;
      });

      weeklyStats.push({
        week: format(weekStart, 'dd/MM', { locale: he }),
        count: weekTasks.length,
        totalTime: weekTasks.reduce((sum, t) => sum + (t.time_spent || 0), 0),
        tasks: weekTasks
      });
    }

    // מציאת דפוסים
    const peakHours = Object.keys(hourStats)
      .map(hour => ({
        hour: parseInt(hour),
        score: hourStats[hour].count * 2 + (hourStats[hour].totalTime / 10)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    const peakDays = Object.keys(dayStats)
      .map(day => ({
        day,
        score: dayStats[day].count * 2 + (dayStats[day].totalTime / 10)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 2);

    return {
      hourStats,
      dayStats,
      weeklyStats,
      peakHours,
      peakDays,
      totalCompleted: completedTasks.length,
      totalTime: completedTasks.reduce((sum, t) => sum + (t.time_spent || 0), 0)
    };
  }, [tasks]);

  // חישוב ציון פרודוקטיביות ליום
  const getDayProductivity = (day) => {
    if (!habitsAnalysis) return 0;
    
    const dayName = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][day.getDay()];
    const stats = habitsAnalysis.dayStats[dayName];
    
    if (!stats) return 0;
    
    // ציון מבוסס על כמות משימות וזמן
    return Math.min(100, Math.round((stats.count * 10) + (stats.totalTime / 5)));
  };

  if (!habitsAnalysis || habitsAnalysis.totalCompleted === 0) {
    const totalTasks = tasks?.length || 0;
    const completedCount = tasks?.filter(t => t.is_completed)?.length || 0;
    
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <span className="text-4xl mb-4 block">📊</span>
        <p className="text-lg font-medium mb-2">אין מספיק נתונים למעקב הרגלים</p>
        <p className="text-sm mt-2">
          {completedCount > 0 
            ? `יש לך ${completedCount} משימות שהושלמו, אבל חסרים נתוני זמן השלמה.`
            : 'השלימי משימות והגדירי את זמן ההשלמה כדי לראות את הדפוסים שלך.'
          }
        </p>
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg max-w-md mx-auto">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            💡 <strong>טיפ:</strong> כשאת מסיימת משימה, לחצי על ✓ כדי לסמן אותה כהושלמה. 
            המערכת תשמור מתי סיימת ותלמד את הדפוסים שלך!
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
          מעקב הרגלים
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          מתי הכי פרודוקטיבי? מה הדפוסים שלך?
        </p>
      </div>

      {/* סיכום כללי */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <span className="text-2xl">✅</span>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">משימות שהושלמו</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {habitsAnalysis.totalCompleted}
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
              <p className="text-sm text-gray-500 dark:text-gray-400">זמן כולל</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {Math.round(habitsAnalysis.totalTime / 60)} שעות
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <span className="text-2xl">📈</span>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">ממוצע לשבוע</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {Math.round(habitsAnalysis.totalCompleted / 8)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* שעות שיא */}
      {habitsAnalysis.peakHours.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            השעות הכי פרודוקטיביות שלך
          </h3>
          <div className="space-y-3">
            {habitsAnalysis.peakHours.map(({ hour, score }, index) => {
              const stats = habitsAnalysis.hourStats[hour];
              const percentage = Math.min(100, (score / habitsAnalysis.peakHours[0].score) * 100);
              
              return (
                <div key={hour} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        #{index + 1}
                      </span>
                      <span className="text-lg font-medium text-gray-900 dark:text-white">
                        {hour}:00
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {stats.count} משימות • {Math.round(stats.totalTime / 60)} שעות
                    </div>
                  </div>
                  <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ימים שיא */}
      {habitsAnalysis.peakDays.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            הימים הכי פרודוקטיביים שלך
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {habitsAnalysis.peakDays.map(({ day, score }, index) => {
              const stats = habitsAnalysis.dayStats[day];
              const percentage = Math.min(100, (score / habitsAnalysis.peakDays[0].score) * 100);
              
              return (
                <div
                  key={day}
                  className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg border border-green-200 dark:border-green-700"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-green-600 dark:text-green-400">
                        #{index + 1}
                      </span>
                      <span className="text-lg font-medium text-gray-900 dark:text-white">
                        {day}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-gray-600 dark:text-gray-400">
                      {Math.round(percentage)}%
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {stats.count} משימות • {Math.round(stats.totalTime / 60)} שעות
                  </div>
                  <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* מגמה שבועית */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          מגמה שבועית (8 שבועות אחרונים)
        </h3>
        <div className="space-y-3">
          {habitsAnalysis.weeklyStats.reverse().map((week, index) => {
            const maxCount = Math.max(...habitsAnalysis.weeklyStats.map(w => w.count));
            const percentage = maxCount > 0 ? (week.count / maxCount) * 100 : 0;
            
            return (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    שבוע {week.week}
                  </span>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {week.count} משימות • {Math.round(week.totalTime / 60)} שעות
                  </div>
                </div>
                <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* תובנות */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-700 p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          💡 תובנות
        </h3>
        <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          {habitsAnalysis.peakHours.length > 0 && (
            <p>
              • השעות הכי פרודוקטיביות שלך הן {habitsAnalysis.peakHours.map(h => `${h.hour}:00`).join(', ')} - 
              נסי לתכנן משימות חשובות לשעות האלה
            </p>
          )}
          {habitsAnalysis.peakDays.length > 0 && (
            <p>
              • {habitsAnalysis.peakDays[0].day} הוא היום הכי פרודוקטיבי שלך - 
              נסי לנצל אותו למשימות מורכבות
            </p>
          )}
          {habitsAnalysis.weeklyStats.length > 0 && (
            <p>
              • ממוצע של {Math.round(habitsAnalysis.totalCompleted / habitsAnalysis.weeklyStats.length)} משימות לשבוע - 
              {habitsAnalysis.totalCompleted / habitsAnalysis.weeklyStats.length > 5 
                ? 'את עובדת בקצב טוב!' 
                : 'יש מקום לשיפור'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default HabitTracker;


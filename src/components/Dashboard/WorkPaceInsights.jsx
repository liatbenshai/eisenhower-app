import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TASK_TYPES } from '../../config/taskTypes';

/**
 * תובנות על קצב העבודה
 * מנתח דפוסי עבודה ומציע שיפורים
 */
function WorkPaceInsights({ tasks }) {
  // ניתוח משימות שהושלמו
  const insights = useMemo(() => {
    const completedTasks = tasks.filter(t => t.is_completed && t.time_spent > 0);
    
    if (completedTasks.length < 5) {
      return {
        hasEnoughData: false,
        message: 'צריך לפחות 5 משימות שהושלמו עם מעקב זמן כדי לנתח את קצב העבודה'
      };
    }

    // ניתוח דיוק הערכות לפי סוג משימה
    const byType = {};
    completedTasks.forEach(task => {
      const type = task.task_type || 'other';
      if (!byType[type]) {
        byType[type] = {
          tasks: [],
          totalEstimated: 0,
          totalActual: 0
        };
      }
      byType[type].tasks.push(task);
      byType[type].totalEstimated += task.estimated_duration || 30;
      byType[type].totalActual += task.time_spent;
    });

    // חישוב יחס הערכה לכל סוג
    const typeAnalysis = Object.entries(byType).map(([type, data]) => {
      const ratio = data.totalEstimated > 0 
        ? data.totalActual / data.totalEstimated 
        : 1;
      const accuracy = Math.round(100 / Math.max(ratio, 1/ratio));
      
      return {
        type,
        typeName: TASK_TYPES[type]?.name || type,
        typeIcon: TASK_TYPES[type]?.icon || '📋',
        taskCount: data.tasks.length,
        totalEstimated: data.totalEstimated,
        totalActual: data.totalActual,
        ratio,
        accuracy,
        recommendation: ratio > 1.2 
          ? 'הוסף 20% לזמן המשוער'
          : ratio < 0.8 
            ? 'אתה מהיר יותר ממה שחשבת!'
            : 'הערכות מדויקות'
      };
    }).sort((a, b) => b.taskCount - a.taskCount);

    // ניתוח שעות פרודוקטיביות
    const hourlyProductivity = {};
    completedTasks.forEach(task => {
      if (task.completed_at) {
        const hour = new Date(task.completed_at).getHours();
        if (!hourlyProductivity[hour]) {
          hourlyProductivity[hour] = { count: 0, totalTime: 0 };
        }
        hourlyProductivity[hour].count++;
        hourlyProductivity[hour].totalTime += task.time_spent;
      }
    });

    // מציאת שעות הכי פרודוקטיביות
    const productiveHours = Object.entries(hourlyProductivity)
      .map(([hour, data]) => ({
        hour: parseInt(hour),
        count: data.count,
        avgTime: Math.round(data.totalTime / data.count)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    // ניתוח ימים
    const dayProductivity = {};
    const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    completedTasks.forEach(task => {
      if (task.completed_at) {
        const day = new Date(task.completed_at).getDay();
        if (!dayProductivity[day]) {
          dayProductivity[day] = { count: 0, totalTime: 0 };
        }
        dayProductivity[day].count++;
        dayProductivity[day].totalTime += task.time_spent;
      }
    });

    const productiveDays = Object.entries(dayProductivity)
      .map(([day, data]) => ({
        day: parseInt(day),
        dayName: dayNames[parseInt(day)],
        count: data.count,
        totalTime: data.totalTime
      }))
      .sort((a, b) => b.count - a.count);

    // ניתוח מגמות
    const recentTasks = completedTasks
      .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))
      .slice(0, 10);
    
    const olderTasks = completedTasks
      .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))
      .slice(10, 20);

    let trend = null;
    if (recentTasks.length >= 5 && olderTasks.length >= 5) {
      const recentAccuracy = recentTasks.reduce((sum, t) => {
        const ratio = (t.estimated_duration || 30) / (t.time_spent || 30);
        return sum + Math.min(100, ratio * 100);
      }, 0) / recentTasks.length;

      const olderAccuracy = olderTasks.reduce((sum, t) => {
        const ratio = (t.estimated_duration || 30) / (t.time_spent || 30);
        return sum + Math.min(100, ratio * 100);
      }, 0) / olderTasks.length;

      const improvement = recentAccuracy - olderAccuracy;
      trend = {
        improving: improvement > 5,
        declining: improvement < -5,
        stable: Math.abs(improvement) <= 5,
        changePercent: Math.round(improvement)
      };
    }

    // סיכום כללי
    const totalEstimated = completedTasks.reduce((sum, t) => sum + (t.estimated_duration || 30), 0);
    const totalActual = completedTasks.reduce((sum, t) => sum + (t.time_spent || 0), 0);
    const overallAccuracy = Math.round((Math.min(totalEstimated, totalActual) / Math.max(totalEstimated, totalActual)) * 100);

    return {
      hasEnoughData: true,
      taskCount: completedTasks.length,
      totalTimeTracked: totalActual,
      overallAccuracy,
      typeAnalysis,
      productiveHours,
      productiveDays,
      trend,
      bestType: typeAnalysis.find(t => t.accuracy >= 80),
      worstType: typeAnalysis.find(t => t.accuracy < 60)
    };
  }, [tasks]);

  // פורמט זמן
  const formatTime = (minutes) => {
    if (!minutes) return '0';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} דק'`;
    if (mins === 0) return `${hours} שעות`;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  };

  if (!insights.hasEnoughData) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-6"
      >
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          💡 תובנות על קצב העבודה
        </h3>
        <div className="text-center py-8">
          <span className="text-4xl block mb-4">📊</span>
          <p className="text-gray-600 dark:text-gray-400">{insights.message}</p>
          <p className="text-sm text-gray-500 mt-2">
            המשיכי לעבוד עם הטיימר כדי לצבור נתונים
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-6"
    >
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
        💡 תובנות על קצב העבודה
      </h3>

      {/* סיכום כללי */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {insights.taskCount}
          </div>
          <div className="text-xs text-blue-700 dark:text-blue-300">משימות נותחו</div>
        </div>
        <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {formatTime(insights.totalTimeTracked)}
          </div>
          <div className="text-xs text-green-700 dark:text-green-300">זמן מעקב</div>
        </div>
        <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
          <div className={`text-2xl font-bold ${
            insights.overallAccuracy >= 80 ? 'text-green-600 dark:text-green-400' :
            insights.overallAccuracy >= 60 ? 'text-yellow-600 dark:text-yellow-400' :
            'text-red-600 dark:text-red-400'
          }`}>
            {insights.overallAccuracy}%
          </div>
          <div className="text-xs text-purple-700 dark:text-purple-300">דיוק כללי</div>
        </div>
      </div>

      {/* מגמה */}
      {insights.trend && (
        <div className={`p-3 rounded-lg mb-4 ${
          insights.trend.improving 
            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700'
            : insights.trend.declining
              ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700'
              : 'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-xl">
              {insights.trend.improving ? '📈' : insights.trend.declining ? '📉' : '➡️'}
            </span>
            <div>
              <div className={`text-sm font-medium ${
                insights.trend.improving ? 'text-green-700 dark:text-green-300' :
                insights.trend.declining ? 'text-red-700 dark:text-red-300' :
                'text-gray-700 dark:text-gray-300'
              }`}>
                {insights.trend.improving 
                  ? 'משתפר!' 
                  : insights.trend.declining 
                    ? 'שים לב לירידה'
                    : 'יציב'}
              </div>
              <div className="text-xs text-gray-500">
                {Math.abs(insights.trend.changePercent)}% 
                {insights.trend.improving ? 'שיפור' : insights.trend.declining ? 'ירידה' : ''} 
                בדיוק ההערכות
              </div>
            </div>
          </div>
        </div>
      )}

      {/* שעות פרודוקטיביות */}
      {insights.productiveHours.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            ⏰ השעות הכי פרודוקטיביות
          </h4>
          <div className="flex gap-2">
            {insights.productiveHours.map(({ hour, count }) => (
              <div 
                key={hour}
                className="flex-1 text-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg"
              >
                <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {hour}:00
                </div>
                <div className="text-xs text-blue-700 dark:text-blue-300">
                  {count} משימות
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ימים פרודוקטיביים */}
      {insights.productiveDays.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            📅 הימים הכי פרודוקטיביים
          </h4>
          <div className="flex gap-2">
            {insights.productiveDays.slice(0, 3).map(({ dayName, count, totalTime }) => (
              <div 
                key={dayName}
                className="flex-1 text-center p-2 bg-green-50 dark:bg-green-900/20 rounded-lg"
              >
                <div className="text-sm font-bold text-green-600 dark:text-green-400">
                  {dayName}
                </div>
                <div className="text-xs text-green-700 dark:text-green-300">
                  {count} משימות
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ניתוח לפי סוג */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          📊 דיוק לפי סוג משימה
        </h4>
        <div className="space-y-2">
          {insights.typeAnalysis.slice(0, 4).map(type => (
            <div 
              key={type.type}
              className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg"
            >
              <div className="flex items-center gap-2">
                <span>{type.typeIcon}</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">{type.typeName}</span>
              </div>
              <div className="text-left">
                <div className={`text-sm font-medium ${
                  type.accuracy >= 80 ? 'text-green-600' :
                  type.accuracy >= 60 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {type.accuracy}%
                </div>
                <div className="text-xs text-gray-500">{type.recommendation}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export default WorkPaceInsights;

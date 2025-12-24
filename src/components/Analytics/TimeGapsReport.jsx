import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TASK_TYPES } from '../../config/taskTypes';

/**
 * דוח פערים שבועי - "איפה הזמן הלך?"
 * מציג את הפער בין הערכות לביצוע בפועל
 */
function TimeGapsReport({ tasks, onClose }) {
  const [period, setPeriod] = useState('week'); // week, month

  // ניתוח הפערים
  const analysis = useMemo(() => {
    const now = new Date();
    const periodStart = new Date();
    
    if (period === 'week') {
      periodStart.setDate(now.getDate() - 7);
    } else {
      periodStart.setMonth(now.getMonth() - 1);
    }

    // רק משימות שהושלמו בתקופה
    const completedTasks = tasks.filter(t => {
      if (!t.is_completed || !t.completed_at) return false;
      const completedDate = new Date(t.completed_at);
      return completedDate >= periodStart && completedDate <= now;
    });

    // ניתוח לפי סוג
    const byType = {};
    let totalEstimated = 0;
    let totalActual = 0;

    completedTasks.forEach(t => {
      const type = t.task_type || 'other';
      const estimated = t.estimated_duration || 30;
      const actual = t.time_spent || estimated;

      if (!byType[type]) {
        byType[type] = {
          estimated: 0,
          actual: 0,
          count: 0,
          tasks: []
        };
      }

      byType[type].estimated += estimated;
      byType[type].actual += actual;
      byType[type].count++;
      byType[type].tasks.push(t);

      totalEstimated += estimated;
      totalActual += actual;
    });

    // חישוב פער ומיון
    const typeGaps = Object.entries(byType).map(([type, data]) => {
      const gap = data.actual - data.estimated;
      const gapPercent = data.estimated > 0 ? Math.round((gap / data.estimated) * 100) : 0;
      
      return {
        type,
        ...data,
        gap,
        gapPercent,
        isOver: gap > 0
      };
    }).sort((a, b) => Math.abs(b.gapPercent) - Math.abs(a.gapPercent));

    // זיהוי בעיות
    const problems = typeGaps.filter(t => Math.abs(t.gapPercent) > 30);
    const biggestOverrun = typeGaps.find(t => t.gapPercent > 0);
    const biggestUnderrun = typeGaps.find(t => t.gapPercent < 0);

    return {
      completedCount: completedTasks.length,
      totalEstimated,
      totalActual,
      totalGap: totalActual - totalEstimated,
      totalGapPercent: totalEstimated > 0 ? Math.round(((totalActual - totalEstimated) / totalEstimated) * 100) : 0,
      typeGaps,
      problems,
      biggestOverrun,
      biggestUnderrun
    };
  }, [tasks, period]);

  // פורמט זמן
  const formatTime = (minutes) => {
    if (!minutes) return '0 דק\'';
    const hours = Math.floor(Math.abs(minutes) / 60);
    const mins = Math.abs(minutes) % 60;
    const sign = minutes < 0 ? '-' : '';
    if (hours === 0) return `${sign}${mins} דק'`;
    if (mins === 0) return `${sign}${hours} שעות`;
    return `${sign}${hours}:${mins.toString().padStart(2, '0')}`;
  };

  // בר התקדמות עם פער
  const GapBar = ({ estimated, actual }) => {
    const maxValue = Math.max(estimated, actual);
    const estimatedWidth = (estimated / maxValue) * 100;
    const actualWidth = (actual / maxValue) * 100;
    const isOver = actual > estimated;

    return (
      <div className="relative h-6 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        {/* הערכה */}
        <div 
          className="absolute top-0 h-full bg-blue-200 dark:bg-blue-900 rounded-full"
          style={{ width: `${estimatedWidth}%` }}
        />
        {/* ביצוע */}
        <div 
          className={`absolute top-0 h-full rounded-full ${isOver ? 'bg-red-400' : 'bg-green-400'}`}
          style={{ width: `${actualWidth}%`, opacity: 0.8 }}
        />
        {/* תוויות */}
        <div className="absolute inset-0 flex items-center justify-between px-2 text-xs font-medium">
          <span className="text-gray-600 dark:text-gray-300">תכנון: {formatTime(estimated)}</span>
          <span className={isOver ? 'text-red-700' : 'text-green-700'}>בפועל: {formatTime(actual)}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden max-w-2xl mx-auto max-h-[90vh] overflow-y-auto">
      {/* כותרת */}
      <div className="bg-gradient-to-l from-purple-500 to-indigo-600 p-6 text-white sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">📈 איפה הזמן הלך?</h2>
            <p className="text-purple-100 mt-1">ניתוח פערים בין תכנון לביצוע</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full">✕</button>
        </div>

        {/* בחירת תקופה */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setPeriod('week')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              period === 'week' ? 'bg-white text-purple-600' : 'bg-white/20 hover:bg-white/30'
            }`}
          >
            שבוע אחרון
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              period === 'month' ? 'bg-white text-purple-600' : 'bg-white/20 hover:bg-white/30'
            }`}
          >
            חודש אחרון
          </button>
        </div>
      </div>

      <div className="p-6">
        {analysis.completedCount === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <span className="text-4xl">📭</span>
            <p className="mt-4">אין מספיק נתונים לניתוח</p>
            <p className="text-sm">סמני משימות כהושלמו כדי לראות את הניתוח</p>
          </div>
        ) : (
          <>
            {/* סיכום כללי */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <div className="text-2xl font-bold text-blue-600">{analysis.completedCount}</div>
                <div className="text-xs text-blue-700 dark:text-blue-300">משימות הושלמו</div>
              </div>
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <div className="text-2xl font-bold text-gray-700 dark:text-gray-200">
                  {formatTime(analysis.totalEstimated)}
                </div>
                <div className="text-xs text-gray-500">תכננת</div>
              </div>
              <div className={`text-center p-4 rounded-xl ${
                analysis.totalGap > 0 
                  ? 'bg-red-50 dark:bg-red-900/20' 
                  : 'bg-green-50 dark:bg-green-900/20'
              }`}>
                <div className={`text-2xl font-bold ${
                  analysis.totalGap > 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {formatTime(analysis.totalActual)}
                </div>
                <div className={`text-xs ${analysis.totalGap > 0 ? 'text-red-700' : 'text-green-700'}`}>
                  עבדת ({analysis.totalGapPercent > 0 ? '+' : ''}{analysis.totalGapPercent}%)
                </div>
              </div>
            </div>

            {/* תובנות חשובות */}
            {analysis.problems.length > 0 && (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl mb-6 border border-amber-200 dark:border-amber-700">
                <h4 className="font-bold text-amber-800 dark:text-amber-200 mb-2">💡 תובנות חשובות</h4>
                <ul className="space-y-2 text-sm text-amber-700 dark:text-amber-300">
                  {analysis.biggestOverrun && (
                    <li className="flex items-start gap-2">
                      <span>⚠️</span>
                      <span>
                        <strong>{TASK_TYPES[analysis.biggestOverrun.type]?.name}</strong> לוקחים 
                        <strong> {analysis.biggestOverrun.gapPercent}% יותר </strong>
                        מהמתוכנן - שקלי להגדיל הערכות
                      </span>
                    </li>
                  )}
                  {analysis.biggestUnderrun && Math.abs(analysis.biggestUnderrun.gapPercent) > 20 && (
                    <li className="flex items-start gap-2">
                      <span>✨</span>
                      <span>
                        <strong>{TASK_TYPES[analysis.biggestUnderrun.type]?.name}</strong> לוקחים 
                        <strong> {Math.abs(analysis.biggestUnderrun.gapPercent)}% פחות </strong>
                        - את מעריכה יותר מדי
                      </span>
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* פירוט לפי סוג */}
            <h4 className="font-bold text-gray-900 dark:text-white mb-3">פירוט לפי סוג משימה</h4>
            <div className="space-y-4">
              {analysis.typeGaps.map(item => {
                const taskType = TASK_TYPES[item.type] || TASK_TYPES.other;
                
                return (
                  <div key={item.type} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-10 h-10 ${taskType.bg} rounded-lg flex items-center justify-center text-white text-lg`}>
                          {taskType.icon}
                        </span>
                        <div>
                          <div className="font-bold text-gray-900 dark:text-white">{taskType.name}</div>
                          <div className="text-xs text-gray-500">{item.count} משימות</div>
                        </div>
                      </div>
                      <div className={`text-lg font-bold ${
                        item.gapPercent > 20 ? 'text-red-500' : 
                        item.gapPercent < -20 ? 'text-green-500' : 'text-gray-500'
                      }`}>
                        {item.gapPercent > 0 ? '+' : ''}{item.gapPercent}%
                      </div>
                    </div>
                    <GapBar estimated={item.estimated} actual={item.actual} />
                  </div>
                );
              })}
            </div>

            {/* המלצות */}
            {analysis.totalGapPercent > 20 && (
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-700">
                <h4 className="font-bold text-blue-800 dark:text-blue-200 mb-2">📌 המלצות</h4>
                <ul className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
                  <li>• הוסיפי 20% לכל הערכת זמן</li>
                  <li>• תכנני פחות משימות ליום</li>
                  <li>• השאירי זמן buffer בין משימות</li>
                </ul>
              </div>
            )}
          </>
        )}
      </div>

      {/* סגירה */}
      <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 sticky bottom-0">
        <button
          onClick={onClose}
          className="w-full py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors"
        >
          סגור
        </button>
      </div>
    </div>
  );
}

export default TimeGapsReport;

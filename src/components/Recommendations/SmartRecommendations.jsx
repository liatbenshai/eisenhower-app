import { useState, useEffect, useMemo } from 'react';
import { useTasks } from '../../hooks/useTasks';
import { analyzeWorkPatterns, getTaskRecommendations } from '../../utils/smartRecommendations';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import Button from '../UI/Button';

/**
 * המלצות חכמות - מתי לעבוד על מה
 */
function SmartRecommendations() {
  const { tasks } = useTasks();
  const [patterns, setPatterns] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskRecommendations, setTaskRecommendations] = useState([]);

  // ניתוח דפוסי עבודה
  useEffect(() => {
    if (tasks && tasks.length > 0) {
      const analysis = analyzeWorkPatterns(tasks, []);
      setPatterns(analysis);
    }
  }, [tasks]);

  // המלצות למשימה ספציפית
  useEffect(() => {
    if (selectedTask && patterns) {
      const recommendations = getTaskRecommendations(tasks, selectedTask, patterns);
      setTaskRecommendations(recommendations);
    }
  }, [selectedTask, patterns, tasks]);

  // מציאת השעות הכי פרודוקטיביות
  const bestHours = useMemo(() => {
    if (!patterns?.hourPatterns) return [];
    
    return Object.keys(patterns.hourPatterns)
      .map(hour => ({
        hour: parseInt(hour),
        score: patterns.hourPatterns[hour].productivity,
        count: patterns.hourPatterns[hour].count
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [patterns]);

  // מציאת הימים הכי פרודוקטיביים
  const bestDays = useMemo(() => {
    if (!patterns?.dayPatterns) return [];
    
    const dayNames = {
      'Sunday': 'ראשון',
      'Monday': 'שני',
      'Tuesday': 'שלישי',
      'Wednesday': 'רביעי',
      'Thursday': 'חמישי',
      'Friday': 'שישי',
      'Saturday': 'שבת'
    };
    
    return Object.keys(patterns.dayPatterns)
      .map(day => ({
        day,
        dayName: dayNames[day],
        score: patterns.dayPatterns[day].productivity,
        count: patterns.dayPatterns[day].count
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [patterns]);

  // משימות פעילות
  const activeTasks = tasks?.filter(t => !t.is_completed) || [];

  if (!patterns) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <span className="text-4xl mb-4 block">📊</span>
        <p>אין מספיק נתונים להמלצות</p>
        <p className="text-sm mt-2">השלמי כמה משימות כדי לקבל המלצות מותאמות</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* כותרת */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          המלצות חכמות
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          המלצות מותאמות לפי דפוסי העבודה שלך
        </p>
      </div>

      {/* המלצות כלליות */}
      {patterns.recommendations && patterns.recommendations.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            המלצות כלליות
          </h3>
          <div className="space-y-3">
            {patterns.recommendations.map((rec, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border-l-4 ${
                  rec.priority === 'high'
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-500'
                    : 'bg-blue-50 dark:bg-blue-900/20 border-blue-500'
                }`}
              >
                <div className="font-medium text-gray-900 dark:text-white mb-1">
                  {rec.title}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {rec.message}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* שעות פרודוקטיביות */}
      {bestHours.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            השעות הכי פרודוקטיביות שלך
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {bestHours.map(({ hour, score, count }) => (
              <div
                key={hour}
                className="text-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-700"
              >
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                  {hour}:00
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  {count} משימות
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  ציון: {score}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ימים פרודוקטיביים */}
      {bestDays.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            הימים הכי פרודוקטיביים שלך
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {bestDays.map(({ day, dayName, score, count }) => (
              <div
                key={day}
                className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg border border-green-200 dark:border-green-700"
              >
                <div className="text-xl font-bold text-green-600 dark:text-green-400 mb-1">
                  {dayName}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {count} משימות הושלמו
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  ציון: {score}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* המלצות למשימות ספציפיות */}
      {activeTasks.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            המלצות למשימות שלך
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                בחרי משימה לקבלת המלצות:
              </label>
              <select
                value={selectedTask?.id || ''}
                onChange={(e) => {
                  const task = activeTasks.find(t => t.id === e.target.value);
                  setSelectedTask(task || null);
                }}
                className="input-field"
              >
                <option value="">בחרי משימה...</option>
                {activeTasks.map(task => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </div>

            {taskRecommendations.length > 0 && (
              <div className="space-y-2 mt-4">
                {taskRecommendations.map((rec, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border-l-4 ${
                      rec.priority === 'high'
                        ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-500'
                        : 'bg-blue-50 dark:bg-blue-900/20 border-blue-500'
                    }`}
                  >
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      {rec.message}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedTask && taskRecommendations.length === 0 && (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                אין המלצות ספציפיות למשימה זו
              </div>
            )}
          </div>
        </div>
      )}

      {/* זמן אופטימלי לכל רבע */}
      {patterns.bestTimeForQuadrant && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            זמן אופטימלי לכל רבע
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { id: 1, name: 'דחוף וחשוב', icon: '🔴' },
              { id: 2, name: 'חשוב אך לא דחוף', icon: '🔵' },
              { id: 3, name: 'דחוף אך לא חשוב', icon: '🟠' },
              { id: 4, name: 'לא דחוף ולא חשוב', icon: '⚫' }
            ].map(quadrant => {
              const bestHour = patterns.bestTimeForQuadrant[quadrant.id];
              return (
                <div
                  key={quadrant.id}
                  className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
                >
                  <div className="text-lg mb-2">{quadrant.icon}</div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                    {quadrant.name}
                  </div>
                  {bestHour !== null ? (
                    <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                      {bestHour}:00
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      אין מספיק נתונים
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default SmartRecommendations;


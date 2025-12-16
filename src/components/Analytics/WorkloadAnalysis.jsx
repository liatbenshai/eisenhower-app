import { useState, useEffect, useMemo } from 'react';
import { useTasks } from '../../hooks/useTasks';
import { analyzeWorkload, analyzeTrends } from '../../utils/workloadAnalysis';
import { detectTaskCategory, TASK_CATEGORIES } from '../../utils/taskCategories';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

/**
 * ניתוח עומס עבודה
 */
function WorkloadAnalysis() {
  const { tasks } = useTasks();
  const [analysis, setAnalysis] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [trends, setTrends] = useState(null);

  useEffect(() => {
    if (tasks) {
      const workload = analyzeWorkload(tasks, [], selectedDate);
      setAnalysis(workload);
      
      const trendData = analyzeTrends(tasks, [], 30);
      setTrends(trendData);
    }
  }, [tasks, selectedDate]);

  if (!analysis) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent mx-auto"></div>
        <p className="mt-2 text-gray-500 dark:text-gray-400">מנתח עומס עבודה...</p>
      </div>
    );
  }

  const riskColors = {
    critical: 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200 border-red-300 dark:border-red-700',
    high: 'bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200 border-orange-300 dark:border-orange-700',
    medium: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700',
    low: 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700'
  };

  return (
    <div className="space-y-6">
      {/* כותרת */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          ניתוח עומס עבודה
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          המערכת מנתחת את העומס שלך ומזהירה מפני עומס יתר
        </p>
      </div>

      {/* רמת סיכון */}
      <div className={`rounded-lg border-2 p-4 ${riskColors[analysis.riskLevel]}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium mb-1">רמת סיכון</div>
            <div className="text-2xl font-bold">
              {analysis.riskLevel === 'critical' && '🔴 קריטי'}
              {analysis.riskLevel === 'high' && '🟠 גבוהה'}
              {analysis.riskLevel === 'medium' && '🟡 בינונית'}
              {analysis.riskLevel === 'low' && '🟢 נמוכה'}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm">משימות פעילות</div>
            <div className="text-2xl font-bold">{analysis.totalTasks}</div>
          </div>
        </div>
      </div>

      {/* סטטיסטיקות */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">באיחור</div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {analysis.overdueTasks}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">היום</div>
          <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
            {analysis.dueToday}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">מחר</div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {analysis.dueTomorrow}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">ניצול זמן</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {analysis.utilizationRate}%
          </div>
        </div>
      </div>

      {/* זמן נדרש */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">זמן נדרש</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400">זמן משוער כולל</span>
            <span className="font-medium">{Math.round(analysis.totalEstimatedTime / 60)} שעות</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400">זמן מתוכנן</span>
            <span className="font-medium">{Math.round(analysis.scheduledTime / 60)} שעות</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400">זמן זמין</span>
            <span className="font-medium">{Math.round(analysis.availableTime / 60)} שעות</span>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-900 dark:text-white">פער</span>
              <span className={`font-bold ${
                (analysis.totalEstimatedTime - analysis.availableTime) > 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-green-600 dark:text-green-400'
              }`}>
                {Math.round((analysis.totalEstimatedTime - analysis.availableTime) / 60)} שעות
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* התפלגות קטגוריות */}
      {analysis.categoryAnalysis && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
            התפלגות לפי קטגוריות
          </h3>
          <div className="space-y-2">
            {Object.values(analysis.categoryAnalysis.distribution)
              .sort((a, b) => b.count - a.count)
              .map(({ category, count, percentage, averageTime }) => (
                <div key={category.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{category.icon}</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {category.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {count} ({percentage}%)
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-500">
                      {Math.round(averageTime / 60)} שעות ממוצע
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* המלצות */}
      {analysis.recommendations && analysis.recommendations.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-4">
          <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-3">
            💡 המלצות
          </h3>
          <div className="space-y-3">
            {analysis.recommendations.map((rec, idx) => (
              <div key={idx} className="bg-white dark:bg-gray-800 rounded p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-white mb-1">
                      {rec.title}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {rec.message}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${
                    rec.priority === 'critical' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                    rec.priority === 'high' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' :
                    'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                  }`}>
                    {rec.priority === 'critical' ? 'קריטי' :
                     rec.priority === 'high' ? 'גבוה' : 'בינוני'}
                  </span>
                </div>
                {rec.actions && rec.actions.length > 0 && (
                  <div className="flex gap-2 mt-2">
                    {rec.actions.map((action, actionIdx) => (
                      <button
                        key={actionIdx}
                        className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* עומס לפי ימים */}
      {analysis.workloadByDay && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
            עומס לפי ימים (7 ימים קדימה)
          </h3>
          <div className="space-y-2">
            {Object.values(analysis.workloadByDay).map((day, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {format(new Date(day.date), 'EEEE, d MMMM', { locale: he })}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    day.riskLevel === 'critical' ? 'bg-red-100 dark:bg-red-900/30 text-red-700' :
                    day.riskLevel === 'high' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700' :
                    day.riskLevel === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700' :
                    'bg-green-100 dark:bg-green-900/30 text-green-700'
                  }`}>
                    {day.riskLevel}
                  </span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {day.tasks.length} משימות | {Math.round(day.estimatedTime / 60)} שעות
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkloadAnalysis;


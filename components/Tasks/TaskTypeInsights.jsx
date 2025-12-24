import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { getTaskTypeInsights, getTaskTypeSummary, getTimeManagementRecommendations } from '../../utils/taskTypeLearning';
import { getCategoryById } from '../../utils/taskCategories';
import Button from '../UI/Button';

/**
 * תובנות וסטטיסטיקות על סוגי משימות
 */
function TaskTypeInsights() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [typeInsights, setTypeInsights] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [user?.id]);

  const loadData = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const [summaryData, recommendationsData] = await Promise.all([
        getTaskTypeSummary(user.id),
        getTimeManagementRecommendations(user.id)
      ]);
      
      setSummary(summaryData);
      setRecommendations(recommendationsData);
    } catch (err) {
      console.error('שגיאה בטעינת נתונים:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadTypeInsights = async (taskType) => {
    if (!user?.id) return;
    
    try {
      const insights = await getTaskTypeInsights(user.id, taskType);
      setTypeInsights(insights);
      setSelectedType(taskType);
    } catch (err) {
      console.error('שגיאה בטעינת תובנות:', err);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">טוען סטטיסטיקות...</p>
      </div>
    );
  }

  if (!summary || summary.totals.totalTasks === 0) {
    return (
      <div className="p-8 text-center bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="text-6xl mb-4">📊</div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          אין עדיין נתונים
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          השלם משימות עם סוג משימה ותראה כאן תובנות על דפוסי העבודה שלך!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* סיכום כללי */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-6 border-2 border-blue-200 dark:border-blue-800">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span>📊</span>
          סיכום למידה אישי
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
            <div className="text-sm text-gray-600 dark:text-gray-400">סה"כ משימות</div>
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {summary.totals.totalTasks}
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
            <div className="text-sm text-gray-600 dark:text-gray-400">סה"כ זמן עבודה</div>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              {Math.round(summary.totals.totalTime / 60)} שעות
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
            <div className="text-sm text-gray-600 dark:text-gray-400">דיוק ממוצע</div>
            <div className={`text-3xl font-bold ${
              summary.totals.averageAccuracy >= 80 
                ? 'text-green-600 dark:text-green-400' 
                : summary.totals.averageAccuracy >= 60
                ? 'text-yellow-600 dark:text-yellow-400'
                : 'text-red-600 dark:text-red-400'
            }`}>
              {summary.totals.averageAccuracy}%
            </div>
          </div>
        </div>

        {summary.mostCommon && (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">הכי הרבה עובד על:</div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{summary.mostCommon.category?.icon}</span>
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                {summary.mostCommon.category?.name || summary.mostCommon.taskType}
              </span>
              <span className="text-sm text-gray-500">
                ({summary.mostCommon.totalTasks} משימות)
              </span>
            </div>
          </div>
        )}
      </div>

      {/* המלצות */}
      {recommendations.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span>💡</span>
            המלצות לשיפור
          </h3>
          
          <div className="space-y-3">
            {recommendations.map((rec, idx) => (
              <div 
                key={idx}
                className={`p-4 rounded-lg border-l-4 ${
                  rec.priority === 'high' 
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-500'
                    : rec.priority === 'medium'
                    ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500'
                    : rec.priority === 'info'
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-500'
                    : 'bg-blue-50 dark:bg-blue-900/20 border-blue-500'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{rec.icon}</span>
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900 dark:text-white mb-1">
                      {rec.title}
                    </h4>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {rec.message}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* פירוט לפי סוג משימה */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          פירוט לפי סוג משימה
        </h3>
        
        <div className="space-y-3">
          {summary.summary.map(item => {
            const category = getCategoryById(item.taskType);
            const isSelected = selectedType === item.taskType;
            
            return (
              <div key={item.taskType}>
                <button
                  onClick={() => loadTypeInsights(item.taskType)}
                  className={`w-full p-4 rounded-lg border-2 transition-all text-right ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{category?.icon}</span>
                      <div className="text-right">
                        <div className="font-bold text-gray-900 dark:text-white">
                          {category?.name || item.taskType}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {item.totalTasks} משימות • {Math.round(item.totalTime / 60)} שעות
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-left space-y-1">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        ממוצע: {item.averageTime} דק'
                      </div>
                      <div className={`text-sm font-bold ${
                        item.accuracy >= 80 
                          ? 'text-green-600 dark:text-green-400'
                          : item.accuracy >= 60
                          ? 'text-yellow-600 dark:text-yellow-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        דיוק: {item.accuracy}%
                      </div>
                    </div>
                  </div>
                </button>

                {/* תובנות לסוג המשימה */}
                {isSelected && typeInsights && typeInsights.hasData && (
                  <div className="mt-3 mr-6 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                    <h4 className="font-bold text-gray-900 dark:text-white mb-3">
                      תובנות ל{category?.name}:
                    </h4>
                    
                    {typeInsights.insights.length > 0 ? (
                      <div className="space-y-2">
                        {typeInsights.insights.map((insight, idx) => (
                          <div 
                            key={idx}
                            className="flex items-start gap-2 p-3 bg-white dark:bg-gray-800 rounded-lg"
                          >
                            <span className="text-xl">{insight.icon}</span>
                            <div className="flex-1">
                              <div className="font-medium text-gray-900 dark:text-white">
                                {insight.title}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                {insight.message}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        עדיין אין מספיק נתונים להצגת תובנות מפורטות
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default TaskTypeInsights;


import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useTasks } from '../../hooks/useTasks';
import { getTaskTypeInsights, getTaskTypeSummary, getTimeManagementRecommendations } from '../../utils/taskTypeLearning';
import { getCategoryById } from '../../utils/taskCategories';
import { supabase } from '../../services/supabase';
import Button from '../UI/Button';
import Modal from '../UI/Modal';
import toast from 'react-hot-toast';

/**
 * תובנות וסטטיסטיקות על סוגי משימות - עם כפתורי פעולה
 */
function TaskTypeInsights() {
  const { user } = useAuth();
  const { tasks, loadTasks } = useTasks();
  const [summary, setSummary] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [dismissedRecs, setDismissedRecs] = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [typeInsights, setTypeInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionModal, setActionModal] = useState(null);
  const [processingAction, setProcessingAction] = useState(false);

  useEffect(() => {
    loadData();
    loadDismissedRecs();
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

  const loadDismissedRecs = () => {
    try {
      const saved = localStorage.getItem(`dismissed_recs_${user?.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        // נקה המלצות ישנות (יותר מ-7 ימים)
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const valid = parsed.filter(d => d.timestamp > weekAgo);
        setDismissedRecs(valid.map(d => d.id));
      }
    } catch (err) {
      console.error('שגיאה בטעינת המלצות שנדחו:', err);
    }
  };

  const dismissRecommendation = (recId) => {
    const newDismissed = [...dismissedRecs, recId];
    setDismissedRecs(newDismissed);
    
    // שמירה ב-localStorage
    const toSave = newDismissed.map(id => ({ id, timestamp: Date.now() }));
    localStorage.setItem(`dismissed_recs_${user?.id}`, JSON.stringify(toSave));
    
    toast.success('ההמלצה הוסתרה');
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

  /**
   * ביצוע פעולה על המלצה
   */
  const handleAction = async (rec) => {
    switch (rec.action) {
      case 'adjust_estimates':
        setActionModal({
          type: 'adjust_estimates',
          rec,
          title: `עדכון הערכות זמן ל${rec.taskType}`,
          description: `הדיוק הנוכחי הוא ${summary?.summary?.find(s => s.taskType === rec.taskType)?.accuracy || 0}%. נעדכן את כל המשימות הפתוחות מסוג זה?`
        });
        break;
        
      case 'split_tasks':
        setActionModal({
          type: 'split_tasks',
          rec,
          title: `פיצול משימות ${rec.taskType}`,
          description: `משימות מסוג זה לוקחות בממוצע ${summary?.summary?.find(s => s.taskType === rec.taskType)?.averageTime || 0} דקות. האם לפצל משימות ארוכות?`
        });
        break;
        
      case 'use_categories':
        toast('💡 טיפ: בעת יצירת משימה חדשה, בחרי סוג משימה ספציפי מהרשימה', {
          duration: 5000,
          icon: '🎯'
        });
        break;
        
      case 'keep_going':
        toast.success('🎉 כל הכבוד! המשיכי כך!');
        break;
        
      default:
        console.log('פעולה לא מוכרת:', rec.action);
    }
  };

  /**
   * יישום עדכון הערכות זמן
   */
  const applyAdjustEstimates = async (taskType, adjustmentPercent) => {
    setProcessingAction(true);
    try {
      // מציאת משימות פתוחות מהסוג הזה
      const openTasks = tasks.filter(t => 
        t.task_type === taskType && 
        !t.is_completed &&
        t.estimated_duration
      );

      if (openTasks.length === 0) {
        toast('אין משימות פתוחות מסוג זה לעדכון', { icon: 'ℹ️' });
        setActionModal(null);
        return;
      }

      // עדכון כל המשימות
      let updated = 0;
      for (const task of openTasks) {
        const newDuration = Math.round(task.estimated_duration * (1 + adjustmentPercent / 100));
        
        const { error } = await supabase
          .from('tasks')
          .update({ estimated_duration: newDuration })
          .eq('id', task.id);
          
        if (!error) updated++;
      }

      toast.success(`עודכנו ${updated} משימות (+${adjustmentPercent}% לזמן המשוער)`);
      loadTasks();
      setActionModal(null);
      
      // סימון ההמלצה כמיושמת
      dismissRecommendation(`${taskType}_adjust`);
      
    } catch (err) {
      console.error('שגיאה בעדכון:', err);
      toast.error('שגיאה בעדכון המשימות');
    } finally {
      setProcessingAction(false);
    }
  };

  /**
   * יישום פיצול משימות
   */
  const applySplitTasks = async (taskType, maxDuration) => {
    setProcessingAction(true);
    try {
      // מציאת משימות ארוכות מהסוג הזה
      const longTasks = tasks.filter(t => 
        t.task_type === taskType && 
        !t.is_completed &&
        t.estimated_duration > maxDuration
      );

      if (longTasks.length === 0) {
        toast('אין משימות ארוכות מסוג זה לפיצול', { icon: 'ℹ️' });
        setActionModal(null);
        return;
      }

      let created = 0;
      for (const task of longTasks) {
        const numParts = Math.ceil(task.estimated_duration / maxDuration);
        const partDuration = Math.round(task.estimated_duration / numParts);
        
        // עדכון המשימה המקורית
        await supabase
          .from('tasks')
          .update({ 
            title: `${task.title} (חלק 1)`,
            estimated_duration: partDuration 
          })
          .eq('id', task.id);
        
        // יצירת חלקים נוספים
        for (let i = 2; i <= numParts; i++) {
          const { error } = await supabase
            .from('tasks')
            .insert({
              user_id: user.id,
              title: `${task.title} (חלק ${i})`,
              description: task.description,
              task_type: task.task_type,
              priority: task.priority,
              quadrant: task.quadrant,
              estimated_duration: partDuration,
              due_date: task.due_date
            });
            
          if (!error) created++;
        }
      }

      toast.success(`נוצרו ${created} משימות חדשות מפיצול`);
      loadTasks();
      setActionModal(null);
      
      // סימון ההמלצה כמיושמת
      dismissRecommendation(`${taskType}_split`);
      
    } catch (err) {
      console.error('שגיאה בפיצול:', err);
      toast.error('שגיאה בפיצול המשימות');
    } finally {
      setProcessingAction(false);
    }
  };

  // סינון המלצות שנדחו
  const visibleRecommendations = recommendations.filter(rec => {
    const recId = `${rec.taskType || rec.type}_${rec.action}`;
    return !dismissedRecs.includes(recId);
  });

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
          השלימי משימות עם סוג משימה ותראי כאן תובנות על דפוסי העבודה שלך!
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
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">הכי הרבה עובדת על:</div>
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

      {/* המלצות עם כפתורי פעולה */}
      {visibleRecommendations.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span>💡</span>
            המלצות לשיפור
          </h3>
          
          <div className="space-y-3">
            {visibleRecommendations.map((rec, idx) => {
              const recId = `${rec.taskType || rec.type}_${rec.action}`;
              
              return (
                <div 
                  key={idx}
                  className={`p-4 rounded-lg border-r-4 ${
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
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                        {rec.message}
                      </p>
                      
                      {/* כפתורי פעולה */}
                      <div className="flex gap-2 flex-wrap">
                        {rec.action !== 'keep_going' && (
                          <button
                            onClick={() => handleAction(rec)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                          >
                            ✅ יישם
                          </button>
                        )}
                        
                        <button
                          onClick={() => dismissRecommendation(recId)}
                          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors"
                        >
                          ✕ הסתר
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
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

      {/* מודל פעולה - עדכון הערכות */}
      <Modal
        isOpen={actionModal?.type === 'adjust_estimates'}
        onClose={() => setActionModal(null)}
        title={actionModal?.title}
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            {actionModal?.description}
          </p>
          
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              המערכת תעדכן את הזמן המשוער של כל המשימות הפתוחות מסוג זה.
            </p>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => applyAdjustEstimates(actionModal?.rec?.taskType, 20)}
              disabled={processingAction}
              className="flex-1 py-3 bg-yellow-500 hover:bg-yellow-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              +20%
            </button>
            <button
              onClick={() => applyAdjustEstimates(actionModal?.rec?.taskType, 30)}
              disabled={processingAction}
              className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              +30%
            </button>
            <button
              onClick={() => applyAdjustEstimates(actionModal?.rec?.taskType, 50)}
              disabled={processingAction}
              className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              +50%
            </button>
          </div>
          
          <button
            onClick={() => setActionModal(null)}
            className="w-full py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800"
          >
            ביטול
          </button>
        </div>
      </Modal>

      {/* מודל פעולה - פיצול משימות */}
      <Modal
        isOpen={actionModal?.type === 'split_tasks'}
        onClose={() => setActionModal(null)}
        title={actionModal?.title}
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            {actionModal?.description}
          </p>
          
          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              בחרי את הזמן המקסימלי למשימה. משימות ארוכות יותר יפוצלו לחלקים.
            </p>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => applySplitTasks(actionModal?.rec?.taskType, 30)}
              disabled={processingAction}
              className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              30 דקות
            </button>
            <button
              onClick={() => applySplitTasks(actionModal?.rec?.taskType, 45)}
              disabled={processingAction}
              className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              45 דקות
            </button>
            <button
              onClick={() => applySplitTasks(actionModal?.rec?.taskType, 60)}
              disabled={processingAction}
              className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              60 דקות
            </button>
          </div>
          
          <button
            onClick={() => setActionModal(null)}
            className="w-full py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800"
          >
            ביטול
          </button>
        </div>
      </Modal>
    </div>
  );
}

export default TaskTypeInsights;

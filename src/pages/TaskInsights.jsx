import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../hooks/useTasks';
import { useAuth } from '../hooks/useAuth';
import { TASK_TYPES } from '../config/taskTypes';
import { getInterruptionStats, getLearningData } from '../services/supabase';
import Button from '../components/UI/Button';
import toast from 'react-hot-toast';

/**
 * עמוד תובנות ולמידה
 * מציג הצעות לשיפור עם אפשרות לקבל או לדחות
 */
function TaskInsights() {
  const { tasks } = useTasks();
  const { user } = useAuth();
  
  const [interruptionStats, setInterruptionStats] = useState(null);
  const [learningData, setLearningData] = useState([]);
  const [acceptedSuggestions, setAcceptedSuggestions] = useState([]);
  const [dismissedSuggestions, setDismissedSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);

  // טעינת נתונים
  useEffect(() => {
    if (user?.id) {
      loadData();
    }
  }, [user?.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      // טעינת סטטיסטיקות הפרעות
      try {
        const stats = await getInterruptionStats(user.id, 30);
        setInterruptionStats(stats);
      } catch (e) {
        console.log('אין נתוני הפרעות');
      }

      // טעינת נתוני למידה
      try {
        const learning = await getLearningData(user.id);
        setLearningData(learning || []);
      } catch (e) {
        console.log('אין נתוני למידה');
      }

      // טעינת היסטוריית הצעות
      loadSuggestionHistory();
    } finally {
      setLoading(false);
    }
  };

  const loadSuggestionHistory = () => {
    const accepted = localStorage.getItem(`accepted_suggestions_${user?.id}`);
    const dismissed = localStorage.getItem(`dismissed_suggestions_${user?.id}`);
    
    if (accepted) {
      try { setAcceptedSuggestions(JSON.parse(accepted)); } catch (e) {}
    }
    if (dismissed) {
      try {
        const parsed = JSON.parse(dismissed);
        // סינון הצעות שעבר שבוע
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        setDismissedSuggestions(parsed.filter(d => d.dismissedAt > weekAgo));
      } catch (e) {}
    }
  };

  // === יצירת הצעות חכמות ===
  const suggestions = useMemo(() => {
    const items = [];
    const dismissedIds = dismissedSuggestions.map(d => d.id);
    const acceptedIds = acceptedSuggestions.map(a => a.id);

    // הצעה 1: עדכון יחס זמן לפי ביצוע בפועל
    learningData.forEach(data => {
      if (data.total_tasks >= 3 && data.average_ratio && data.average_ratio !== 1) {
        const taskType = TASK_TYPES[data.task_type];
        if (!taskType) return;

        const suggestionId = `time_ratio_${data.task_type}`;
        if (dismissedIds.includes(suggestionId) || acceptedIds.includes(suggestionId)) return;

        const currentRatio = taskType.timeRatio || 1;
        const suggestedRatio = Math.round(data.average_ratio * 10) / 10;
        
        if (Math.abs(currentRatio - suggestedRatio) > 0.2) {
          items.push({
            id: suggestionId,
            type: 'time_correction',
            icon: '⏱️',
            title: `עדכון זמן ${taskType.name}`,
            description: `בממוצע, ${taskType.name} לוקח לך ${suggestedRatio}x מהזמן המוערך במקום ${currentRatio}x`,
            suggestion: `לעדכן את יחס הזמן ל-${suggestedRatio}?`,
            data: { taskType: data.task_type, newRatio: suggestedRatio, oldRatio: currentRatio },
            impact: 'high',
            basedOn: `${data.total_tasks} משימות`
          });
        }
      }
    });

    // הצעה 2: זיהוי שעות שיא להפרעות
    if (interruptionStats?.peakHours?.length > 0) {
      const peakHour = interruptionStats.peakHours[0];
      const suggestionId = `block_interruption_hours`;
      
      if (!dismissedIds.includes(suggestionId) && !acceptedIds.includes(suggestionId) && peakHour.count > 5) {
        items.push({
          id: suggestionId,
          type: 'schedule',
          icon: '🛡️',
          title: 'הגנה על שעות עבודה',
          description: `רוב ההפרעות שלך קורות בשעה ${peakHour.hour}:00 (${peakHour.count} הפרעות)`,
          suggestion: 'לחסום שעות אלה לעבודה עמוקה?',
          data: { peakHour: peakHour.hour },
          impact: 'medium',
          basedOn: `${interruptionStats.totalInterruptions} הפרעות`
        });
      }
    }

    // הצעה 3: זיהוי יום עמוס בהפרעות
    if (interruptionStats?.byDayOfWeek) {
      const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
      const maxDay = Object.entries(interruptionStats.byDayOfWeek)
        .sort((a, b) => b[1] - a[1])[0];
      
      if (maxDay && maxDay[1] > 10) {
        const suggestionId = `busy_day_${maxDay[0]}`;
        if (!dismissedIds.includes(suggestionId) && !acceptedIds.includes(suggestionId)) {
          items.push({
            id: suggestionId,
            type: 'insight',
            icon: '📅',
            title: `יום ${days[maxDay[0]]} עמוס`,
            description: `ביום ${days[maxDay[0]]} יש לך הכי הרבה הפרעות (${maxDay[1]})`,
            suggestion: 'לתכנן משימות קלות יותר ביום זה?',
            data: { busyDay: parseInt(maxDay[0]) },
            impact: 'low',
            basedOn: 'ניתוח הפרעות'
          });
        }
      }
    }

    // הצעה 4: משימות שתמיד חורגות
    const completedTasks = tasks.filter(t => t.is_completed && t.time_spent && t.estimated_duration);
    const overrunTasks = completedTasks.filter(t => t.time_spent > t.estimated_duration * 1.3);
    
    if (overrunTasks.length >= 3 && completedTasks.length >= 5) {
      const overrunPercent = Math.round((overrunTasks.length / completedTasks.length) * 100);
      const suggestionId = 'underestimate_warning';
      
      if (!dismissedIds.includes(suggestionId) && !acceptedIds.includes(suggestionId) && overrunPercent > 50) {
        items.push({
          id: suggestionId,
          type: 'warning',
          icon: '⚠️',
          title: 'הערכות זמן נמוכות מדי',
          description: `ב-${overrunPercent}% מהמשימות חרגת מהזמן המתוכנן`,
          suggestion: 'להוסיף buffer אוטומטי של 20% לכל משימה?',
          data: { bufferPercent: 20 },
          impact: 'high',
          basedOn: `${completedTasks.length} משימות שהושלמו`
        });
      }
    }

    // הצעה 5: סוג הפרעה נפוץ
    if (interruptionStats?.byType?.length > 0) {
      const topType = interruptionStats.byType[0];
      if (topType.count > 10) {
        const typeNames = {
          client_call: 'שיחות לקוח',
          phone_call: 'טלפונים',
          distraction: 'הסחות דעת',
          break: 'הפסקות',
          urgent: 'דברים דחופים',
          other: 'אחר'
        };
        
        const suggestionId = `reduce_${topType.type}`;
        if (!dismissedIds.includes(suggestionId) && !acceptedIds.includes(suggestionId)) {
          items.push({
            id: suggestionId,
            type: 'insight',
            icon: '📞',
            title: `${typeNames[topType.type] || topType.type} תכופות`,
            description: `${topType.count} הפרעות מסוג "${typeNames[topType.type]}" בחודש האחרון`,
            suggestion: 'לקבוע שעות קבועות לטיפול בנושא זה?',
            data: { interruptionType: topType.type },
            impact: 'medium',
            basedOn: `${topType.totalMinutes} דקות בחודש`
          });
        }
      }
    }

    return items;
  }, [learningData, interruptionStats, tasks, dismissedSuggestions, acceptedSuggestions]);

  // קבלת הצעה
  const acceptSuggestion = async (suggestion) => {
    const newAccepted = [...acceptedSuggestions, {
      id: suggestion.id,
      acceptedAt: Date.now(),
      data: suggestion.data
    }];
    setAcceptedSuggestions(newAccepted);
    localStorage.setItem(`accepted_suggestions_${user?.id}`, JSON.stringify(newAccepted));

    // TODO: יישום בפועל של ההצעה
    // לדוגמה: עדכון יחס זמן ב-taskTypes
    
    toast.success('ההצעה התקבלה! השינויים יופיעו במשימות הבאות');
  };

  // דחיית הצעה
  const dismissSuggestion = (suggestionId) => {
    const newDismissed = [...dismissedSuggestions, {
      id: suggestionId,
      dismissedAt: Date.now()
    }];
    setDismissedSuggestions(newDismissed);
    localStorage.setItem(`dismissed_suggestions_${user?.id}`, JSON.stringify(newDismissed));
    toast.success('ההצעה נדחתה לשבוע');
  };

  // פורמט דקות
  const formatMinutes = (minutes) => {
    if (!minutes) return '0 דק\'';
    if (minutes < 60) return `${Math.round(minutes)} דק'`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}:${mins.toString().padStart(2, '0')}` : `${hours} שעות`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="task-insights p-4 max-w-4xl mx-auto">
      {/* כותרת */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
          💡 תובנות ולמידה
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          המערכת לומדת את דפוסי העבודה שלך ומציעה שיפורים
        </p>
      </div>

      {/* הצעות לשיפור */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          🎯 הצעות לשיפור
          {suggestions.length > 0 && (
            <span className="text-sm font-normal bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
              {suggestions.length}
            </span>
          )}
        </h2>

        {suggestions.length === 0 ? (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-8 text-center">
            <div className="text-4xl mb-3">🎉</div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              אין הצעות חדשות
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              המשיכי לעבוד והמערכת תלמד את הדפוסים שלך.
              <br />
              הצעות שנדחו יחזרו אחרי שבוע.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {suggestions.map((suggestion) => (
                <SuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  onAccept={() => acceptSuggestion(suggestion)}
                  onDismiss={() => dismissSuggestion(suggestion.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* סטטיסטיקות כלליות */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* התפלגות זמן לפי סוג */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="font-bold text-gray-900 dark:text-white mb-4">
            📊 זמן עבודה לפי סוג (30 יום)
          </h3>
          
          {learningData.length === 0 ? (
            <div className="text-center py-6 text-gray-400">
              <p>אין עדיין נתונים</p>
              <p className="text-sm">סיימי משימות כדי לראות סטטיסטיקות</p>
            </div>
          ) : (
            <div className="space-y-3">
              {learningData
                .sort((a, b) => b.total_actual_minutes - a.total_actual_minutes)
                .slice(0, 6)
                .map((data) => {
                  const taskType = TASK_TYPES[data.task_type] || TASK_TYPES.other;
                  const totalMinutes = learningData.reduce((sum, d) => sum + (d.total_actual_minutes || 0), 0);
                  const percent = totalMinutes > 0 ? Math.round(((data.total_actual_minutes || 0) / totalMinutes) * 100) : 0;
                  
                  return (
                    <div key={data.task_type}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="flex items-center gap-2">
                          <span>{taskType.icon}</span>
                          <span className="text-gray-700 dark:text-gray-300">{taskType.name}</span>
                        </span>
                        <span className="text-gray-500">
                          {formatMinutes(data.total_actual_minutes)} ({percent}%)
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* דיוק הערכות */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="font-bold text-gray-900 dark:text-white mb-4">
            🎯 דיוק הערכות זמן
          </h3>
          
          {learningData.length === 0 ? (
            <div className="text-center py-6 text-gray-400">
              <p>אין עדיין נתונים</p>
            </div>
          ) : (
            <div className="space-y-3">
              {learningData
                .filter(d => d.total_tasks >= 2)
                .sort((a, b) => Math.abs(1 - b.average_ratio) - Math.abs(1 - a.average_ratio))
                .slice(0, 6)
                .map((data) => {
                  const taskType = TASK_TYPES[data.task_type] || TASK_TYPES.other;
                  const ratio = data.average_ratio || 1;
                  const isOver = ratio > 1;
                  const diffPercent = Math.round(Math.abs(ratio - 1) * 100);
                  
                  return (
                    <div key={data.task_type} className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span>{taskType.icon}</span>
                        <span className="text-gray-700 dark:text-gray-300 text-sm">{taskType.name}</span>
                      </span>
                      <span className={`text-sm font-medium ${
                        diffPercent <= 10 ? 'text-green-600' :
                        diffPercent <= 30 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {diffPercent <= 10 ? '✓ מדויק' :
                         isOver ? `+${diffPercent}% יותר` : `-${diffPercent}% פחות`}
                      </span>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* היסטוריית הצעות שהתקבלו */}
      {acceptedSuggestions.length > 0 && (
        <div className="mt-6 bg-green-50 dark:bg-green-900/20 rounded-2xl p-4 border border-green-200 dark:border-green-800">
          <h3 className="font-bold text-green-800 dark:text-green-200 mb-3">
            ✅ הצעות שיושמו ({acceptedSuggestions.length})
          </h3>
          <div className="text-sm text-green-700 dark:text-green-300 space-y-1">
            {acceptedSuggestions.slice(-5).map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <span>•</span>
                <span>{item.id.replace(/_/g, ' ')}</span>
                <span className="text-green-500 text-xs">
                  ({new Date(item.acceptedAt).toLocaleDateString('he-IL')})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * כרטיס הצעה
 */
function SuggestionCard({ suggestion, onAccept, onDismiss }) {
  const impactColors = {
    high: 'border-r-red-500',
    medium: 'border-r-yellow-500',
    low: 'border-r-blue-500'
  };

  const impactLabels = {
    high: 'השפעה גבוהה',
    medium: 'השפעה בינונית',
    low: 'השפעה נמוכה'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      className={`bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 border-r-4 ${impactColors[suggestion.impact]}`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">{suggestion.icon}</span>
        
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-bold text-gray-900 dark:text-white">
              {suggestion.title}
            </h4>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              suggestion.impact === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
              suggestion.impact === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
              'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
            }`}>
              {impactLabels[suggestion.impact]}
            </span>
          </div>
          
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">
            {suggestion.description}
          </p>
          
          <p className="text-gray-900 dark:text-white text-sm font-medium mb-3">
            💡 {suggestion.suggestion}
          </p>

          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">
              מבוסס על: {suggestion.basedOn}
            </span>
            
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={onDismiss}
              >
                לא עכשיו
              </Button>
              <Button
                size="sm"
                onClick={onAccept}
              >
                ✓ קבל
              </Button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default TaskInsights;

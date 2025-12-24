import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TASK_TYPES } from '../../config/taskTypes';
import { suggestWeeklyBalance, suggestDailyReschedule } from '../../utils/urgentRescheduler';
import { getSplitRecommendation } from '../../utils/smartTaskSplitter';

/**
 * פאנל המלצות חכמות
 * מנתח את דפוסי העבודה ומציע שיפורים
 */
function SmartRecommendationsPanel({ tasks }) {
  const [expandedCategory, setExpandedCategory] = useState(null);

  // יצירת המלצות
  const recommendations = useMemo(() => {
    const allRecommendations = [];
    const today = new Date().toISOString().split('T')[0];
    const activeTasks = tasks.filter(t => !t.is_completed);
    const completedTasks = tasks.filter(t => t.is_completed);

    // --- 1. המלצות על איזון עומס ---
    const weekBalance = suggestWeeklyBalance(tasks);
    if (!weekBalance.isBalanced) {
      allRecommendations.push({
        id: 'week-balance',
        category: 'workload',
        priority: 'high',
        icon: '⚖️',
        title: 'איזון עומס שבועי',
        message: weekBalance.summary,
        action: 'balance',
        details: weekBalance.balanceSuggestions.map(s => 
          `העבר "${s.task.title}" מיום ${s.fromDayName} ליום ${s.toDayName}`
        )
      });
    }

    // --- 2. המלצות על משימות שלא הושלמו ---
    const dailyReschedule = suggestDailyReschedule(tasks);
    if (dailyReschedule.hasUnfinished) {
      allRecommendations.push({
        id: 'daily-reschedule',
        category: 'tasks',
        priority: dailyReschedule.urgentCount > 0 ? 'high' : 'medium',
        icon: '⏳',
        title: `${dailyReschedule.count} משימות לא הושלמו היום`,
        message: dailyReschedule.summary,
        action: 'reschedule',
        details: dailyReschedule.suggestions.slice(0, 3).map(s => 
          `${s.task.title}: ${s.suggestedAction}`
        )
      });
    }

    // --- 3. המלצות על משימות ארוכות מדי ---
    const longTasks = activeTasks.filter(t => 
      (t.estimated_duration || 0) > 60
    );
    longTasks.forEach(task => {
      const recommendation = getSplitRecommendation(task);
      if (recommendation.shouldSplit) {
        allRecommendations.push({
          id: `split-${task.id}`,
          category: 'optimization',
          priority: 'low',
          icon: '✂️',
          title: `פצל את "${task.title}"`,
          message: `משימה של ${task.estimated_duration} דקות. מומלץ לפצל ל-${recommendation.recommendation.numParts} חלקים`,
          action: 'split',
          taskId: task.id
        });
      }
    });

    // --- 4. ניתוח דיוק הערכות ---
    if (completedTasks.length >= 5) {
      const withTimeData = completedTasks.filter(t => t.time_spent && t.estimated_duration);
      if (withTimeData.length >= 5) {
        const avgRatio = withTimeData.reduce((sum, t) => {
          return sum + (t.time_spent / (t.estimated_duration || 30));
        }, 0) / withTimeData.length;

        if (avgRatio > 1.3) {
          allRecommendations.push({
            id: 'underestimate',
            category: 'accuracy',
            priority: 'medium',
            icon: '📏',
            title: 'הערכות זמן נמוכות מדי',
            message: `בממוצע, המשימות לוקחות ${Math.round((avgRatio - 1) * 100)}% יותר זמן מהמשוער. נסה להוסיף מרווח ביטחון`,
            action: 'adjust',
            details: [
              'הוסף 30% לכל הערכת זמן',
              'השתמש בטיימר כדי ללמוד את הקצב האמיתי',
              'פצל משימות גדולות לקטנות יותר'
            ]
          });
        } else if (avgRatio < 0.7) {
          allRecommendations.push({
            id: 'overestimate',
            category: 'accuracy',
            priority: 'low',
            icon: '🎯',
            title: 'את מהירה ממה שחשבת!',
            message: `בממוצע, המשימות נגמרות ${Math.round((1 - avgRatio) * 100)}% יותר מהר. יכולה להוסיף עוד משימות`,
            action: 'info',
            positive: true
          });
        }

        // ניתוח לפי סוג משימה
        const byType = {};
        withTimeData.forEach(t => {
          const type = t.task_type || 'other';
          if (!byType[type]) {
            byType[type] = { tasks: [], totalRatio: 0 };
          }
          byType[type].tasks.push(t);
          byType[type].totalRatio += t.time_spent / (t.estimated_duration || 30);
        });

        Object.entries(byType).forEach(([type, data]) => {
          if (data.tasks.length >= 3) {
            const avgTypeRatio = data.totalRatio / data.tasks.length;
            const typeInfo = TASK_TYPES[type] || { name: type, icon: '📋' };
            
            if (avgTypeRatio > 1.4) {
              allRecommendations.push({
                id: `type-slow-${type}`,
                category: 'accuracy',
                priority: 'medium',
                icon: typeInfo.icon,
                title: `${typeInfo.name} לוקח יותר זמן`,
                message: `משימות מסוג ${typeInfo.name} לוקחות ${Math.round((avgTypeRatio - 1) * 100)}% יותר זמן מהמשוער`,
                action: 'adjust-type',
                taskType: type
              });
            }
          }
        });
      }
    }

    // --- 5. התראות על עומס יתר ---
    const todayTasks = activeTasks.filter(t => t.due_date === today);
    const todayTotal = todayTasks.reduce((sum, t) => sum + (t.estimated_duration || 30), 0);
    const availableToday = 8 * 60; // 8 שעות

    if (todayTotal > availableToday) {
      allRecommendations.push({
        id: 'overload-today',
        category: 'workload',
        priority: 'high',
        icon: '🔥',
        title: 'עומס יתר היום!',
        message: `יש ${Math.round((todayTotal - availableToday) / 60)} שעות יותר מדי מתוכננות להיום`,
        action: 'reschedule',
        urgent: true
      });
    }

    // --- 6. המלצות על הרגלים ---
    if (completedTasks.length >= 10) {
      // ניתוח שעות עבודה
      const hourCounts = {};
      completedTasks.forEach(t => {
        if (t.completed_at) {
          const hour = new Date(t.completed_at).getHours();
          hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        }
      });

      const peakHours = Object.entries(hourCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([hour]) => parseInt(hour));

      if (peakHours.length >= 2) {
        allRecommendations.push({
          id: 'peak-hours',
          category: 'habits',
          priority: 'info',
          icon: '⏰',
          title: 'שעות שיא',
          message: `את הכי פרודוקטיבית בשעות ${peakHours[0]}:00 ו-${peakHours[1]}:00. תכנני משימות חשובות לשעות האלה`,
          action: 'info',
          positive: true
        });
      }
    }

    // --- 7. המלצה להשתמש בטיימר ---
    const tasksWithoutTimeTracking = completedTasks.filter(t => !t.time_spent || t.time_spent === 0);
    if (tasksWithoutTimeTracking.length > completedTasks.length * 0.5 && completedTasks.length >= 5) {
      allRecommendations.push({
        id: 'use-timer',
        category: 'habits',
        priority: 'medium',
        icon: '⏱️',
        title: 'השתמשי בטיימר',
        message: 'רוב המשימות נסגרות ללא מעקב זמן. שימוש בטיימר יעזור למערכת ללמוד את הקצב שלך',
        action: 'info'
      });
    }

    // מיון לפי עדיפות
    const priorityOrder = { high: 0, medium: 1, low: 2, info: 3 };
    return allRecommendations.sort((a, b) => 
      (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3)
    );
  }, [tasks]);

  // קיבוץ לפי קטגוריה
  const byCategory = useMemo(() => {
    const categories = {
      workload: { name: 'עומס עבודה', icon: '⚖️', items: [] },
      tasks: { name: 'משימות', icon: '📋', items: [] },
      accuracy: { name: 'דיוק הערכות', icon: '🎯', items: [] },
      optimization: { name: 'אופטימיזציה', icon: '⚡', items: [] },
      habits: { name: 'הרגלים', icon: '📈', items: [] }
    };

    recommendations.forEach(rec => {
      const cat = rec.category || 'tasks';
      if (categories[cat]) {
        categories[cat].items.push(rec);
      }
    });

    return Object.entries(categories)
      .filter(([_, data]) => data.items.length > 0)
      .map(([key, data]) => ({ key, ...data }));
  }, [recommendations]);

  // צבעי עדיפות
  const priorityColors = {
    high: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700',
    medium: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700',
    low: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700',
    info: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700'
  };

  const priorityTextColors = {
    high: 'text-red-700 dark:text-red-300',
    medium: 'text-yellow-700 dark:text-yellow-300',
    low: 'text-blue-700 dark:text-blue-300',
    info: 'text-green-700 dark:text-green-300'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-6"
    >
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
        🤖 המלצות חכמות
      </h3>

      {recommendations.length === 0 ? (
        <div className="text-center py-8">
          <span className="text-4xl block mb-4">✨</span>
          <p className="text-gray-600 dark:text-gray-400">
            הכל נראה מצוין! אין המלצות כרגע
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* המלצות חשובות ראשונות */}
          {recommendations.filter(r => r.priority === 'high').map(rec => (
            <motion.div
              key={rec.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`p-4 rounded-lg border ${priorityColors[rec.priority]}`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{rec.icon}</span>
                <div className="flex-1">
                  <div className={`font-medium ${priorityTextColors[rec.priority]}`}>
                    {rec.title}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {rec.message}
                  </p>
                  {rec.details && rec.details.length > 0 && (
                    <ul className="mt-2 text-sm text-gray-500 space-y-1">
                      {rec.details.map((detail, i) => (
                        <li key={i} className="flex items-center gap-1">
                          <span className="text-xs">•</span> {detail}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </motion.div>
          ))}

          {/* שאר ההמלצות לפי קטגוריה */}
          {byCategory.map(category => {
            const nonHighItems = category.items.filter(r => r.priority !== 'high');
            if (nonHighItems.length === 0) return null;

            const isExpanded = expandedCategory === category.key;

            return (
              <div key={category.key}>
                <button
                  onClick={() => setExpandedCategory(isExpanded ? null : category.key)}
                  className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span>{category.icon}</span>
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {category.name}
                    </span>
                    <span className="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded-full">
                      {nonHighItems.length}
                    </span>
                  </div>
                  <span className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 space-y-2 pl-4">
                        {nonHighItems.map(rec => (
                          <div
                            key={rec.id}
                            className={`p-3 rounded-lg border ${priorityColors[rec.priority]}`}
                          >
                            <div className="flex items-start gap-2">
                              <span>{rec.icon}</span>
                              <div>
                                <div className={`text-sm font-medium ${priorityTextColors[rec.priority]}`}>
                                  {rec.title}
                                </div>
                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                                  {rec.message}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {/* סיכום */}
      {recommendations.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>
              {recommendations.filter(r => r.priority === 'high').length} המלצות דחופות
            </span>
            <span>
              סה"כ {recommendations.length} המלצות
            </span>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default SmartRecommendationsPanel;

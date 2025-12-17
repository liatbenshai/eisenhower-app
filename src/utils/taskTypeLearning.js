/**
 * מערכת למידה לסוגי משימות
 * מעקב, חיזוי ושיפור הערכות זמן לפי סוג משימה
 */

import { supabase } from '../services/supabase';
import { TASK_CATEGORIES, getCategoryById } from './taskCategories';

/**
 * קבלת סטטיסטיקות לכל סוגי המשימות של המשתמש
 */
export async function getUserTaskTypeStats(userId) {
  try {
    const { data, error } = await supabase
      .from('task_type_stats')
      .select('*')
      .eq('user_id', userId)
      .order('total_tasks', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('שגיאה בקבלת סטטיסטיקות:', err);
    return [];
  }
}

/**
 * קבלת סטטיסטיקות לסוג משימה ספציפי
 */
export async function getTaskTypeStats(userId, taskType) {
  try {
    const { data, error } = await supabase
      .from('task_type_stats')
      .select('*')
      .eq('user_id', userId)
      .eq('task_type', taskType)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
    return data;
  } catch (err) {
    console.error('שגיאה בקבלת סטטיסטיקות לסוג משימה:', err);
    return null;
  }
}

/**
 * חיזוי זמן ביצוע משוער לפי סוג משימה והיסטוריה
 */
export async function predictTaskDuration(userId, taskType, options = {}) {
  const { quadrant, title, description } = options;
  
  try {
    // קבלת סטטיסטיקות כלליות לסוג המשימה
    const stats = await getTaskTypeStats(userId, taskType);
    
    // קבלת קטגוריה
    const category = getCategoryById(taskType);
    
    // אם אין סטטיסטיקות, השתמש בערך ברירת מחדל מהקטגוריה
    if (!stats || stats.total_tasks === 0) {
      return {
        predictedTime: category?.typicalDuration || 30,
        confidence: 'low',
        reason: 'אין עדיין היסטוריה לסוג משימה זה, משתמש בערך ברירת מחדל',
        basedOn: 'default',
        stats: null
      };
    }
    
    // קבלת היסטוריה אחרונה לסוג המשימה
    const { data: recentHistory } = await supabase
      .from('task_completion_history')
      .select('*')
      .eq('user_id', userId)
      .eq('task_type', taskType)
      .order('completed_at', { ascending: false })
      .limit(10);
    
    let predictedTime = stats.average_time;
    let confidence = 'medium';
    let reason = `ממוצע של ${stats.completed_tasks} משימות קודמות`;
    let basedOn = 'history';
    
    // שיפור החיזוי לפי רבע אם מסופק
    if (quadrant && recentHistory && recentHistory.length > 0) {
      const quadrantTasks = recentHistory.filter(h => h.quadrant === quadrant);
      if (quadrantTasks.length >= 3) {
        const quadrantAvg = Math.round(
          quadrantTasks.reduce((sum, h) => sum + h.actual_duration, 0) / quadrantTasks.length
        );
        predictedTime = quadrantAvg;
        reason = `ממוצע של ${quadrantTasks.length} משימות ברבע ${quadrant}`;
        confidence = 'high';
        basedOn = 'quadrant_history';
      }
    }
    
    // חישוב רמת ביטחון
    if (stats.total_tasks >= 10 && stats.average_accuracy_percentage >= 80) {
      confidence = 'high';
    } else if (stats.total_tasks >= 5) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }
    
    // התאמות לפי אורך המשימה (אם יש כותרת)
    if (title) {
      const titleLength = title.length;
      if (titleLength > 100) {
        predictedTime = Math.round(predictedTime * 1.3);
        reason += ' (משימה מורכבת לפי אורך התיאור)';
      }
    }
    
    return {
      predictedTime: Math.max(5, Math.round(predictedTime)), // לפחות 5 דקות
      confidence,
      reason,
      basedOn,
      stats: {
        totalTasks: stats.total_tasks,
        averageTime: stats.average_time,
        accuracy: stats.average_accuracy_percentage,
        minTime: stats.min_time,
        maxTime: stats.max_time
      }
    };
  } catch (err) {
    console.error('שגיאה בחיזוי זמן:', err);
    
    // ברירת מחדל במקרה של שגיאה
    const category = getCategoryById(taskType);
    return {
      predictedTime: category?.typicalDuration || 30,
      confidence: 'low',
      reason: 'שגיאה בחיזוי, משתמש בערך ברירת מחדל',
      basedOn: 'default',
      stats: null
    };
  }
}

/**
 * קבלת תובנות על דפוסי עבודה לפי סוג משימה
 */
export async function getTaskTypeInsights(userId, taskType) {
  try {
    const { data: history, error } = await supabase
      .from('task_completion_history')
      .select('*')
      .eq('user_id', userId)
      .eq('task_type', taskType)
      .order('completed_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    if (!history || history.length === 0) {
      return {
        insights: [],
        hasData: false
      };
    }

    const insights = [];
    
    // מציאת היום הכי פרודוקטיבי
    const dayDistribution = {};
    history.forEach(h => {
      if (!dayDistribution[h.day_of_week]) {
        dayDistribution[h.day_of_week] = { count: 0, totalAccuracy: 0 };
      }
      dayDistribution[h.day_of_week].count++;
      dayDistribution[h.day_of_week].totalAccuracy += h.accuracy_percentage || 0;
    });
    
    const bestDay = Object.entries(dayDistribution)
      .map(([day, data]) => ({
        day: parseInt(day),
        avgAccuracy: data.count > 0 ? data.totalAccuracy / data.count : 0,
        count: data.count
      }))
      .sort((a, b) => b.avgAccuracy - a.avgAccuracy)[0];
    
    if (bestDay && bestDay.count >= 3) {
      const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
      insights.push({
        type: 'best_day',
        title: 'היום הכי פרודוקטיבי',
        message: `אתה הכי יעיל ביום ${dayNames[bestDay.day]} (${Math.round(bestDay.avgAccuracy)}% דיוק)`,
        icon: '📅',
        data: bestDay
      });
    }
    
    // מציאת השעה הכי טובה
    const hourDistribution = {};
    history.forEach(h => {
      if (!hourDistribution[h.hour_of_day]) {
        hourDistribution[h.hour_of_day] = { count: 0, totalAccuracy: 0 };
      }
      hourDistribution[h.hour_of_day].count++;
      hourDistribution[h.hour_of_day].totalAccuracy += h.accuracy_percentage || 0;
    });
    
    const bestHour = Object.entries(hourDistribution)
      .map(([hour, data]) => ({
        hour: parseInt(hour),
        avgAccuracy: data.count > 0 ? data.totalAccuracy / data.count : 0,
        count: data.count
      }))
      .sort((a, b) => b.avgAccuracy - a.avgAccuracy)[0];
    
    if (bestHour && bestHour.count >= 3) {
      insights.push({
        type: 'best_hour',
        title: 'השעה הכי טובה',
        message: `הכי טוב לעשות את זה בשעה ${bestHour.hour}:00 (${Math.round(bestHour.avgAccuracy)}% דיוק)`,
        icon: '⏰',
        data: bestHour
      });
    }
    
    // ניתוח מגמות - האם משתפרים?
    if (history.length >= 10) {
      const recentTasks = history.slice(0, 5);
      const olderTasks = history.slice(5, 10);
      
      const recentAvgAccuracy = recentTasks.reduce((sum, h) => sum + (h.accuracy_percentage || 0), 0) / recentTasks.length;
      const olderAvgAccuracy = olderTasks.reduce((sum, h) => sum + (h.accuracy_percentage || 0), 0) / olderTasks.length;
      
      const improvement = recentAvgAccuracy - olderAvgAccuracy;
      
      if (Math.abs(improvement) >= 10) {
        insights.push({
          type: 'trend',
          title: improvement > 0 ? 'משתפר!' : 'מגמת ירידה',
          message: improvement > 0
            ? `הדיוק שלך השתפר ב-${Math.round(improvement)}% במשימות האחרונות! 🎉`
            : `הדיוק שלך ירד ב-${Math.abs(Math.round(improvement))}% לאחרונה. אולי כדאי להגדיל את הזמן המשוער?`,
          icon: improvement > 0 ? '📈' : '📉',
          data: { improvement, recentAvgAccuracy, olderAvgAccuracy }
        });
      }
    }
    
    // בדיקת סטיית תקן - עקביות
    const durations = history.map(h => h.actual_duration);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const variance = durations.reduce((sum, d) => sum + Math.pow(d - avgDuration, 2), 0) / durations.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = (stdDev / avgDuration) * 100;
    
    if (coefficientOfVariation < 30) {
      insights.push({
        type: 'consistency',
        title: 'עקביות גבוהה',
        message: `אתה מאוד עקבי בסוג משימה זה - הזמן תמיד דומה!`,
        icon: '🎯',
        data: { coefficientOfVariation }
      });
    } else if (coefficientOfVariation > 60) {
      insights.push({
        type: 'inconsistency',
        title: 'שונות גבוהה',
        message: `יש שונות גדולה בזמני הביצוע. אולי כדאי לפצל לסוגי משימות ספציפיים יותר?`,
        icon: '⚠️',
        data: { coefficientOfVariation }
      });
    }
    
    return {
      insights,
      hasData: true,
      totalTasks: history.length
    };
  } catch (err) {
    console.error('שגיאה בקבלת תובנות:', err);
    return {
      insights: [],
      hasData: false
    };
  }
}

/**
 * קבלת דוח סיכום לכל סוגי המשימות
 */
export async function getTaskTypeSummary(userId) {
  try {
    const stats = await getUserTaskTypeStats(userId);
    
    const summary = stats.map(stat => {
      const category = getCategoryById(stat.task_type);
      return {
        taskType: stat.task_type,
        category,
        totalTasks: stat.total_tasks,
        completedTasks: stat.completed_tasks,
        averageTime: stat.average_time,
        totalTime: stat.total_time_spent,
        accuracy: stat.average_accuracy_percentage,
        accurateEstimates: stat.accurate_estimates,
        completionRate: stat.total_tasks > 0 
          ? Math.round((stat.completed_tasks / stat.total_tasks) * 100)
          : 0
      };
    });
    
    // חישוב סה"כ
    const totals = {
      totalTasks: summary.reduce((sum, s) => sum + s.totalTasks, 0),
      totalTime: summary.reduce((sum, s) => sum + s.totalTime, 0),
      averageAccuracy: summary.length > 0
        ? Math.round(summary.reduce((sum, s) => sum + s.accuracy, 0) / summary.length)
        : 0
    };
    
    // מציאת הסוג הכי נפוץ
    const mostCommon = summary.sort((a, b) => b.totalTasks - a.totalTasks)[0];
    
    // מציאת הסוג הכי מדויק
    const mostAccurate = summary
      .filter(s => s.totalTasks >= 3) // לפחות 3 משימות
      .sort((a, b) => b.accuracy - a.accuracy)[0];
    
    return {
      summary: summary.sort((a, b) => b.totalTasks - a.totalTasks),
      totals,
      mostCommon,
      mostAccurate
    };
  } catch (err) {
    console.error('שגיאה בקבלת סיכום:', err);
    return {
      summary: [],
      totals: { totalTasks: 0, totalTime: 0, averageAccuracy: 0 },
      mostCommon: null,
      mostAccurate: null
    };
  }
}

/**
 * קבלת המלצות לשיפור ניהול זמן
 */
export async function getTimeManagementRecommendations(userId) {
  try {
    const summary = await getTaskTypeSummary(userId);
    const recommendations = [];
    
    // בדיקה אם יש סוגי משימות עם דיוק נמוך
    const lowAccuracyTypes = summary.summary.filter(s => 
      s.totalTasks >= 3 && s.accuracy < 70
    );
    
    if (lowAccuracyTypes.length > 0) {
      lowAccuracyTypes.forEach(type => {
        recommendations.push({
          type: 'low_accuracy',
          taskType: type.taskType,
          priority: 'high',
          title: `שפר הערכות זמן ל${type.category?.name || type.taskType}`,
          message: `הדיוק שלך הוא ${type.accuracy}%. נסה להוסיף 20-30% לזמן המשוער`,
          icon: '⚠️',
          action: 'adjust_estimates'
        });
      });
    }
    
    // בדיקה אם יש סוגי משימות שלוקחים הרבה זמן
    const timeConsumingTypes = summary.summary.filter(s => 
      s.averageTime > 90
    );
    
    if (timeConsumingTypes.length > 0) {
      timeConsumingTypes.forEach(type => {
        recommendations.push({
          type: 'time_consuming',
          taskType: type.taskType,
          priority: 'medium',
          title: `${type.category?.name || type.taskType} לוקח הרבה זמן`,
          message: `ממוצע ${type.averageTime} דקות. שקול לפצל למשימות קטנות יותר`,
          icon: '⏰',
          action: 'split_tasks'
        });
      });
    }
    
    // המלצה להוסיף יותר סוגי משימות
    if (summary.summary.length < 3 && summary.totals.totalTasks >= 10) {
      recommendations.push({
        type: 'diversify',
        priority: 'low',
        title: 'סווג משימות באופן ספציפי יותר',
        message: 'סיווג מדויק יותר יעזור למערכת ללמוד אותך טוב יותר',
        icon: '🎯',
        action: 'use_categories'
      });
    }
    
    // המלצה חיובית אם הכל טוב
    if (summary.totals.averageAccuracy >= 80 && lowAccuracyTypes.length === 0) {
      recommendations.push({
        type: 'excellent',
        priority: 'info',
        title: 'עבודה מצוינת! 🎉',
        message: `דיוק ממוצע של ${summary.totals.averageAccuracy}% - אתה מכיר את עצמך מצוין!`,
        icon: '🌟',
        action: 'keep_going'
      });
    }
    
    return recommendations;
  } catch (err) {
    console.error('שגיאה בקבלת המלצות:', err);
    return [];
  }
}

export default {
  getUserTaskTypeStats,
  getTaskTypeStats,
  predictTaskDuration,
  getTaskTypeInsights,
  getTaskTypeSummary,
  getTimeManagementRecommendations
};


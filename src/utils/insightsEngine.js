/**
 * מנוע תובנות חכם - ניתוח נתונים והמלצות מותאמות אישית
 * עם מעקב היסטוריה והתאמה לפי שימוש
 */

const INSIGHTS_STORAGE_KEY = 'eisenhower_insights_history';
const INSIGHTS_EXPIRY_DAYS = 7; // המלצה מיושמת תופיע שוב אחרי שבוע

/**
 * שמירת היסטוריית המלצות
 */
export function getInsightsHistory() {
  try {
    const data = localStorage.getItem(INSIGHTS_STORAGE_KEY);
    return data ? JSON.parse(data) : { applied: {}, dismissed: {} };
  } catch {
    return { applied: {}, dismissed: {} };
  }
}

export function saveInsightsHistory(history) {
  try {
    localStorage.setItem(INSIGHTS_STORAGE_KEY, JSON.stringify(history));
  } catch (e) {
    console.error('Failed to save insights history:', e);
  }
}

/**
 * סימון המלצה כמיושמת
 */
export function markInsightApplied(insightId) {
  const history = getInsightsHistory();
  history.applied[insightId] = {
    timestamp: Date.now(),
    count: (history.applied[insightId]?.count || 0) + 1
  };
  saveInsightsHistory(history);
}

/**
 * סימון המלצה כנדחית
 */
export function markInsightDismissed(insightId) {
  const history = getInsightsHistory();
  history.dismissed[insightId] = {
    timestamp: Date.now(),
    count: (history.dismissed[insightId]?.count || 0) + 1
  };
  saveInsightsHistory(history);
}

/**
 * בדיקה אם המלצה עדיין רלוונטית (לא יושמה/נדחתה לאחרונה)
 */
export function isInsightRelevant(insightId) {
  const history = getInsightsHistory();
  const now = Date.now();
  const expiryMs = INSIGHTS_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  
  // בדוק אם יושמה לאחרונה
  const applied = history.applied[insightId];
  if (applied && (now - applied.timestamp) < expiryMs) {
    return false;
  }
  
  // בדוק אם נדחתה לאחרונה
  const dismissed = history.dismissed[insightId];
  if (dismissed && (now - dismissed.timestamp) < expiryMs) {
    return false;
  }
  
  return true;
}

/**
 * ניקוי היסטוריה ישנה
 */
export function cleanupInsightsHistory() {
  const history = getInsightsHistory();
  const now = Date.now();
  const expiryMs = INSIGHTS_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  
  Object.keys(history.applied).forEach(key => {
    if (now - history.applied[key].timestamp > expiryMs) {
      delete history.applied[key];
    }
  });
  
  Object.keys(history.dismissed).forEach(key => {
    if (now - history.dismissed[key].timestamp > expiryMs) {
      delete history.dismissed[key];
    }
  });
  
  saveInsightsHistory(history);
}

/**
 * ניתוח דפוסי הערכת זמן
 */
export function analyzeEstimationPatterns(completedTasks) {
  const tasksWithBoth = completedTasks.filter(t => 
    t.estimated_duration && t.time_spent
  );

  if (tasksWithBoth.length < 3) {
    return { hasData: false };
  }

  const estimationRatios = tasksWithBoth.map(t => ({
    ratio: t.time_spent / t.estimated_duration,
    type: t.task_type,
    title: t.title,
    estimated: t.estimated_duration,
    actual: t.time_spent
  }));

  const avgRatio = estimationRatios.reduce((sum, r) => sum + r.ratio, 0) / estimationRatios.length;
  const underEstimated = estimationRatios.filter(r => r.ratio > 1.2).length;
  const overEstimated = estimationRatios.filter(r => r.ratio < 0.8).length;
  const accurate = estimationRatios.filter(r => r.ratio >= 0.8 && r.ratio <= 1.2).length;

  // ניתוח לפי סוג משימה
  const byType = {};
  estimationRatios.forEach(r => {
    if (!byType[r.type]) {
      byType[r.type] = { ratios: [], total: 0 };
    }
    byType[r.type].ratios.push(r.ratio);
    byType[r.type].total++;
  });

  Object.keys(byType).forEach(type => {
    byType[type].avgRatio = byType[type].ratios.reduce((a, b) => a + b, 0) / byType[type].ratios.length;
  });

  // מציאת סוגי משימות בעייתיים
  const problematicTypes = Object.entries(byType)
    .filter(([_, data]) => data.avgRatio > 1.3 && data.total >= 2)
    .map(([type, data]) => ({ type, avgRatio: data.avgRatio, count: data.total }));

  return {
    hasData: true,
    avgRatio,
    underEstimated,
    overEstimated,
    accurate,
    total: tasksWithBoth.length,
    accuracyRate: Math.round((accurate / tasksWithBoth.length) * 100),
    byType,
    problematicTypes,
    tendency: avgRatio > 1.2 ? 'underestimate' : avgRatio < 0.8 ? 'overestimate' : 'accurate'
  };
}

/**
 * ניתוח עמידה בדדליינים
 */
export function analyzeDeadlinePatterns(completedTasks) {
  const tasksWithDeadline = completedTasks.filter(t => t.due_date && t.completed_at);

  if (tasksWithDeadline.length < 3) {
    return { hasData: false };
  }

  const deadlineData = tasksWithDeadline.map(t => {
    const dueDate = new Date(t.due_date);
    const completedDate = new Date(t.completed_at);
    const diffDays = Math.ceil((completedDate - dueDate) / (1000 * 60 * 60 * 24));
    
    return {
      task: t,
      diffDays,
      onTime: diffDays <= 0,
      daysLate: Math.max(0, diffDays),
      daysEarly: Math.max(0, -diffDays),
      dayOfWeek: dueDate.getDay()
    };
  });

  const onTime = deadlineData.filter(d => d.onTime).length;
  const late = deadlineData.filter(d => !d.onTime).length;
  const avgDaysLate = late > 0 
    ? deadlineData.filter(d => !d.onTime).reduce((sum, d) => sum + d.daysLate, 0) / late 
    : 0;

  // ניתוח לפי יום בשבוע - האם יש ימים שבהם יותר איחורים?
  const byDayOfWeek = [0, 1, 2, 3, 4].map(day => {
    const dayTasks = deadlineData.filter(d => d.dayOfWeek === day);
    const dayLate = dayTasks.filter(d => !d.onTime).length;
    return {
      day,
      total: dayTasks.length,
      late: dayLate,
      lateRate: dayTasks.length > 0 ? Math.round((dayLate / dayTasks.length) * 100) : 0
    };
  });

  const problematicDays = byDayOfWeek.filter(d => d.lateRate > 50 && d.total >= 2);

  return {
    hasData: true,
    onTime,
    late,
    total: tasksWithDeadline.length,
    onTimeRate: Math.round((onTime / tasksWithDeadline.length) * 100),
    avgDaysLate: Math.round(avgDaysLate * 10) / 10,
    byDayOfWeek,
    problematicDays
  };
}

/**
 * ניתוח זמן מת
 */
export function analyzeIdleTime(idleStats, workStats) {
  if (!idleStats.byDay || idleStats.byDay.length === 0) {
    return { hasData: false };
  }

  const totalIdle = idleStats.weekly || 0;
  const totalWork = workStats.totalActual || 0;
  const avgIdlePerDay = idleStats.avgPerDay || 0;

  // יחס זמן מת לעבודה
  const idleToWorkRatio = totalWork > 0 ? (totalIdle / totalWork) * 100 : 0;

  // זיהוי ימים עם זמן מת גבוה
  const highIdleDays = idleStats.byDay.filter(d => d.totalMinutes > 60);

  // זיהוי דפוסים - האם זמן מת מרוכז בימים מסוימים?
  const byDayOfWeek = [0, 1, 2, 3, 4].map(day => {
    const dayIdle = idleStats.byDay
      .filter(d => new Date(d.date).getDay() === day)
      .reduce((sum, d) => sum + d.totalMinutes, 0);
    return { day, totalMinutes: dayIdle };
  });

  const maxIdleDay = byDayOfWeek.reduce((max, d) => d.totalMinutes > max.totalMinutes ? d : max, byDayOfWeek[0]);

  return {
    hasData: true,
    totalIdle,
    avgIdlePerDay,
    idleToWorkRatio: Math.round(idleToWorkRatio),
    highIdleDays: highIdleDays.length,
    byDayOfWeek,
    maxIdleDay,
    level: avgIdlePerDay > 90 ? 'high' : avgIdlePerDay > 45 ? 'medium' : 'low'
  };
}

/**
 * ניתוח שעות עבודה
 */
export function analyzeWorkHours(completedTasks) {
  const tasksWithTime = completedTasks.filter(t => t.due_time && t.time_spent);

  if (tasksWithTime.length < 5) {
    return { hasData: false };
  }

  // ניתוח לפי שעה ביום
  const byHour = {};
  tasksWithTime.forEach(t => {
    const hour = parseInt(t.due_time.split(':')[0]);
    if (!byHour[hour]) {
      byHour[hour] = { tasks: 0, totalMinutes: 0, efficiency: [] };
    }
    byHour[hour].tasks++;
    byHour[hour].totalMinutes += t.time_spent || 0;
    if (t.estimated_duration && t.time_spent) {
      byHour[hour].efficiency.push(t.estimated_duration / t.time_spent);
    }
  });

  // חישוב יעילות ממוצעת לכל שעה
  Object.keys(byHour).forEach(hour => {
    const effArr = byHour[hour].efficiency;
    byHour[hour].avgEfficiency = effArr.length > 0 
      ? effArr.reduce((a, b) => a + b, 0) / effArr.length 
      : 1;
  });

  // מציאת שעות פרודוקטיביות
  const hourArray = Object.entries(byHour)
    .map(([hour, data]) => ({ hour: parseInt(hour), ...data }))
    .sort((a, b) => b.avgEfficiency - a.avgEfficiency);

  const mostProductiveHours = hourArray.filter(h => h.avgEfficiency >= 0.9 && h.tasks >= 2);
  const leastProductiveHours = hourArray.filter(h => h.avgEfficiency < 0.7 && h.tasks >= 2);

  return {
    hasData: true,
    byHour,
    mostProductiveHours: mostProductiveHours.slice(0, 3),
    leastProductiveHours: leastProductiveHours.slice(0, 2),
    peakHour: hourArray[0]?.hour
  };
}

/**
 * ניתוח עומס עבודה
 */
export function analyzeWorkload(completedTasks, statsByDay) {
  if (!statsByDay || statsByDay.length === 0) {
    return { hasData: false };
  }

  const workMinutes = statsByDay.map(d => d.totalMinutes);
  const avgWorkPerDay = workMinutes.reduce((a, b) => a + b, 0) / workMinutes.length;
  const maxWork = Math.max(...workMinutes);
  const minWork = Math.min(...workMinutes);
  const variance = maxWork - minWork;

  // זיהוי ימים עמוסים (יותר מ-6 שעות)
  const overloadedDays = statsByDay.filter(d => d.totalMinutes > 360);
  
  // זיהוי ימים ריקים (פחות משעה)
  const emptyDays = statsByDay.filter(d => d.totalMinutes < 60 && d.totalMinutes > 0);

  // האם יש פיזור לא אחיד?
  const isUnbalanced = variance > 240; // הפרש של יותר מ-4 שעות

  return {
    hasData: true,
    avgWorkPerDay: Math.round(avgWorkPerDay),
    maxWork,
    minWork,
    variance,
    overloadedDays: overloadedDays.length,
    emptyDays: emptyDays.length,
    isUnbalanced,
    statsByDay
  };
}

/**
 * יצירת המלצות מותאמות אישית
 */
export function generateInsights(data) {
  const { estimation, deadlines, idle, workHours, workload } = data;
  const insights = [];

  // המלצות הערכת זמן
  if (estimation.hasData) {
    if (estimation.tendency === 'underestimate') {
      const adjustPercent = Math.round((estimation.avgRatio - 1) * 100);
      insights.push({
        id: 'estimation-low',
        category: 'estimation',
        priority: 'high',
        icon: '⏱️',
        title: 'הערכות זמן נמוכות מדי',
        description: `בממוצע את לוקחת ${adjustPercent}% יותר זמן ממה שהערכת.`,
        recommendation: `נסי להוסיף ${adjustPercent}% לכל הערכה. לדוגמה: אם חשבת שעה - תכנני שעה ורבע.`,
        impact: 'שיפור דיוק ההערכות יעזור לך לתכנן טוב יותר ולהפחית לחץ',
        action: {
          id: 'estimation-low',
          label: `הוסף ${adjustPercent}% להערכות עתידיות`,
          params: { adjustmentPercent: adjustPercent }
        }
      });
    }

    if (estimation.problematicTypes.length > 0) {
      const worstType = estimation.problematicTypes[0];
      const adjustPercent = Math.round((worstType.avgRatio - 1) * 100);
      insights.push({
        id: 'estimation-type',
        category: 'estimation',
        priority: 'medium',
        icon: '📊',
        title: `הערכה בעייתית: ${worstType.type}`,
        description: `משימות מסוג זה לוקחות בממוצע ${adjustPercent}% יותר מההערכה.`,
        recommendation: `כשמדובר ב${worstType.type}, הכפילי את ההערכה הראשונית.`,
        impact: 'התאמה ספציפית לסוג משימה תשפר את התכנון הכללי',
        action: {
          id: 'estimation-type',
          label: `הוסף ${adjustPercent}% להערכות ${worstType.type}`,
          params: { adjustmentPercent: adjustPercent, taskType: worstType.type }
        }
      });
    }

    if (estimation.accuracyRate >= 70) {
      insights.push({
        id: 'estimation-good',
        category: 'estimation',
        priority: 'positive',
        icon: '🎯',
        title: 'הערכת זמן מצוינת!',
        description: `${estimation.accuracyRate}% מההערכות שלך מדויקות.`,
        recommendation: 'המשיכי ככה! את יודעת להעריך זמן טוב.',
        impact: null
      });
    }
  }

  // המלצות דדליינים
  if (deadlines.hasData) {
    if (deadlines.onTimeRate < 70) {
      insights.push({
        id: 'deadlines-low',
        category: 'deadlines',
        priority: 'high',
        icon: '⏰',
        title: 'קושי בעמידה בדדליינים',
        description: `רק ${deadlines.onTimeRate}% מהמשימות הסתיימו בזמן. איחור ממוצע: ${deadlines.avgDaysLate} ימים.`,
        recommendation: 'נסי להתחיל משימות יום-יומיים לפני הדדליין, או לקבוע דדליינים מוקדמים יותר.',
        impact: 'עמידה בדדליינים מפחיתה לחץ ומשפרת אמון עצמי',
        action: {
          id: 'deadlines-low',
          label: 'הקדם את כל הדדליינים ביום',
          params: { bufferDays: 1 }
        }
      });
    }

    if (deadlines.problematicDays.length > 0) {
      const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי'];
      const problemDayIndex = deadlines.problematicDays[0].day;
      const problemDay = dayNames[problemDayIndex];
      insights.push({
        id: 'deadlines-day',
        category: 'deadlines',
        priority: 'medium',
        icon: '📅',
        title: `יום ${problemDay} בעייתי`,
        description: `יש לך יותר איחורים בדדליינים שנקבעו ליום ${problemDay}.`,
        recommendation: `נסי לא לקבוע דדליינים קריטיים ליום ${problemDay}, או להתחיל במשימות האלה מוקדם יותר.`,
        impact: 'התאמה ללוח הזמנים האישי שלך',
        action: {
          id: 'deadlines-day',
          label: `הזז משימות מיום ${problemDay}`,
          params: { dayIndex: problemDayIndex }
        }
      });
    }

    if (deadlines.onTimeRate >= 85) {
      insights.push({
        id: 'deadlines-good',
        category: 'deadlines',
        priority: 'positive',
        icon: '✅',
        title: 'עמידה מעולה בדדליינים!',
        description: `${deadlines.onTimeRate}% מהמשימות הסתיימו בזמן.`,
        recommendation: 'את מנהלת זמן מצוין. שמרי על הקצב!',
        impact: null
      });
    }
  }

  // המלצות זמן מת
  if (idle.hasData) {
    if (idle.level === 'high') {
      insights.push({
        id: 'idle-high',
        category: 'idle',
        priority: 'medium',
        icon: '⏸️',
        title: 'זמן מת גבוה',
        description: `בממוצע ${idle.avgIdlePerDay} דקות זמן מת ביום (${idle.idleToWorkRatio}% מזמן העבודה).`,
        recommendation: 'הכיני רשימת "משימות מילוי" קצרות (5-15 דקות) שאפשר לעשות בין משימות: מיילים, קריאה, סידור.',
        impact: 'ניצול זמן מת יכול להוסיף שעות פרודוקטיביות בשבוע',
        action: {
          id: 'idle-high',
          label: 'צור משימות מילוי',
          params: {}
        }
      });
    }

    if (idle.maxIdleDay && idle.maxIdleDay.totalMinutes > 90) {
      const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי'];
      insights.push({
        id: 'idle-day',
        category: 'idle',
        priority: 'low',
        icon: '📆',
        title: `יום ${dayNames[idle.maxIdleDay.day]} עם הרבה זמן מת`,
        description: `ביום ${dayNames[idle.maxIdleDay.day]} יש לך הכי הרבה זמן מת.`,
        recommendation: 'נסי לתכנן יותר משימות ליום הזה או להשתמש בו לעבודה שדורשת פחות ריכוז.',
        impact: 'איזון עומס בין הימים'
      });
    }

    if (idle.level === 'low') {
      insights.push({
        id: 'idle-good',
        category: 'idle',
        priority: 'positive',
        icon: '⚡',
        title: 'ניצול זמן מצוין!',
        description: `רק ${idle.avgIdlePerDay} דקות זמן מת ביום בממוצע.`,
        recommendation: 'את מנצלת את הזמן יפה. רק זכרי לקחת הפסקות מכוונות!',
        impact: null
      });
    }
  }

  // המלצות שעות עבודה
  if (workHours.hasData) {
    if (workHours.mostProductiveHours.length > 0) {
      const bestHours = workHours.mostProductiveHours.map(h => `${h.hour}:00`).join(', ');
      const productiveHoursList = workHours.mostProductiveHours.map(h => h.hour);
      insights.push({
        id: 'hours-productive',
        category: 'productivity',
        priority: 'medium',
        icon: '🌟',
        title: 'שעות הזהב שלך',
        description: `את הכי פרודוקטיבית בשעות: ${bestHours}`,
        recommendation: 'תכנני משימות מורכבות וחשובות לשעות האלה. שמרי אותן למשימות שדורשות ריכוז.',
        impact: 'עבודה בשעות אופטימליות יכולה להגדיל יעילות ב-20-30%',
        action: {
          id: 'hours-productive',
          label: 'שבץ משימות מורכבות לשעות אלה',
          params: { productiveHours: productiveHoursList }
        }
      });
    }

    if (workHours.leastProductiveHours.length > 0) {
      const worstHours = workHours.leastProductiveHours.map(h => `${h.hour}:00`).join(', ');
      insights.push({
        id: 'hours-low',
        category: 'productivity',
        priority: 'low',
        icon: '😴',
        title: 'שעות פחות פרודוקטיביות',
        description: `היעילות שלך נמוכה יותר בשעות: ${worstHours}`,
        recommendation: 'נסי לתכנן לשעות האלה משימות פשוטות יותר, פגישות, או הפסקות.',
        impact: 'התאמת סוג המשימה לרמת האנרגיה'
      });
    }
  }

  // המלצות עומס עבודה
  if (workload.hasData) {
    if (workload.isUnbalanced) {
      insights.push({
        id: 'workload-unbalanced',
        category: 'workload',
        priority: 'medium',
        icon: '⚖️',
        title: 'עומס לא מאוזן',
        description: `יש הפרש של ${Math.round(workload.variance / 60)} שעות בין הימים העמוסים לריקים.`,
        recommendation: 'נסי לפזר משימות באופן אחיד יותר על פני השבוע. השתמשי בשיבוץ אוטומטי.',
        impact: 'עומס מאוזן מפחית שחיקה ומשפר איכות עבודה',
        action: {
          id: 'workload-unbalanced',
          label: 'אזן עומס אוטומטית',
          params: {}
        }
      });
    }

    if (workload.overloadedDays > 2) {
      insights.push({
        id: 'workload-high',
        category: 'workload',
        priority: 'high',
        icon: '🔥',
        title: 'ימים עמוסים מדי',
        description: `יש לך ${workload.overloadedDays} ימים עם יותר מ-6 שעות עבודה.`,
        recommendation: 'נסי להגביל את עצמך ל-5-6 שעות עבודה אפקטיבית ביום. יותר מזה פוגע ביעילות.',
        impact: 'מניעת שחיקה ושמירה על פרודוקטיביות ארוכת טווח',
        action: {
          id: 'workload-high',
          label: 'הפחת עומס מימים עמוסים',
          params: {}
        }
      });
    }
  }

  // מיון לפי עדיפות
  const priorityOrder = { high: 0, medium: 1, low: 2, positive: 3 };
  insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // סינון המלצות שכבר יושמו או נדחו לאחרונה
  const relevantInsights = insights.filter(insight => isInsightRelevant(insight.id));

  return relevantInsights;
}

/**
 * סיכום כללי
 */
export function generateSummary(data) {
  const { estimation, deadlines, idle, workload } = data;
  
  let score = 70; // ציון בסיס
  const factors = [];

  if (estimation.hasData) {
    if (estimation.accuracyRate >= 70) {
      score += 10;
      factors.push({ name: 'הערכת זמן', positive: true });
    } else if (estimation.accuracyRate < 50) {
      score -= 10;
      factors.push({ name: 'הערכת זמן', positive: false });
    }
  }

  if (deadlines.hasData) {
    if (deadlines.onTimeRate >= 80) {
      score += 10;
      factors.push({ name: 'עמידה בדדליינים', positive: true });
    } else if (deadlines.onTimeRate < 60) {
      score -= 15;
      factors.push({ name: 'עמידה בדדליינים', positive: false });
    }
  }

  if (idle.hasData) {
    if (idle.level === 'low') {
      score += 5;
      factors.push({ name: 'ניצול זמן', positive: true });
    } else if (idle.level === 'high') {
      score -= 5;
      factors.push({ name: 'ניצול זמן', positive: false });
    }
  }

  if (workload.hasData) {
    if (!workload.isUnbalanced && workload.overloadedDays <= 1) {
      score += 5;
      factors.push({ name: 'איזון עומס', positive: true });
    } else if (workload.overloadedDays > 2) {
      score -= 5;
      factors.push({ name: 'איזון עומס', positive: false });
    }
  }

  score = Math.max(0, Math.min(100, score));

  let level, message;
  if (score >= 85) {
    level = 'excellent';
    message = 'מעולה! את מנהלת זמן ברמה גבוהה מאוד';
  } else if (score >= 70) {
    level = 'good';
    message = 'טוב! יש מקום לשיפור קל בכמה תחומים';
  } else if (score >= 55) {
    level = 'fair';
    message = 'סביר. יש כמה תחומים שדורשים תשומת לב';
  } else {
    level = 'needs-work';
    message = 'יש מקום לשיפור משמעותי. קראי את ההמלצות בעיון';
  }

  return {
    score,
    level,
    message,
    factors
  };
}

export default {
  analyzeEstimationPatterns,
  analyzeDeadlinePatterns,
  analyzeIdleTime,
  analyzeWorkHours,
  analyzeWorkload,
  generateInsights,
  generateSummary
};

/**
 * הערכת זמן אוטומטית - המערכת לומדת כמה זמן לוקח לסיים משימות דומות
 */

/**
 * חישוב ממוצע זמן ביצוע למשימות דומות
 */
export function calculateAverageTime(tasks, currentTask) {
  if (!tasks || tasks.length === 0) return null;

  // מציאת משימות דומות לפי:
  // 1. כותרת דומה (מילות מפתח משותפות)
  // 2. רבע זהה
  // 3. משימות שהושלמו
  const similarTasks = tasks.filter(task => {
    if (!task.is_completed || !task.time_spent || task.time_spent === 0) return false;
    if (!task.estimated_duration) return false;
    
    // בדיקה אם המשימה באותו רבע
    if (currentTask.quadrant && task.quadrant !== currentTask.quadrant) return false;
    
    // בדיקה אם יש מילות מפתח משותפות בכותרת
    if (currentTask.title) {
      const currentKeywords = extractKeywords(currentTask.title);
      const taskKeywords = extractKeywords(task.title);
      const commonKeywords = currentKeywords.filter(k => taskKeywords.includes(k));
      
      // אם יש לפחות מילה אחת משותפת, זה דומה
      return commonKeywords.length > 0;
    }
    
    return true;
  });

  if (similarTasks.length === 0) return null;

  // חישוב ממוצע זמן ביצוע בפועל
  const totalTime = similarTasks.reduce((sum, task) => sum + (task.time_spent || 0), 0);
  const averageTime = Math.round(totalTime / similarTasks.length);

  // חישוב ממוצע יחס (זמן בפועל / זמן משוער)
  const ratios = similarTasks
    .filter(task => task.estimated_duration && task.estimated_duration > 0)
    .map(task => task.time_spent / task.estimated_duration);
  
  const averageRatio = ratios.length > 0
    ? ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length
    : 1;

  return {
    averageTime,
    averageRatio,
    sampleSize: similarTasks.length,
    confidence: calculateConfidence(similarTasks.length)
  };
}

/**
 * חילוץ מילות מפתח מטקסט
 */
function extractKeywords(text) {
  if (!text) return [];
  
  // הסרת תווים מיוחדים והמרה לאותיות קטנות
  const cleaned = text.toLowerCase()
    .replace(/[^\u0590-\u05FF\u0600-\u06FFa-z0-9\s]/g, ' ')
    .trim();
  
  // פיצול למילים והסרת מילים קצרות מדי
  const words = cleaned.split(/\s+/)
    .filter(word => word.length >= 2)
    .filter(word => !isStopWord(word));
  
  return words;
}

/**
 * בדיקה אם מילה היא מילת עצירה (לא רלוונטית)
 */
function isStopWord(word) {
  const stopWords = [
    'את', 'על', 'של', 'אל', 'עם', 'ב', 'ל', 'ה', 'ו', 'כ', 'מ',
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'
  ];
  return stopWords.includes(word.toLowerCase());
}

/**
 * חישוב רמת ביטחון בהערכה
 */
function calculateConfidence(sampleSize) {
  if (sampleSize >= 10) return 'high';
  if (sampleSize >= 5) return 'medium';
  if (sampleSize >= 2) return 'low';
  return 'very-low';
}

/**
 * הצעת זמן משוער למשימה חדשה
 */
export function suggestEstimatedTime(tasks, currentTask) {
  const estimation = calculateAverageTime(tasks, currentTask);
  
  if (!estimation) {
    // אם אין משימות דומות, נציע לפי רבע
    return suggestByQuadrant(tasks, currentTask);
  }

  // אם יש הערכה קיימת, נשתמש בה
  if (currentTask.estimated_duration) {
    // נשפר את ההערכה לפי היחס הממוצע
    const adjustedTime = Math.round(currentTask.estimated_duration * estimation.averageRatio);
    return {
      suggestedTime: adjustedTime,
      originalTime: currentTask.estimated_duration,
      confidence: estimation.confidence,
      reason: `מבוסס על ${estimation.sampleSize} משימות דומות (יחס ממוצע: ${(estimation.averageRatio * 100).toFixed(0)}%)`
    };
  }

  // אם אין הערכה קיימת, נשתמש בממוצע
  return {
    suggestedTime: estimation.averageTime,
    confidence: estimation.confidence,
    reason: `מבוסס על ממוצע של ${estimation.sampleSize} משימות דומות`
  };
}

/**
 * הצעה לפי רבע (אם אין משימות דומות)
 */
function suggestByQuadrant(tasks, currentTask) {
  if (!currentTask.quadrant) return null;

  // מציאת משימות באותו רבע שהושלמו
  const quadrantTasks = tasks.filter(task => 
    task.quadrant === currentTask.quadrant &&
    task.is_completed &&
    task.time_spent &&
    task.time_spent > 0
  );

  if (quadrantTasks.length === 0) return null;

  const avgTime = Math.round(
    quadrantTasks.reduce((sum, task) => sum + (task.time_spent || 0), 0) / quadrantTasks.length
  );

  return {
    suggestedTime: avgTime,
    confidence: calculateConfidence(quadrantTasks.length),
    reason: `מבוסס על ממוצע של ${quadrantTasks.length} משימות באותו רבע`
  };
}

/**
 * ניתוח דיוק הערכות
 */
export function analyzeEstimationAccuracy(tasks) {
  const tasksWithEstimates = tasks.filter(task => 
    task.estimated_duration && 
    task.time_spent && 
    task.is_completed
  );

  if (tasksWithEstimates.length === 0) {
    return {
      totalTasks: 0,
      averageAccuracy: 0,
      overestimated: 0,
      underestimated: 0,
      accurate: 0
    };
  }

  const accuracies = tasksWithEstimates.map(task => {
    const ratio = task.time_spent / task.estimated_duration;
    return {
      task,
      ratio,
      accuracy: ratio <= 1 ? (ratio * 100) : (100 / ratio * 100) // אחוז דיוק
    };
  });

  const averageAccuracy = Math.round(
    accuracies.reduce((sum, a) => sum + a.accuracy, 0) / accuracies.length
  );

  const overestimated = accuracies.filter(a => a.ratio < 0.8).length; // לקח פחות מ-80% מהמשוער
  const underestimated = accuracies.filter(a => a.ratio > 1.2).length; // לקח יותר מ-120% מהמשוער
  const accurate = accuracies.filter(a => a.ratio >= 0.8 && a.ratio <= 1.2).length;

  return {
    totalTasks: tasksWithEstimates.length,
    averageAccuracy,
    overestimated,
    underestimated,
    accurate,
    accuracyByQuadrant: {
      1: calculateQuadrantAccuracy(tasksWithEstimates, 1),
      2: calculateQuadrantAccuracy(tasksWithEstimates, 2),
      3: calculateQuadrantAccuracy(tasksWithEstimates, 3),
      4: calculateQuadrantAccuracy(tasksWithEstimates, 4)
    }
  };
}

/**
 * חישוב דיוק לפי רבע
 */
function calculateQuadrantAccuracy(tasks, quadrant) {
  const quadrantTasks = tasks.filter(t => t.quadrant === quadrant);
  if (quadrantTasks.length === 0) return null;

  const accuracies = quadrantTasks.map(task => {
    const ratio = task.time_spent / task.estimated_duration;
    return ratio <= 1 ? (ratio * 100) : (100 / ratio * 100);
  });

  return Math.round(
    accuracies.reduce((sum, a) => sum + a, 0) / accuracies.length
  );
}


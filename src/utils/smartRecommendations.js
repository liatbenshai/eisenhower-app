/**
 * המלצות חכמות - מתי לעבוד על מה לפי דפוסי עבודה
 */

/**
 * ניתוח דפוסי עבודה
 */
export function analyzeWorkPatterns(tasks, timeBlocks = []) {
  const completedTasks = tasks.filter(t => t.is_completed && t.completed_at);
  
  // ניתוח לפי שעות היום
  const hourPatterns = analyzeByHour(completedTasks, timeBlocks);
  
  // ניתוח לפי ימי השבוע
  const dayPatterns = analyzeByDay(completedTasks, timeBlocks);
  
  // ניתוח לפי רבע
  const quadrantPatterns = analyzeByQuadrant(completedTasks);
  
  // ניתוח לפי סוג משימה
  const taskTypePatterns = analyzeByTaskType(completedTasks);
  
  return {
    hourPatterns,
    dayPatterns,
    quadrantPatterns,
    taskTypePatterns,
    bestTimeForQuadrant: calculateBestTimeForQuadrant(hourPatterns, quadrantPatterns),
    recommendations: generateRecommendations(hourPatterns, dayPatterns, quadrantPatterns, taskTypePatterns)
  };
}

/**
 * ניתוח לפי שעות היום
 */
function analyzeByHour(completedTasks, timeBlocks) {
  const hourStats = {};
  
  // ניתוח משימות שהושלמו
  completedTasks.forEach(task => {
    if (!task.completed_at) return;
    const hour = new Date(task.completed_at).getHours();
    if (!hourStats[hour]) {
      hourStats[hour] = { count: 0, totalTime: 0, tasks: [] };
    }
    hourStats[hour].count++;
    hourStats[hour].totalTime += task.time_spent || 0;
    hourStats[hour].tasks.push(task);
  });
  
  // ניתוח בלוקי זמן
  timeBlocks.forEach(block => {
    if (!block.actual_start_time) return;
    const hour = new Date(block.actual_start_time).getHours();
    if (!hourStats[hour]) {
      hourStats[hour] = { count: 0, totalTime: 0, tasks: [] };
    }
    hourStats[hour].count++;
    const duration = block.actual_end_time && block.actual_start_time
      ? Math.round((new Date(block.actual_end_time) - new Date(block.actual_start_time)) / (1000 * 60))
      : 0;
    hourStats[hour].totalTime += duration;
  });
  
  // חישוב ממוצעים
  Object.keys(hourStats).forEach(hour => {
    const stats = hourStats[hour];
    stats.averageTime = stats.count > 0 ? Math.round(stats.totalTime / stats.count) : 0;
    stats.productivity = calculateProductivityScore(stats);
  });
  
  return hourStats;
}

/**
 * ניתוח לפי ימי השבוע
 */
function analyzeByDay(completedTasks, timeBlocks) {
  const dayStats = {};
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  days.forEach(day => {
    dayStats[day] = { count: 0, totalTime: 0, tasks: [] };
  });
  
  completedTasks.forEach(task => {
    if (!task.completed_at) return;
    const day = days[new Date(task.completed_at).getDay()];
    dayStats[day].count++;
    dayStats[day].totalTime += task.time_spent || 0;
    dayStats[day].tasks.push(task);
  });
  
  timeBlocks.forEach(block => {
    if (!block.actual_start_time) return;
    const day = days[new Date(block.actual_start_time).getDay()];
    dayStats[day].count++;
    const duration = block.actual_end_time && block.actual_start_time
      ? Math.round((new Date(block.actual_end_time) - new Date(block.actual_start_time)) / (1000 * 60))
      : 0;
    dayStats[day].totalTime += duration;
  });
  
  // חישוב ממוצעים
  Object.keys(dayStats).forEach(day => {
    const stats = dayStats[day];
    stats.averageTime = stats.count > 0 ? Math.round(stats.totalTime / stats.count) : 0;
    stats.productivity = calculateProductivityScore(stats);
  });
  
  return dayStats;
}

/**
 * ניתוח לפי רבע
 */
function analyzeByQuadrant(completedTasks) {
  const quadrantStats = { 1: [], 2: [], 3: [], 4: [] };
  
  completedTasks.forEach(task => {
    if (task.quadrant && task.time_spent) {
      quadrantStats[task.quadrant].push(task);
    }
  });
  
  Object.keys(quadrantStats).forEach(quadrant => {
    const tasks = quadrantStats[quadrant];
    quadrantStats[quadrant] = {
      count: tasks.length,
      totalTime: tasks.reduce((sum, t) => sum + (t.time_spent || 0), 0),
      averageTime: tasks.length > 0 
        ? Math.round(tasks.reduce((sum, t) => sum + (t.time_spent || 0), 0) / tasks.length)
        : 0,
      tasks
    };
  });
  
  return quadrantStats;
}

/**
 * ניתוח לפי סוג משימה
 */
function analyzeByTaskType(completedTasks) {
  const typeStats = {
    projects: [],
    regular: [],
    urgent: [],
    important: []
  };
  
  completedTasks.forEach(task => {
    if (task.is_project) {
      typeStats.projects.push(task);
    } else {
      typeStats.regular.push(task);
    }
    
    if (task.quadrant === 1 || task.quadrant === 3) {
      typeStats.urgent.push(task);
    }
    
    if (task.quadrant === 1 || task.quadrant === 2) {
      typeStats.important.push(task);
    }
  });
  
  Object.keys(typeStats).forEach(type => {
    const tasks = typeStats[type];
    typeStats[type] = {
      count: tasks.length,
      totalTime: tasks.reduce((sum, t) => sum + (t.time_spent || 0), 0),
      averageTime: tasks.length > 0
        ? Math.round(tasks.reduce((sum, t) => sum + (t.time_spent || 0), 0) / tasks.length)
        : 0
    };
  });
  
  return typeStats;
}

/**
 * חישוב ציון פרודוקטיביות
 */
function calculateProductivityScore(stats) {
  // ציון מבוסס על כמות משימות וזמן כולל
  const taskScore = Math.min(100, stats.count * 10);
  const timeScore = Math.min(100, stats.totalTime / 10);
  return Math.round((taskScore + timeScore) / 2);
}

/**
 * חישוב זמן אופטימלי לכל רבע
 */
function calculateBestTimeForQuadrant(hourPatterns, quadrantPatterns) {
  const bestTimes = {};
  
  [1, 2, 3, 4].forEach(quadrant => {
    const quadrantTasks = quadrantPatterns[quadrant]?.tasks || [];
    
    // מציאת השעה שבה הושלמו הכי הרבה משימות מהרבע הזה
    const hourCounts = {};
    quadrantTasks.forEach(task => {
      if (!task.completed_at) return;
      const hour = new Date(task.completed_at).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    
    const bestHour = Object.keys(hourCounts).reduce((a, b) => 
      hourCounts[a] > hourCounts[b] ? a : b, null
    );
    
    bestTimes[quadrant] = bestHour ? parseInt(bestHour) : null;
  });
  
  return bestTimes;
}

/**
 * יצירת המלצות
 */
function generateRecommendations(hourPatterns, dayPatterns, quadrantPatterns, taskTypePatterns) {
  const recommendations = [];
  
  // מציאת השעות הכי פרודוקטיביות
  const productiveHours = Object.keys(hourPatterns)
    .map(hour => ({
      hour: parseInt(hour),
      score: hourPatterns[hour].productivity
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  
  if (productiveHours.length > 0) {
    recommendations.push({
      type: 'best_hours',
      title: 'שעות פרודוקטיביות',
      message: `השעות הכי פרודוקטיביות שלך: ${productiveHours.map(h => `${h.hour}:00`).join(', ')}`,
      priority: 'high'
    });
  }
  
  // מציאת הימים הכי פרודוקטיביים
  const productiveDays = Object.keys(dayPatterns)
    .map(day => ({
      day,
      score: dayPatterns[day].productivity
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);
  
  if (productiveDays.length > 0) {
    const dayNames = {
      'Sunday': 'ראשון',
      'Monday': 'שני',
      'Tuesday': 'שלישי',
      'Wednesday': 'רביעי',
      'Thursday': 'חמישי',
      'Friday': 'שישי',
      'Saturday': 'שבת'
    };
    
    recommendations.push({
      type: 'best_days',
      title: 'ימים פרודוקטיביים',
      message: `הימים הכי פרודוקטיביים שלך: ${productiveDays.map(d => dayNames[d.day]).join(', ')}`,
      priority: 'medium'
    });
  }
  
  // המלצה על רבעים
  const urgentTasks = quadrantPatterns[1]?.count || 0;
  const importantTasks = quadrantPatterns[2]?.count || 0;
  
  if (urgentTasks > importantTasks * 2) {
    recommendations.push({
      type: 'urgent_warning',
      title: 'יותר מדי משימות דחופות',
      message: 'יש לך הרבה משימות דחופות. נסי לתכנן יותר מראש כדי להימנע מזה.',
      priority: 'high'
    });
  }
  
  return recommendations;
}

/**
 * המלצות למשימות ספציפיות
 */
export function getTaskRecommendations(tasks, currentTask, patterns) {
  const recommendations = [];
  
  if (!currentTask) return recommendations;
  
  // המלצה על זמן אופטימלי
  if (patterns.bestTimeForQuadrant[currentTask.quadrant]) {
    const bestHour = patterns.bestTimeForQuadrant[currentTask.quadrant];
    recommendations.push({
      type: 'optimal_time',
      message: `הזמן האופטימלי לעבודה על משימות מהרבע הזה הוא סביב ${bestHour}:00`,
      priority: 'medium'
    });
  }
  
  // המלצה על תאריך יעד
  if (currentTask.quadrant === 1) {
    recommendations.push({
      type: 'urgent_task',
      message: 'זו משימה דחופה וחשובה - כדאי לעבוד עליה היום או מחר',
      priority: 'high'
    });
  } else if (currentTask.quadrant === 2) {
    recommendations.push({
      type: 'planning_task',
      message: 'זו משימה חשובה - כדאי לתכנן זמן לעבודה עליה השבוע',
      priority: 'medium'
    });
  }
  
  return recommendations;
}


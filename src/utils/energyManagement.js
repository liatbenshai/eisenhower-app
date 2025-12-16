/**
 * ניהול אנרגיה - מתי יש אנרגיה למשימות קשות
 * המערכת לומדת את דפוסי האנרגיה של המשתמש ומתכננת בהתאם
 */

import { TASK_CATEGORIES } from './taskCategories';

/**
 * רמות אנרגיה
 */
export const ENERGY_LEVELS = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  VERY_LOW: 'very_low'
};

/**
 * חישוב רמת אנרגיה צפויה לפי שעה ביום
 */
export function calculateEnergyLevel(hour, dayOfWeek = null, workPatterns = null) {
  // אם יש דפוסי עבודה, נשתמש בהם
  if (workPatterns?.hourPatterns && workPatterns.hourPatterns[hour]) {
    const productivity = workPatterns.hourPatterns[hour].productivity;
    if (productivity >= 80) return ENERGY_LEVELS.HIGH;
    if (productivity >= 60) return ENERGY_LEVELS.MEDIUM;
    if (productivity >= 40) return ENERGY_LEVELS.LOW;
    return ENERGY_LEVELS.VERY_LOW;
  }
  
  // ברירת מחדל - דפוס אנרגיה טיפוסי
  // בוקר (6-12): אנרגיה גבוהה
  if (hour >= 6 && hour < 12) {
    // שיא האנרגיה סביב 9-11
    if (hour >= 9 && hour <= 11) return ENERGY_LEVELS.HIGH;
    return ENERGY_LEVELS.MEDIUM;
  }
  
  // צהריים (12-15): אנרגיה בינונית-נמוכה (אחרי ארוחה)
  if (hour >= 12 && hour < 15) {
    return ENERGY_LEVELS.LOW;
  }
  
  // אחר צהריים (15-18): אנרגיה בינונית
  if (hour >= 15 && hour < 18) {
    return ENERGY_LEVELS.MEDIUM;
  }
  
  // ערב (18-22): אנרגיה נמוכה-בינונית
  if (hour >= 18 && hour < 22) {
    return ENERGY_LEVELS.LOW;
  }
  
  // לילה (22-6): אנרגיה נמוכה מאוד
  return ENERGY_LEVELS.VERY_LOW;
}

/**
 * בדיקה אם יש מספיק אנרגיה למשימה
 */
export function hasEnoughEnergy(task, hour, workPatterns = null) {
  const energyLevel = calculateEnergyLevel(hour, null, workPatterns);
  const { category } = require('./taskCategories').detectTaskCategory(task);
  
  // מיפוי רמת אנרגיה נדרשת
  const requiredEnergy = {
    high: ENERGY_LEVELS.HIGH,
    medium: ENERGY_LEVELS.MEDIUM,
    low: ENERGY_LEVELS.LOW
  }[category.energyLevel] || ENERGY_LEVELS.MEDIUM;
  
  // מיפוי רמות אנרגיה למספרים להשוואה
  const energyValues = {
    [ENERGY_LEVELS.HIGH]: 4,
    [ENERGY_LEVELS.MEDIUM]: 3,
    [ENERGY_LEVELS.LOW]: 2,
    [ENERGY_LEVELS.VERY_LOW]: 1
  };
  
  return energyValues[energyLevel] >= energyValues[requiredEnergy];
}

/**
 * מציאת שעות אופטימליות למשימה לפי רמת אנרגיה
 */
export function findOptimalHoursForTask(task, workPatterns = null) {
  const { category } = require('./taskCategories').detectTaskCategory(task);
  const requiredEnergy = category.energyLevel;
  
  const optimalHours = [];
  
  // בדיקה לכל שעה ביום
  for (let hour = 6; hour <= 22; hour++) {
    const energyLevel = calculateEnergyLevel(hour, null, workPatterns);
    
    // בדיקה אם יש מספיק אנרגיה
    if (hasEnoughEnergy(task, hour, workPatterns)) {
      optimalHours.push({
        hour,
        energyLevel,
        score: calculateTimeScore(hour, category, workPatterns)
      });
    }
  }
  
  // מיון לפי ציון
  return optimalHours.sort((a, b) => b.score - a.score);
}

/**
 * חישוב ציון זמן למשימה
 */
function calculateTimeScore(hour, category, workPatterns) {
  let score = 0;
  
  // התאמה ל-bestTimeOfDay
  if (category.bestTimeOfDay === 'morning' && hour >= 6 && hour < 12) {
    score += 30;
  } else if (category.bestTimeOfDay === 'afternoon' && hour >= 12 && hour < 18) {
    score += 30;
  } else if (category.bestTimeOfDay === 'evening' && hour >= 18 && hour < 22) {
    score += 30;
  } else if (category.bestTimeOfDay === 'any') {
    score += 15;
  }
  
  // אם יש דפוסי עבודה, נשתמש בהם
  if (workPatterns?.hourPatterns && workPatterns.hourPatterns[hour]) {
    score += workPatterns.hourPatterns[hour].productivity * 0.5;
  }
  
  // העדפה לשעות בוקר (בדרך כלל יותר פרודוקטיבי)
  if (hour >= 9 && hour <= 11) {
    score += 20;
  }
  
  return score;
}

/**
 * ניתוח דפוסי אנרגיה
 */
export function analyzeEnergyPatterns(tasks, timeBlocks = []) {
  const energyByHour = {};
  
  // אתחול
  for (let hour = 6; hour <= 22; hour++) {
    energyByHour[hour] = {
      tasksCompleted: 0,
      totalTime: 0,
      highEnergyTasks: 0,
      averageCompletionRate: 0
    };
  }
  
  // ניתוח משימות שהושלמו
  tasks.filter(t => t.is_completed && t.completed_at).forEach(task => {
    const hour = new Date(task.completed_at).getHours();
    if (hour >= 6 && hour <= 22) {
      energyByHour[hour].tasksCompleted++;
      energyByHour[hour].totalTime += task.time_spent || 0;
      
      const { category } = require('./taskCategories').detectTaskCategory(task);
      if (category.energyLevel === 'high') {
        energyByHour[hour].highEnergyTasks++;
      }
    }
  });
  
  // חישוב ציון אנרגיה לכל שעה
  Object.keys(energyByHour).forEach(hour => {
    const stats = energyByHour[hour];
    const energyScore = calculateEnergyScore(stats);
    energyByHour[hour].energyScore = energyScore;
    energyByHour[hour].energyLevel = getEnergyLevelFromScore(energyScore);
  });
  
  return energyByHour;
}

/**
 * חישוב ציון אנרגיה
 */
function calculateEnergyScore(stats) {
  // ציון מבוסס על כמות משימות, זמן, ומשימות קשות
  const taskScore = Math.min(100, stats.tasksCompleted * 15);
  const timeScore = Math.min(100, stats.totalTime / 5);
  const hardTaskScore = Math.min(100, stats.highEnergyTasks * 25);
  
  return Math.round((taskScore + timeScore + hardTaskScore) / 3);
}

/**
 * קבלת רמת אנרגיה מציון
 */
function getEnergyLevelFromScore(score) {
  if (score >= 70) return ENERGY_LEVELS.HIGH;
  if (score >= 50) return ENERGY_LEVELS.MEDIUM;
  if (score >= 30) return ENERGY_LEVELS.LOW;
  return ENERGY_LEVELS.VERY_LOW;
}

export default {
  ENERGY_LEVELS,
  calculateEnergyLevel,
  hasEnoughEnergy,
  findOptimalHoursForTask,
  analyzeEnergyPatterns
};


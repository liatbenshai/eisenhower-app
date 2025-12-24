/**
 * זיהוי אוטומטי של קטגוריות משימות
 * המערכת מזהה אוטומטית את סוג המשימה לפי כותרת ותיאור
 */

// קטגוריות משימות
export const TASK_CATEGORIES = {
  TRANSCRIPTION: {
    id: 'transcription',
    name: 'תמלול',
    icon: '🎙️',
    keywords: ['תמלול', 'תמלל', 'transcription', 'transcribe', 'הקלטה', 'אודיו', 'audio'],
    energyLevel: 'medium', // רמת אנרגיה נדרשת
    focusLevel: 'high', // רמת ריכוז נדרשת
    typicalDuration: 60, // זמן טיפוסי בדקות
    bestTimeOfDay: 'morning', // בוקר/צהריים/ערב
    canInterrupt: false // האם ניתן להפריע
  },
  PROOFREADING: {
    id: 'proofreading',
    name: 'הגהה',
    icon: '✍️',
    keywords: ['הגהה', 'מגיה', 'proofread', 'proofreading', 'תיקון', 'עריכה', 'edit'],
    energyLevel: 'medium',
    focusLevel: 'high',
    typicalDuration: 45,
    bestTimeOfDay: 'morning',
    canInterrupt: false
  },
  CLIENT_COMMUNICATION: {
    id: 'client_communication',
    name: 'תקשורת עם לקוחות',
    icon: '💬',
    keywords: ['לקוח', 'לקוחות', 'client', 'שיחה', 'פגישה', 'meeting', 'call', 'zoom'],
    energyLevel: 'high',
    focusLevel: 'medium',
    typicalDuration: 30,
    bestTimeOfDay: 'afternoon',
    canInterrupt: true
  },
  EMAIL: {
    id: 'email',
    name: 'מיילים',
    icon: '📧',
    keywords: ['מייל', 'אימייל', 'email', 'mail', 'תגובה', 'reply', 'שליחה'],
    energyLevel: 'low',
    focusLevel: 'low',
    typicalDuration: 15,
    bestTimeOfDay: 'any',
    canInterrupt: true
  },
  COURSE_DEVELOPMENT: {
    id: 'course_development',
    name: 'פיתוח קורס',
    icon: '📚',
    keywords: ['קורס', 'course', 'פיתוח', 'development', 'יצירה', 'תוכן', 'content', 'שיעור', 'lesson'],
    energyLevel: 'high',
    focusLevel: 'high',
    typicalDuration: 120,
    bestTimeOfDay: 'morning',
    canInterrupt: false
  },
  MARKETING: {
    id: 'marketing',
    name: 'קידום עסק',
    icon: '📢',
    keywords: ['קידום', 'שיווק', 'marketing', 'פרסום', 'פוסט', 'post', 'רשתות חברתיות', 'social media', 'פייסבוק', 'instagram'],
    energyLevel: 'medium',
    focusLevel: 'medium',
    typicalDuration: 45,
    bestTimeOfDay: 'afternoon',
    canInterrupt: true
  },
  FAMILY: {
    id: 'family',
    name: 'משפחה',
    icon: '👨‍👩‍👧‍👦',
    keywords: ['ילדים', 'ילד', 'משפחה', 'family', 'בית ספר', 'גן', 'חוג', 'פעילות', 'ארוחה', 'בישול'],
    energyLevel: 'high',
    focusLevel: 'low',
    typicalDuration: 60,
    bestTimeOfDay: 'evening',
    canInterrupt: true
  },
  ADMIN: {
    id: 'admin',
    name: 'ניהול',
    icon: '📋',
    keywords: ['ניהול', 'admin', 'דוחות', 'reports', 'כספים', 'finance', 'חשבונות', 'billing', 'מנהל'],
    energyLevel: 'medium',
    focusLevel: 'medium',
    typicalDuration: 30,
    bestTimeOfDay: 'morning',
    canInterrupt: false
  },
  OTHER: {
    id: 'other',
    name: 'אחר',
    icon: '📝',
    keywords: [],
    energyLevel: 'medium',
    focusLevel: 'medium',
    typicalDuration: 30,
    bestTimeOfDay: 'any',
    canInterrupt: true
  }
};

/**
 * זיהוי קטגוריה של משימה לפי כותרת ותיאור
 */
export function detectTaskCategory(task) {
  const text = `${task.title || ''} ${task.description || ''}`.toLowerCase();
  
  // חיפוש התאמה לכל קטגוריה
  let bestMatch = TASK_CATEGORIES.OTHER;
  let maxMatches = 0;
  
  Object.values(TASK_CATEGORIES).forEach(category => {
    if (category.id === 'other') return;
    
    const matches = category.keywords.filter(keyword => 
      text.includes(keyword.toLowerCase())
    ).length;
    
    if (matches > maxMatches) {
      maxMatches = matches;
      bestMatch = category;
    }
  });
  
  return {
    category: bestMatch,
    confidence: maxMatches > 0 ? Math.min(100, (maxMatches / bestMatch.keywords.length) * 100) : 0,
    detectedKeywords: bestMatch.keywords.filter(k => text.includes(k.toLowerCase()))
  };
}

/**
 * קבלת קטגוריה לפי ID
 */
export function getCategoryById(categoryId) {
  return Object.values(TASK_CATEGORIES).find(cat => cat.id === categoryId) || TASK_CATEGORIES.OTHER;
}

/**
 * ניתוח התפלגות קטגוריות במשימות
 */
export function analyzeCategoryDistribution(tasks) {
  const distribution = {};
  let total = 0;
  
  tasks.forEach(task => {
    const { category } = detectTaskCategory(task);
    if (!distribution[category.id]) {
      distribution[category.id] = {
        category,
        count: 0,
        totalTime: 0,
        tasks: []
      };
    }
    distribution[category.id].count++;
    distribution[category.id].totalTime += task.time_spent || 0;
    distribution[category.id].tasks.push(task);
    total++;
  });
  
  // חישוב אחוזים
  Object.keys(distribution).forEach(catId => {
    distribution[catId].percentage = total > 0 
      ? Math.round((distribution[catId].count / total) * 100) 
      : 0;
    distribution[catId].averageTime = distribution[catId].count > 0
      ? Math.round(distribution[catId].totalTime / distribution[catId].count)
      : 0;
  });
  
  return {
    distribution,
    total,
    mostCommon: Object.values(distribution)
      .sort((a, b) => b.count - a.count)[0]?.category || null
  };
}

/**
 * מציאת זמן אופטימלי לקטגוריה
 */
export function getOptimalTimeForCategory(category, workPatterns = null) {
  const categoryInfo = typeof category === 'string' 
    ? getCategoryById(category) 
    : category;
  
  if (!categoryInfo) return null;
  
  // אם יש דפוסי עבודה, נשתמש בהם
  if (workPatterns?.hourPatterns) {
    // חיפוש השעה הכי פרודוקטיבית שמתאימה לקטגוריה
    const bestHours = Object.keys(workPatterns.hourPatterns)
      .map(hour => ({
        hour: parseInt(hour),
        score: workPatterns.hourPatterns[hour].productivity
      }))
      .sort((a, b) => b.score - a.score);
    
    // התאמה לפי bestTimeOfDay
    if (categoryInfo.bestTimeOfDay === 'morning') {
      return bestHours.find(h => h.hour >= 6 && h.hour <= 12)?.hour || bestHours[0]?.hour;
    } else if (categoryInfo.bestTimeOfDay === 'afternoon') {
      return bestHours.find(h => h.hour >= 12 && h.hour <= 18)?.hour || bestHours[0]?.hour;
    } else if (categoryInfo.bestTimeOfDay === 'evening') {
      return bestHours.find(h => h.hour >= 18 && h.hour <= 22)?.hour || bestHours[0]?.hour;
    }
    
    return bestHours[0]?.hour || null;
  }
  
  // ברירת מחדל לפי bestTimeOfDay
  const defaults = {
    morning: 9,
    afternoon: 14,
    evening: 19,
    any: 10
  };
  
  return defaults[categoryInfo.bestTimeOfDay] || 10;
}

export default {
  TASK_CATEGORIES,
  detectTaskCategory,
  getCategoryById,
  analyzeCategoryDistribution,
  getOptimalTimeForCategory
};


/**
 * הגדרות סוגי משימות - קובץ מרכזי
 * כל הקומפוננטים משתמשים בקובץ הזה
 */

// =====================================
// קטגוריות משימות
// =====================================
export const TASK_CATEGORIES = {
  work: { id: 'work', name: 'עבודה', icon: '💼' },
  family: { id: 'family', name: 'משפחה', icon: '👨‍👩‍👧‍👦' },
  home: { id: 'home', name: 'בית', icon: '🏠' }
};

// =====================================
// סוגי משימות - עבודה
// =====================================
export const TASK_TYPES = {
  // === עבודה ===
  transcription: { 
    id: 'transcription', 
    name: 'תמלול', 
    icon: '🎙️',
    category: 'work',
    gradient: 'from-purple-500 to-indigo-600',
    bg: 'bg-purple-500',
    bgColor: '#f3e8ff',
    bgLight: 'bg-purple-100 dark:bg-purple-900/30',
    text: 'text-purple-800 dark:text-purple-200',
    border: 'border-purple-300 dark:border-purple-700',
    borderColor: '#a855f7',
    color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-700',
    // חישוב זמן: משך הקלטה × 3
    inputType: 'recording', // סוג קלט: הקלטה בדקות
    timeRatio: 3, // יחס: דקת הקלטה = 3 דקות עבודה
    defaultDuration: 90,
    preferredHours: { start: 8, end: 12 } // בוקר - עירנות גבוהה
  },
  
  proofreading: { 
    id: 'proofreading', 
    name: 'הגהה', 
    icon: '✅',
    category: 'work',
    gradient: 'from-blue-500 to-cyan-600',
    bg: 'bg-blue-500',
    bgColor: '#dbeafe',
    bgLight: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-800 dark:text-blue-200',
    border: 'border-blue-300 dark:border-blue-700',
    borderColor: '#3b82f6',
    color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700',
    // חישוב זמן: משך הקלטה × 0.5
    inputType: 'recording', // סוג קלט: הקלטה בדקות
    timeRatio: 0.5, // יחס: דקת הקלטה = 0.5 דקות עבודה
    defaultDuration: 30,
    preferredHours: { start: 12, end: 16 } // אחה"צ
  },
  
  translation: { 
    id: 'translation', 
    name: 'תרגום', 
    icon: '🌍',
    category: 'work',
    gradient: 'from-indigo-500 to-blue-600',
    bg: 'bg-indigo-500',
    bgColor: '#e0e7ff',
    bgLight: 'bg-indigo-100 dark:bg-indigo-900/30',
    text: 'text-indigo-800 dark:text-indigo-200',
    border: 'border-indigo-300 dark:border-indigo-700',
    borderColor: '#6366f1',
    color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200 border-indigo-300 dark:border-indigo-700',
    // חישוב זמן: עמודים × 10 דקות
    inputType: 'pages', // סוג קלט: עמודים
    timePerPage: 10, // 10 דקות לעמוד
    defaultDuration: 60,
    preferredHours: { start: 12, end: 16 } // אחה"צ
  },
  
  admin: { 
    id: 'admin', 
    name: 'אדמיניסטרציה', 
    icon: '📋',
    category: 'work',
    gradient: 'from-amber-500 to-yellow-600',
    bg: 'bg-amber-500',
    bgColor: '#fef3c7',
    bgLight: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-800 dark:text-yellow-200',
    border: 'border-yellow-300 dark:border-yellow-700',
    borderColor: '#eab308',
    color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700',
    inputType: 'direct', // זמן ישיר
    defaultDuration: 15,
    preferredHours: { start: 8, end: 8.25 } // 08:00-08:15
  },

  email: { 
    id: 'email', 
    name: 'מענה למיילים', 
    icon: '📧',
    category: 'work',
    gradient: 'from-cyan-500 to-blue-600',
    bg: 'bg-cyan-500',
    bgColor: '#cffafe',
    bgLight: 'bg-cyan-100 dark:bg-cyan-900/30',
    text: 'text-cyan-800 dark:text-cyan-200',
    border: 'border-cyan-300 dark:border-cyan-700',
    borderColor: '#06b6d4',
    color: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-200 border-cyan-300 dark:border-cyan-700',
    inputType: 'direct',
    defaultDuration: 15,
    preferredHours: { start: 8, end: 16 }
  },

  // === משפחה ===
  shaked: { 
    id: 'shaked', 
    name: 'שקד', 
    icon: '👧',
    category: 'family',
    gradient: 'from-pink-500 to-rose-600',
    bg: 'bg-pink-500',
    bgColor: '#fce7f3',
    bgLight: 'bg-pink-100 dark:bg-pink-900/30',
    text: 'text-pink-800 dark:text-pink-200',
    border: 'border-pink-300 dark:border-pink-700',
    borderColor: '#ec4899',
    color: 'bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-200 border-pink-300 dark:border-pink-700',
    inputType: 'direct',
    defaultDuration: 45,
    preferredHours: { start: 17, end: 20 }
  },
  
  dor: { 
    id: 'dor', 
    name: 'דור', 
    icon: '👦',
    category: 'family',
    gradient: 'from-blue-500 to-indigo-600',
    bg: 'bg-blue-500',
    bgColor: '#dbeafe',
    bgLight: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-800 dark:text-blue-200',
    border: 'border-blue-300 dark:border-blue-700',
    borderColor: '#3b82f6',
    color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700',
    inputType: 'direct',
    defaultDuration: 45,
    preferredHours: { start: 17, end: 20 }
  },
  
  ava: { 
    id: 'ava', 
    name: 'אווה', 
    icon: '👶',
    category: 'family',
    gradient: 'from-purple-500 to-pink-600',
    bg: 'bg-purple-500',
    bgColor: '#f3e8ff',
    bgLight: 'bg-purple-100 dark:bg-purple-900/30',
    text: 'text-purple-800 dark:text-purple-200',
    border: 'border-purple-300 dark:border-purple-700',
    borderColor: '#a855f7',
    color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-700',
    inputType: 'direct',
    defaultDuration: 45,
    preferredHours: { start: 17, end: 20 }
  },
  
  yaron: { 
    id: 'yaron', 
    name: 'זמן עם ירון', 
    icon: '👨',
    category: 'family',
    gradient: 'from-emerald-500 to-teal-600',
    bg: 'bg-emerald-500',
    bgColor: '#d1fae5',
    bgLight: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-800 dark:text-green-200',
    border: 'border-green-300 dark:border-green-700',
    borderColor: '#22c55e',
    color: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700',
    inputType: 'direct',
    defaultDuration: 60,
    preferredHours: { start: 17, end: 20 }
  },

  // === בית ===
  cleaning: { 
    id: 'cleaning', 
    name: 'ניקיון', 
    icon: '🧹',
    category: 'home',
    gradient: 'from-cyan-500 to-blue-600',
    bg: 'bg-cyan-500',
    bgColor: '#cffafe',
    bgLight: 'bg-cyan-100 dark:bg-cyan-900/30',
    text: 'text-cyan-800 dark:text-cyan-200',
    border: 'border-cyan-300 dark:border-cyan-700',
    borderColor: '#06b6d4',
    color: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-200 border-cyan-300 dark:border-cyan-700',
    inputType: 'direct',
    defaultDuration: 60,
    preferredHours: { start: 8, end: 20 } // סופ"ש - גמיש
  },
  
  cooking: { 
    id: 'cooking', 
    name: 'בישולים', 
    icon: '🍳',
    category: 'home',
    gradient: 'from-orange-500 to-red-600',
    bg: 'bg-orange-500',
    bgColor: '#ffedd5',
    bgLight: 'bg-orange-100 dark:bg-orange-900/30',
    text: 'text-orange-800 dark:text-orange-200',
    border: 'border-orange-300 dark:border-orange-700',
    borderColor: '#f97316',
    color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 border-orange-300 dark:border-orange-700',
    inputType: 'direct',
    defaultDuration: 60,
    preferredHours: { start: 8, end: 20 } // סופ"ש - גמיש
  },
  
  other: { 
    id: 'other', 
    name: 'אחר', 
    icon: '📌',
    category: 'work',
    gradient: 'from-gray-500 to-slate-600',
    bg: 'bg-gray-500',
    bgColor: '#f3f4f6',
    bgLight: 'bg-gray-100 dark:bg-gray-800',
    text: 'text-gray-800 dark:text-gray-200',
    border: 'border-gray-300 dark:border-gray-600',
    borderColor: '#6b7280',
    color: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600',
    inputType: 'direct',
    defaultDuration: 30,
    preferredHours: { start: 8, end: 17 }
  }
};

// =====================================
// פונקציות עזר
// =====================================

/**
 * קבלת סוג משימה עם ברירת מחדל
 */
export function getTaskType(typeId) {
  return TASK_TYPES[typeId] || TASK_TYPES.other;
}

/**
 * רשימת סוגי משימות לבחירה
 */
export function getTaskTypesList() {
  return Object.values(TASK_TYPES);
}

/**
 * רשימת סוגי משימות לפי קטגוריה
 */
export function getTaskTypesByCategory(category) {
  return Object.values(TASK_TYPES).filter(t => t.category === category);
}

/**
 * חישוב זמן עבודה לפי סוג משימה
 * @param {string} typeId - סוג המשימה
 * @param {number} inputValue - ערך הקלט (דקות הקלטה / עמודים / דקות ישירות)
 * @returns {number} זמן עבודה בדקות
 */
export function calculateWorkTime(typeId, inputValue) {
  const type = getTaskType(typeId);
  
  if (!inputValue || inputValue <= 0) {
    return type.defaultDuration;
  }
  
  switch (type.inputType) {
    case 'recording':
      // הקלטה: דקות × יחס
      return Math.ceil(inputValue * type.timeRatio);
    
    case 'pages':
      // עמודים: עמודים × דקות לעמוד
      return Math.ceil(inputValue * type.timePerPage);
    
    case 'direct':
    default:
      // זמן ישיר
      return inputValue;
  }
}

/**
 * קבלת תווית שדה הקלט לפי סוג
 */
export function getInputLabel(typeId) {
  const type = getTaskType(typeId);
  
  switch (type.inputType) {
    case 'recording':
      return 'משך הקלטה (דקות)';
    case 'pages':
      return 'מספר עמודים';
    case 'direct':
    default:
      return 'משך משימה (דקות)';
  }
}

/**
 * קבלת placeholder לשדה הקלט
 */
export function getInputPlaceholder(typeId) {
  const type = getTaskType(typeId);
  
  switch (type.inputType) {
    case 'recording':
      return 'לדוגמה: 30';
    case 'pages':
      return 'לדוגמה: 5';
    case 'direct':
    default:
      return 'לדוגמה: 45';
  }
}

/**
 * שעות מועדפות לפי סוג
 */
export function getPreferredHours(typeId) {
  const type = getTaskType(typeId);
  return type.preferredHours || { start: 8, end: 17 };
}

/**
 * זמן ברירת מחדל לפי סוג
 */
export function getDefaultDuration(typeId) {
  const type = getTaskType(typeId);
  return type.defaultDuration || 30;
}

/**
 * קבלת צבע גבול CSS
 */
export function getBorderColor(typeId) {
  const type = getTaskType(typeId);
  return type.borderColor || '#6b7280';
}

/**
 * בדיקה אם משימה היא משימת עבודה
 */
export function isWorkTask(typeId) {
  const type = getTaskType(typeId);
  return type.category === 'work';
}

/**
 * בדיקה אם משימה היא משימת משפחה
 */
export function isFamilyTask(typeId) {
  const type = getTaskType(typeId);
  return type.category === 'family';
}

export default TASK_TYPES;

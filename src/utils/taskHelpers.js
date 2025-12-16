/**
 * עזרים לניהול משימות
 */

// שמות הרבעים בעברית
export const QUADRANT_NAMES = {
  1: 'דחוף וחשוב',
  2: 'חשוב אך לא דחוף',
  3: 'דחוף אך לא חשוב',
  4: 'לא דחוף ולא חשוב'
};

// תיאורי הרבעים
export const QUADRANT_DESCRIPTIONS = {
  1: 'עשה עכשיו',
  2: 'תכנן',
  3: 'האצל',
  4: 'בטל'
};

// צבעי הרבעים
export const QUADRANT_COLORS = {
  1: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-300',
    accent: '#EF4444'
  },
  2: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-700 dark:text-blue-300',
    accent: '#3B82F6'
  },
  3: {
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    border: 'border-orange-200 dark:border-orange-800',
    text: 'text-orange-700 dark:text-orange-300',
    accent: '#F97316'
  },
  4: {
    bg: 'bg-gray-100 dark:bg-gray-800/50',
    border: 'border-gray-200 dark:border-gray-700',
    text: 'text-gray-600 dark:text-gray-400',
    accent: '#6B7280'
  }
};

// אייקוני הרבעים
export const QUADRANT_ICONS = {
  1: '🔴',
  2: '🔵',
  3: '🟠',
  4: '⚫'
};

/**
 * קבלת שם הרבע
 */
export function getQuadrantName(quadrant) {
  return QUADRANT_NAMES[quadrant] || '';
}

/**
 * קבלת תיאור הרבע
 */
export function getQuadrantDescription(quadrant) {
  return QUADRANT_DESCRIPTIONS[quadrant] || '';
}

/**
 * קבלת צבעי הרבע
 */
export function getQuadrantColors(quadrant) {
  return QUADRANT_COLORS[quadrant] || QUADRANT_COLORS[4];
}

/**
 * בדיקה אם משימה באיחור
 */
export function isTaskOverdue(task) {
  if (!task.due_date || task.is_completed) return false;
  
  const now = new Date();
  const dueDate = new Date(`${task.due_date}T${task.due_time || '23:59'}`);
  
  return now > dueDate;
}

/**
 * בדיקה אם משימה היום
 */
export function isTaskDueToday(task) {
  if (!task.due_date) return false;
  
  const today = new Date().toISOString().split('T')[0];
  return task.due_date === today;
}

/**
 * בדיקה אם משימה מחר
 */
export function isTaskDueTomorrow(task) {
  if (!task.due_date) return false;
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  
  return task.due_date === tomorrowStr;
}

/**
 * קבלת תווית תאריך יעד
 */
export function getDueDateLabel(task) {
  if (!task.due_date) return null;
  
  if (isTaskOverdue(task)) return 'באיחור';
  if (isTaskDueToday(task)) return 'היום';
  if (isTaskDueTomorrow(task)) return 'מחר';
  
  return null;
}

/**
 * מיון משימות לפי עדיפות
 */
export function sortTasksByPriority(tasks) {
  return [...tasks].sort((a, b) => {
    // קודם לא הושלמו
    if (a.is_completed !== b.is_completed) {
      return a.is_completed ? 1 : -1;
    }
    
    // אחר כך לפי תאריך יעד
    if (a.due_date && b.due_date) {
      return new Date(a.due_date) - new Date(b.due_date);
    }
    
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    
    // לבסוף לפי תאריך יצירה
    return new Date(b.created_at) - new Date(a.created_at);
  });
}

/**
 * קיבוץ משימות לפי רבע
 */
export function groupTasksByQuadrant(tasks) {
  return {
    1: tasks.filter(t => t.quadrant === 1),
    2: tasks.filter(t => t.quadrant === 2),
    3: tasks.filter(t => t.quadrant === 3),
    4: tasks.filter(t => t.quadrant === 4)
  };
}

/**
 * חישוב סטטיסטיקות משימות
 */
export function calculateTaskStats(tasks) {
  const total = tasks.length;
  const completed = tasks.filter(t => t.is_completed).length;
  const active = total - completed;
  const overdue = tasks.filter(t => isTaskOverdue(t)).length;
  const dueToday = tasks.filter(t => isTaskDueToday(t) && !t.is_completed).length;

  return {
    total,
    completed,
    active,
    overdue,
    dueToday,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
  };
}

export default {
  QUADRANT_NAMES,
  QUADRANT_DESCRIPTIONS,
  QUADRANT_COLORS,
  QUADRANT_ICONS,
  getQuadrantName,
  getQuadrantDescription,
  getQuadrantColors,
  isTaskOverdue,
  isTaskDueToday,
  isTaskDueTomorrow,
  getDueDateLabel,
  sortTasksByPriority,
  groupTasksByQuadrant,
  calculateTaskStats
};


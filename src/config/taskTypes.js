/**
 * הגדרות סוגי משימות - קובץ מרכזי
 * כל הקומפוננטים משתמשים בקובץ הזה
 */

export const TASK_TYPES = {
  transcription: { 
    id: 'transcription', 
    name: 'תמלול', 
    icon: '🎙️',
    gradient: 'from-purple-500 to-indigo-600',
    bg: 'bg-purple-500',
    bgColor: '#f3e8ff',
    bgLight: 'bg-purple-100 dark:bg-purple-900/30',
    text: 'text-purple-800 dark:text-purple-200',
    border: 'border-purple-300 dark:border-purple-700',
    borderColor: '#a855f7',
    color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-700',
    defaultDuration: 60,
    preferredHours: { start: 8, end: 12 }
  },
  proofreading: { 
    id: 'proofreading', 
    name: 'הגהה', 
    icon: '📝',
    gradient: 'from-blue-500 to-cyan-600',
    bg: 'bg-blue-500',
    bgColor: '#dbeafe',
    bgLight: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-800 dark:text-blue-200',
    border: 'border-blue-300 dark:border-blue-700',
    borderColor: '#3b82f6',
    color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700',
    defaultDuration: 45,
    preferredHours: { start: 10, end: 16 }
  },
  typing: { 
    id: 'typing', 
    name: 'הקלדה', 
    icon: '⌨️',
    gradient: 'from-indigo-500 to-blue-600',
    bg: 'bg-indigo-500',
    bgColor: '#e0e7ff',
    bgLight: 'bg-indigo-100 dark:bg-indigo-900/30',
    text: 'text-indigo-800 dark:text-indigo-200',
    border: 'border-indigo-300 dark:border-indigo-700',
    borderColor: '#6366f1',
    color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200 border-indigo-300 dark:border-indigo-700',
    defaultDuration: 45,
    preferredHours: { start: 8, end: 16 }
  },
  email: { 
    id: 'email', 
    name: 'מיילים', 
    icon: '📧',
    gradient: 'from-amber-500 to-yellow-600',
    bg: 'bg-amber-500',
    bgColor: '#fef3c7',
    bgLight: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-800 dark:text-yellow-200',
    border: 'border-yellow-300 dark:border-yellow-700',
    borderColor: '#eab308',
    color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700',
    defaultDuration: 25,
    preferredHours: { start: 8, end: 10 }
  },
  course: { 
    id: 'course', 
    name: 'עבודה על הקורס', 
    icon: '📚',
    gradient: 'from-emerald-500 to-teal-600',
    bg: 'bg-emerald-500',
    bgColor: '#d1fae5',
    bgLight: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-800 dark:text-green-200',
    border: 'border-green-300 dark:border-green-700',
    borderColor: '#22c55e',
    color: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700',
    defaultDuration: 90,
    preferredHours: { start: 14, end: 17 }
  },
  client_communication: { 
    id: 'client_communication', 
    name: 'תקשורת עם לקוחות', 
    icon: '💬',
    gradient: 'from-pink-500 to-rose-600',
    bg: 'bg-pink-500',
    bgColor: '#fce7f3',
    bgLight: 'bg-pink-100 dark:bg-pink-900/30',
    text: 'text-pink-800 dark:text-pink-200',
    border: 'border-pink-300 dark:border-pink-700',
    borderColor: '#ec4899',
    color: 'bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-200 border-pink-300 dark:border-pink-700',
    defaultDuration: 30,
    preferredHours: { start: 9, end: 16 }
  },
  unexpected: { 
    id: 'unexpected', 
    name: 'בלת"מים', 
    icon: '⚡',
    gradient: 'from-orange-500 to-red-600',
    bg: 'bg-orange-500',
    bgColor: '#ffedd5',
    bgLight: 'bg-orange-100 dark:bg-orange-900/30',
    text: 'text-orange-800 dark:text-orange-200',
    border: 'border-orange-300 dark:border-orange-700',
    borderColor: '#f97316',
    color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 border-orange-300 dark:border-orange-700',
    defaultDuration: 30,
    preferredHours: { start: 8, end: 17 }
  },
  selfcare: { 
    id: 'selfcare', 
    name: 'טיפוח עצמי', 
    icon: '💅',
    gradient: 'from-rose-400 to-pink-500',
    bg: 'bg-rose-400',
    bgColor: '#ffe4e6',
    bgLight: 'bg-rose-100 dark:bg-rose-900/30',
    text: 'text-rose-800 dark:text-rose-200',
    border: 'border-rose-300 dark:border-rose-700',
    borderColor: '#fb7185',
    color: 'bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-700',
    defaultDuration: 30,
    preferredHours: { start: 12, end: 14 }
  },
  family: { 
    id: 'family', 
    name: 'משפחה', 
    icon: '👨‍👩‍👧',
    gradient: 'from-red-500 to-rose-600',
    bg: 'bg-red-500',
    bgColor: '#fee2e2',
    bgLight: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-800 dark:text-red-200',
    border: 'border-red-300 dark:border-red-700',
    borderColor: '#ef4444',
    color: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-300 dark:border-red-700',
    defaultDuration: 60,
    preferredHours: { start: 16, end: 20 }
  },
  reminders: { 
    id: 'reminders', 
    name: 'תזכורות', 
    icon: '🔔',
    gradient: 'from-cyan-500 to-blue-600',
    bg: 'bg-cyan-500',
    bgColor: '#cffafe',
    bgLight: 'bg-cyan-100 dark:bg-cyan-900/30',
    text: 'text-cyan-800 dark:text-cyan-200',
    border: 'border-cyan-300 dark:border-cyan-700',
    borderColor: '#06b6d4',
    color: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-200 border-cyan-300 dark:border-cyan-700',
    defaultDuration: 15,
    preferredHours: { start: 8, end: 17 }
  },
  other: { 
    id: 'other', 
    name: 'אחר', 
    icon: '📋',
    gradient: 'from-gray-500 to-slate-600',
    bg: 'bg-gray-500',
    bgColor: '#f3f4f6',
    bgLight: 'bg-gray-100 dark:bg-gray-800',
    text: 'text-gray-800 dark:text-gray-200',
    border: 'border-gray-300 dark:border-gray-600',
    borderColor: '#6b7280',
    color: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600',
    defaultDuration: 30,
    preferredHours: { start: 8, end: 17 }
  }
};

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

export default TASK_TYPES;

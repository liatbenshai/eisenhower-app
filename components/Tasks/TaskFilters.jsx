import { useState, useRef, useEffect } from 'react';
import { useTasks } from '../../hooks/useTasks';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * רכיב סינון ומיון משימות
 */
function TaskFilters() {
  const { filter, sortBy, setFilter, setSortBy } = useTasks();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // סגירה בלחיצה מחוץ
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // אפשרויות סינון
  const filterOptions = [
    { value: 'all', label: 'הכל', icon: '📋' },
    { value: 'active', label: 'פעילות', icon: '⏳' },
    { value: 'completed', label: 'הושלמו', icon: '✅' }
  ];

  // אפשרויות מיון
  const sortOptions = [
    { value: 'created_at', label: 'תאריך יצירה', icon: '📅' },
    { value: 'due_date', label: 'תאריך יעד', icon: '⏰' },
    { value: 'title', label: 'כותרת', icon: '🔤' }
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
      >
        <span>🔍</span>
        <span className="hidden sm:inline">סינון</span>
        <svg 
          className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute left-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-20 overflow-hidden"
          >
            {/* סינון */}
            <div className="p-3 border-b border-gray-200 dark:border-gray-700">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                סינון לפי סטטוס
              </p>
              <div className="flex flex-wrap gap-1">
                {filterOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setFilter(opt.value)}
                    className={`
                      flex items-center gap-1 px-2 py-1 rounded text-sm transition-colors
                      ${filter === opt.value
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }
                    `}
                  >
                    <span>{opt.icon}</span>
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* מיון */}
            <div className="p-3">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                מיון לפי
              </p>
              <div className="space-y-1">
                {sortOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setSortBy(opt.value)}
                    className={`
                      w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-right transition-colors
                      ${sortBy === opt.value
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }
                    `}
                  >
                    <span>{opt.icon}</span>
                    <span>{opt.label}</span>
                    {sortBy === opt.value && (
                      <span className="mr-auto">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default TaskFilters;


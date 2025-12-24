/**
 * כותרת רבע במטריצה
 */
function QuadrantHeader({ title, subtitle, icon, count, onAddTask }) {
  return (
    <div className="p-3 border-b border-inherit flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <div>
          <h3 className="font-bold text-gray-900 dark:text-white text-sm">
            {title}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {subtitle}
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {/* מספר משימות */}
        <span className="bg-white/50 dark:bg-gray-900/50 px-2 py-0.5 rounded-full text-xs font-medium text-gray-700 dark:text-gray-300">
          {count}
        </span>
        
        {/* כפתור הוספה */}
        <button
          onClick={onAddTask}
          className="p-1.5 rounded-lg hover:bg-white/50 dark:hover:bg-gray-900/50 transition-colors text-gray-700 dark:text-gray-300"
          title="הוסף משימה"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default QuadrantHeader;


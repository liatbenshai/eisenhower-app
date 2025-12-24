import { useTasks } from '../../hooks/useTasks';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import TaskCard from './TaskCard';

/**
 * תצוגת משימות שהושלמו
 */
function CompletedTasksView() {
  const { getCompletedTasks, removeTask, toggleComplete } = useTasks();
  const completedTasks = getCompletedTasks();

  if (completedTasks.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <span className="text-4xl mb-4 block">✅</span>
        <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
          אין משימות שהושלמו
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          כשתסיימי משימות, הן יופיעו כאן
        </p>
      </div>
    );
  }

  const handleDelete = async (taskId) => {
    if (confirm('האם את בטוחה שברצונך למחוק משימה זו? נתוני הלמידה יישמרו.')) {
      try {
        await removeTask(taskId);
      } catch (err) {
        console.error('שגיאה במחיקת משימה:', err);
      }
    }
  };

  const handleUncomplete = async (taskId) => {
    try {
      await toggleComplete(taskId);
    } catch (err) {
      console.error('שגיאה בעדכון משימה:', err);
    }
  };

  // קיבוץ לפי תאריך השלמה
  const tasksByDate = completedTasks.reduce((acc, task) => {
    const dateKey = task.completed_at 
      ? format(new Date(task.completed_at), 'yyyy-MM-dd')
      : 'no-date';
    
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(task);
    return acc;
  }, {});

  const sortedDates = Object.keys(tasksByDate).sort((a, b) => {
    if (a === 'no-date') return 1;
    if (b === 'no-date') return -1;
    return new Date(b) - new Date(a);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            משימות שהושלמו
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {completedTasks.length} משימות הושלמו
          </p>
        </div>
      </div>

      {/* הודעה חשובה */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
              נתוני הלמידה שלך מוגנים!
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              אפשר למחוק משימות שהושלמו בבטחה - המערכת שומרת את נתוני הלמידה (זמנים, דיוק, דפוסים) 
              גם אחרי המחיקה. זה עוזר לשמור על הממשק נקי בלי לאבד מידע חשוב.
            </p>
          </div>
        </div>
      </div>

      {/* משימות לפי תאריך */}
      {sortedDates.map(dateKey => {
        const tasks = tasksByDate[dateKey];
        const dateLabel = dateKey === 'no-date' 
          ? 'ללא תאריך'
          : format(new Date(dateKey), 'EEEE, d MMMM yyyy', { locale: he });

        return (
          <div key={dateKey} className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
              <span className="text-green-600 dark:text-green-400">✓</span>
              {dateLabel}
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                ({tasks.length})
              </span>
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {tasks.map(task => (
                <div 
                  key={task.id}
                  className="bg-white dark:bg-gray-800 rounded-lg border-2 border-green-200 dark:border-green-800 p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-white line-through decoration-green-500">
                        {task.title}
                      </h4>
                      {task.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {task.description}
                        </p>
                      )}
                    </div>
                    <span className="text-green-600 dark:text-green-400 text-xl">✓</span>
                  </div>

                  {/* מידע על המשימה */}
                  <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                    {task.time_spent > 0 && (
                      <div>
                        ⏱️ זמן בפועל: {task.time_spent} דקות
                      </div>
                    )}
                    {task.estimated_duration && (
                      <div>
                        📊 זמן משוער: {task.estimated_duration} דקות
                      </div>
                    )}
                    {task.task_type && task.task_type !== 'other' && (
                      <div>
                        🏷️ סוג: {task.task_type}
                      </div>
                    )}
                  </div>

                  {/* פעולות */}
                  <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => handleUncomplete(task.id)}
                      className="flex-1 text-xs px-3 py-1.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded hover:bg-yellow-200 dark:hover:bg-yellow-900/50"
                      title="סמן כלא הושלמה"
                    >
                      ↶ בטל השלמה
                    </button>
                    <button
                      onClick={() => handleDelete(task.id)}
                      className="flex-1 text-xs px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-900/50"
                      title="מחק (נתוני למידה יישמרו)"
                    >
                      🗑️ מחק
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default CompletedTasksView;


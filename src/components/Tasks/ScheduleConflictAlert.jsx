import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { findOverlappingTasks, findNextFreeSlot } from '../../utils/timeOverlap';
import { findTasksToDefer } from '../../utils/urgentRescheduler';
import { getAvailableMinutesForDay } from '../../utils/smartTaskSplitter';
import Button from '../UI/Button';

/**
 * התראת חפיפות בלוח הזמנים
 * מוצגת כאשר מוסיפים משימה שחופפת למשימות קיימות או כשהיום עמוס
 */
function ScheduleConflictAlert({ 
  newTask, 
  existingTasks, 
  onDefer,
  onChangeTime,
  onIgnore,
  onCancel
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [loading, setLoading] = useState(false);

  // בדיקת חפיפות
  const overlappingTasks = useMemo(() => {
    if (!newTask.dueDate || !newTask.dueTime) return [];
    return findOverlappingTasks(newTask, existingTasks);
  }, [newTask, existingTasks]);

  // בדיקת עומס יומי
  const dayOverload = useMemo(() => {
    if (!newTask.dueDate) return null;
    const availableMinutes = getAvailableMinutesForDay(newTask.dueDate, existingTasks);
    const taskDuration = newTask.estimatedDuration || 30;
    const isOverloaded = availableMinutes < taskDuration;
    
    return {
      availableMinutes,
      taskDuration,
      isOverloaded,
      overloadAmount: isOverloaded ? taskDuration - availableMinutes : 0
    };
  }, [newTask, existingTasks]);

  // משימות שאפשר לדחות
  const deferSuggestion = useMemo(() => {
    if (!dayOverload?.isOverloaded && overlappingTasks.length === 0) return null;
    
    const requiredMinutes = dayOverload?.overloadAmount || 
      overlappingTasks.reduce((sum, t) => sum + (t.estimated_duration || 30), 0);
    
    return findTasksToDefer(existingTasks, newTask.dueDate, requiredMinutes);
  }, [existingTasks, newTask.dueDate, dayOverload, overlappingTasks]);

  // שעה פנויה הבאה
  const nextFreeSlot = useMemo(() => {
    if (!newTask.dueDate) return null;
    return findNextFreeSlot(
      newTask.dueDate, 
      newTask.estimatedDuration || 30, 
      existingTasks
    );
  }, [newTask, existingTasks]);

  // אם אין בעיות, לא מציגים כלום
  if (overlappingTasks.length === 0 && !dayOverload?.isOverloaded) {
    return null;
  }

  // טיפול בדחיית משימות
  const handleDefer = async () => {
    setLoading(true);
    try {
      if (onDefer && deferSuggestion?.tasksToDefer) {
        await onDefer(deferSuggestion.tasksToDefer);
      }
    } finally {
      setLoading(false);
    }
  };

  // צבע לפי רבע
  const getQuadrantColor = (q) => ({
    1: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    2: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    3: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    4: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  }[q] || 'bg-gray-100');

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-2 border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4 mb-4"
    >
      {/* כותרת */}
      <div className="flex items-start gap-3 mb-3">
        <span className="text-2xl">⚠️</span>
        <div className="flex-1">
          <h4 className="font-bold text-orange-800 dark:text-orange-200">
            {overlappingTasks.length > 0 ? 'יש חפיפה בזמנים!' : 'היום עמוס מדי!'}
          </h4>
          <p className="text-sm text-orange-700 dark:text-orange-300">
            {overlappingTasks.length > 0 
              ? `המשימה חופפת ל-${overlappingTasks.length} משימות קיימות`
              : `חסרות ${dayOverload?.overloadAmount} דקות ביום הזה`
            }
          </p>
        </div>
      </div>

      {/* משימות חופפות */}
      {overlappingTasks.length > 0 && (
        <div className="mb-4">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            משימות חופפות:
          </div>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {overlappingTasks.map(task => (
              <div 
                key={task.id}
                className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded-lg border border-orange-200 dark:border-orange-800"
              >
                <span className={`px-2 py-0.5 rounded text-xs ${getQuadrantColor(task.quadrant)}`}>
                  Q{task.quadrant}
                </span>
                <span className="font-medium flex-1 text-sm truncate">{task.title}</span>
                <span className="text-xs text-gray-500">
                  {task.due_time} • {task.estimated_duration || 30} דק׳
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* הצעה לדחיית משימות */}
      {deferSuggestion && deferSuggestion.tasksToDefer.length > 0 && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
              💡 אפשר לדחות {deferSuggestion.tasksToDefer.length} משימות למחר
            </span>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-blue-600 hover:underline"
            >
              {showDetails ? 'הסתר' : 'פרטים'}
            </button>
          </div>
          
          <AnimatePresence>
            {showDetails && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-1 mt-2 pt-2 border-t border-blue-200 dark:border-blue-700">
                  {deferSuggestion.tasksToDefer.map(task => (
                    <div 
                      key={task.id}
                      className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded text-sm"
                    >
                      <span className={`px-1.5 py-0.5 rounded text-xs ${getQuadrantColor(task.quadrant)}`}>
                        Q{task.quadrant}
                      </span>
                      <span className="flex-1 truncate">{task.title}</span>
                      <span className="text-xs text-gray-500">{task.estimated_duration || 30} דק׳</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-xs text-blue-700 dark:text-blue-300">
                  יפנה {deferSuggestion.freedMinutes} דקות
                  {deferSuggestion.byQuadrant?.q4 > 0 && ` • Q4: ${deferSuggestion.byQuadrant.q4}`}
                  {deferSuggestion.byQuadrant?.q3 > 0 && ` • Q3: ${deferSuggestion.byQuadrant.q3}`}
                  {deferSuggestion.byQuadrant?.q2 > 0 && ` • Q2: ${deferSuggestion.byQuadrant.q2}`}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* שעה פנויה חלופית */}
      {nextFreeSlot && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <span className="text-sm text-green-800 dark:text-green-200">
            🕐 שעה פנויה: <strong>{nextFreeSlot}</strong>
          </span>
        </div>
      )}

      {/* כפתורים */}
      <div className="flex flex-wrap gap-2">
        {deferSuggestion?.tasksToDefer.length > 0 && (
          <Button
            onClick={handleDefer}
            loading={loading}
            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-sm"
          >
            📤 דחה ופנה מקום
          </Button>
        )}
        
        {nextFreeSlot && onChangeTime && (
          <Button
            onClick={() => onChangeTime(nextFreeSlot.replace('מחר ', ''), nextFreeSlot.includes('מחר'))}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white text-sm"
          >
            🕐 עבור ל-{nextFreeSlot}
          </Button>
        )}
        
        <Button
          onClick={onIgnore}
          variant="secondary"
          className="text-sm"
        >
          המשך בכל זאת
        </Button>
        
        <Button
          onClick={onCancel}
          variant="secondary"
          className="text-sm"
        >
          ביטול
        </Button>
      </div>
    </motion.div>
  );
}

export default ScheduleConflictAlert;

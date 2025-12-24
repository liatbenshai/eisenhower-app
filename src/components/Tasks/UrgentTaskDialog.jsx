import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { rescheduleForUrgentTask } from '../../utils/urgentRescheduler';
import { TASK_TYPES } from '../../config/taskTypes';
import Button from '../UI/Button';

/**
 * דיאלוג למשימה דחופה
 * מציג את ההשפעה על לוח הזמנים ומציע שיבוץ מחדש
 */
function UrgentTaskDialog({ urgentTask, existingTasks, onConfirm, onCancel }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [approvedChanges, setApprovedChanges] = useState([]);

  // חישוב השינויים הנדרשים
  const rescheduleResult = useMemo(() => {
    if (!urgentTask) return null;
    return rescheduleForUrgentTask(urgentTask, existingTasks || [], {
      targetDate: new Date().toISOString().split('T')[0],
      allowPartialReschedule: true
    });
  }, [urgentTask, existingTasks]);

  // פורמט זמן
  const formatTime = (minutes) => {
    if (!minutes) return '0 דק\'';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} דק'`;
    if (mins === 0) return `${hours} שעות`;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  };

  // פורמט תאריך
  const formatDate = (dateISO) => {
    const date = new Date(dateISO);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (dateISO === today.toISOString().split('T')[0]) return 'היום';
    if (dateISO === tomorrow.toISOString().split('T')[0]) return 'מחר';

    return date.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  // אישור/ביטול שינוי ספציפי
  const toggleChange = (changeId) => {
    setApprovedChanges(prev => 
      prev.includes(changeId) 
        ? prev.filter(id => id !== changeId)
        : [...prev, changeId]
    );
  };

  // אישור כל השינויים
  const approveAll = () => {
    if (rescheduleResult?.changes) {
      setApprovedChanges(rescheduleResult.changes.map(c => c.taskId));
    }
  };

  // אישור והמשך
  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      // סינון רק השינויים שאושרו
      const approvedChangesList = rescheduleResult?.changes?.filter(c => 
        approvedChanges.includes(c.taskId)
      ) || [];
      
      await onConfirm({
        urgentTask: rescheduleResult?.urgentTask || urgentTask,
        changes: approvedChangesList
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!urgentTask || !rescheduleResult) return null;

  const taskType = TASK_TYPES[urgentTask.task_type] || { icon: '🚨', name: 'משימה דחופה' };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* כותרת */}
        <div className="p-6 bg-gradient-to-l from-red-500 to-orange-600 text-white">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🚨</span>
            <div>
              <h3 className="text-xl font-bold">משימה דחופה</h3>
              <p className="text-red-100 text-sm">
                {rescheduleResult.needsReschedule 
                  ? 'צריך לפנות מקום בלוח הזמנים'
                  : 'יש מקום בלוח הזמנים'}
              </p>
            </div>
          </div>
        </div>

        {/* תוכן */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* המשימה הדחופה */}
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{taskType.icon}</span>
              <span className="font-bold text-red-700 dark:text-red-300">{urgentTask.title}</span>
            </div>
            <div className="flex gap-4 text-sm text-red-600 dark:text-red-400">
              <span>⏱️ {formatTime(urgentTask.estimated_duration || 60)}</span>
              <span>📅 {formatDate(rescheduleResult.urgentTask?.due_date || new Date().toISOString().split('T')[0])}</span>
            </div>
          </div>

          {/* אם אין צורך בשינויים */}
          {!rescheduleResult.needsReschedule && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-2xl">✅</span>
                <div>
                  <div className="font-medium text-green-700 dark:text-green-300">
                    יש מקום!
                  </div>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    {rescheduleResult.message}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* רשימת השינויים הנדרשים */}
          {rescheduleResult.needsReschedule && rescheduleResult.changes?.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900 dark:text-white">
                  משימות שיוזזו:
                </h4>
                <button
                  onClick={approveAll}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  אשר הכל
                </button>
              </div>

              <div className="space-y-2">
                {rescheduleResult.changes.map((change, index) => {
                  const isApproved = approvedChanges.includes(change.taskId);
                  return (
                    <motion.div
                      key={change.taskId}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                        isApproved 
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
                          : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                      }`}
                      onClick={() => toggleChange(change.taskId)}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isApproved}
                          onChange={() => {}}
                          className="w-5 h-5 rounded text-blue-500"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {change.taskTitle}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <span>{formatDate(change.originalDate)}</span>
                            <span>→</span>
                            <span className="font-medium text-blue-600 dark:text-blue-400">
                              {formatDate(change.newDate)}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs text-gray-500">
                          {formatTime(change.duration)}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* סיכום */}
              <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-sm">
                <div className="flex items-center justify-between text-orange-700 dark:text-orange-300">
                  <span>זמן שיתפנה:</span>
                  <span className="font-bold">{formatTime(rescheduleResult.freedMinutes)}</span>
                </div>
                {rescheduleResult.warnings?.length > 0 && (
                  <div className="mt-2 text-orange-600 dark:text-orange-400">
                    ⚠️ {rescheduleResult.warnings.join(', ')}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* אם השיבוץ נכשל */}
          {!rescheduleResult.success && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
              <div className="flex items-start gap-2">
                <span className="text-xl">⚠️</span>
                <div>
                  <div className="font-medium text-red-700 dark:text-red-300">
                    לא ניתן לפנות מספיק מקום
                  </div>
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                    {rescheduleResult.message}
                  </p>
                  {rescheduleResult.suggestion && (
                    <p className="text-sm text-red-500 mt-2">
                      💡 {rescheduleResult.suggestion}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* כפתורים */}
        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 flex gap-2">
          <Button onClick={onCancel} variant="secondary" className="flex-1">
            ביטול
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={isProcessing}
            className="flex-1 bg-red-500 hover:bg-red-600 text-white"
          >
            {isProcessing ? '⏳ מעדכן...' : (
              rescheduleResult.needsReschedule 
                ? `✓ אשר והזז ${approvedChanges.length} משימות`
                : '✓ הוסף משימה'
            )}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default UrgentTaskDialog;

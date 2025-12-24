import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { autoSplitNewTask, getSplitRecommendation } from '../../utils/smartTaskSplitter';
import { TASK_TYPES } from '../../config/taskTypes';
import Button from '../UI/Button';

/**
 * דיאלוג לפיצול משימות ארוכות
 */
function TaskSplitDialog({ task, existingTasks, onConfirm, onCancel, onSkip }) {
  const [splitParts, setSplitParts] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // חישוב הפיצול המומלץ
  const splitResult = useMemo(() => {
    if (!task || !task.estimated_duration) return null;
    return autoSplitNewTask(task, existingTasks || []);
  }, [task, existingTasks]);

  // עדכון ה-state כשהתוצאה מתעדכנת
  useState(() => {
    if (splitResult?.tasks) {
      setSplitParts(splitResult.tasks);
    }
  }, [splitResult]);

  // פורמט זמן
  const formatTime = (minutes) => {
    if (!minutes) return '0 דק\'';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} דק'`;
    if (mins === 0) return `${hours} שעות`;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  };

  // עדכון חלק בודד
  const updatePart = (index, field, value) => {
    const updated = [...splitParts];
    updated[index] = { ...updated[index], [field]: value };
    setSplitParts(updated);
  };

  // אישור הפיצול
  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      await onConfirm(splitParts);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!task || !splitResult) return null;

  // אם לא צריך פיצול
  if (!splitResult.shouldSplit) {
    return null;
  }

  // אם לא ניתן לפצל
  if (!splitResult.canSplit) {
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
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          <div className="p-6">
            <div className="text-center mb-4">
              <span className="text-4xl">⚠️</span>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-2">
                לא ניתן לפצל את המשימה
              </h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-center mb-4">
              {splitResult.reason}
            </p>
            {splitResult.suggestion && (
              <p className="text-sm text-blue-600 dark:text-blue-400 text-center">
                💡 {splitResult.suggestion}
              </p>
            )}
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 flex gap-2">
            <Button onClick={onSkip} className="flex-1" variant="secondary">
              צור בכל זאת
            </Button>
            <Button onClick={onCancel} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white">
              חזור לעריכה
            </Button>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  const taskType = TASK_TYPES[task.task_type] || { icon: '📋', name: 'אחר' };
  const totalSplitDuration = splitParts.reduce((sum, p) => sum + (p.estimated_duration || 0), 0);

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
        <div className="p-6 bg-gradient-to-l from-blue-500 to-indigo-600 text-white">
          <div className="flex items-center gap-3">
            <span className="text-3xl">✂️</span>
            <div>
              <h3 className="text-xl font-bold">פיצול משימה</h3>
              <p className="text-blue-100 text-sm">
                משימה של {formatTime(task.estimated_duration)} - מומלץ לפצל
              </p>
            </div>
          </div>
        </div>

        {/* תוכן */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* המשימה המקורית */}
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span>{taskType.icon}</span>
              <span className="font-medium text-gray-900 dark:text-white">{task.title}</span>
            </div>
            <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-400">
              <span>⏱️ {formatTime(task.estimated_duration)}</span>
              {task.due_date && <span>📅 {new Date(task.due_date).toLocaleDateString('he-IL')}</span>}
            </div>
          </div>

          {/* סיכום הפיצול */}
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-blue-700 dark:text-blue-300">
                יפוצל ל-<strong>{splitParts.length}</strong> חלקים
              </span>
              <span className="text-sm text-blue-700 dark:text-blue-300">
                סה"כ: {formatTime(totalSplitDuration)}
              </span>
            </div>
          </div>

          {/* רשימת החלקים */}
          <div className="space-y-3">
            {splitParts.map((part, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </span>
                    <input
                      type="text"
                      value={part.title}
                      onChange={(e) => updatePart(index, 'title', e.target.value)}
                      className="font-medium text-gray-900 dark:text-white bg-transparent border-none focus:ring-0 p-0"
                    />
                  </div>
                </div>
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">⏱️</span>
                    <input
                      type="number"
                      value={part.estimated_duration}
                      onChange={(e) => updatePart(index, 'estimated_duration', parseInt(e.target.value) || 30)}
                      className="w-16 px-2 py-1 rounded border dark:bg-gray-700 dark:border-gray-600"
                    />
                    <span className="text-gray-500">דק'</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">📅</span>
                    <input
                      type="date"
                      value={part.due_date}
                      onChange={(e) => updatePart(index, 'due_date', e.target.value)}
                      className="px-2 py-1 rounded border dark:bg-gray-700 dark:border-gray-600"
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* פרטים נוספים */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="mt-4 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            {showDetails ? '▲ הסתר פרטים' : '▼ הצג פרטים נוספים'}
          </button>

          <AnimatePresence>
            {showDetails && splitResult.summary && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm"
              >
                <div className="text-gray-600 dark:text-gray-400">
                  <p>משך מקורי: {formatTime(splitResult.summary.originalDuration)}</p>
                  <p>מספר חלקים: {splitResult.summary.totalParts}</p>
                  <p>תאריכים: {splitResult.summary.dates?.join(', ')}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* כפתורים */}
        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 flex gap-2">
          <Button onClick={onCancel} variant="secondary" className="flex-1">
            ביטול
          </Button>
          <Button onClick={onSkip} variant="secondary" className="flex-1">
            צור ללא פיצול
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={isProcessing}
            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
          >
            {isProcessing ? '⏳ יוצר...' : `✓ צור ${splitParts.length} משימות`}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default TaskSplitDialog;

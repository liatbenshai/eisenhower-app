import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../hooks/useAuth';
import { TASK_TYPES } from '../DailyView/DailyView';
import { getAllTaskTypeLearning } from '../../services/supabase';
import {
  analyzeCapacity,
  scheduleByPriority,
  findMovableTasks,
  proposeTaskMoves,
  formatMinutes,
  getDateISO,
  minutesToTime,
  timeToMinutes,
  PRIORITY_ORDER
} from '../../utils/smartScheduling';
import toast from 'react-hot-toast';

/**
 * שיבוץ אוטומטי חכם - משופר עם עדיפויות
 */
function SmartScheduler({ selectedDate, onClose, onScheduled }) {
  const { tasks, editTask, loadTasks } = useTasks();
  const { user } = useAuth();
  const [scheduling, setScheduling] = useState(false);
  const [scheduledTasks, setScheduledTasks] = useState([]);
  const [tasksToMove, setTasksToMove] = useState([]);
  const [selectedMoves, setSelectedMoves] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [learningData, setLearningData] = useState({});
  const [sortBy, setSortBy] = useState('priority'); // 'priority' | 'duration' | 'deadline'

  // טעינת נתוני למידה
  useEffect(() => {
    if (user?.id) {
      getAllTaskTypeLearning(user.id)
        .then(data => {
          const byType = {};
          data.forEach(d => { byType[d.task_type] = d; });
          setLearningData(byType);
        })
        .catch(console.error);
    }
  }, [user?.id]);

  // משימות לא משובצות (ללא תאריך או שעה)
  const unscheduledTasks = useMemo(() => {
    return tasks.filter(task => {
      if (task.is_completed) return false;
      if (!task.due_date) return true;
      if (!task.due_time) return true;
      return false;
    });
  }, [tasks]);

  // ניתוח קיבולת לשבוע הקרוב
  const capacityDays = useMemo(() => {
    return analyzeCapacity(tasks, selectedDate, null, 14);
  }, [tasks, selectedDate]);

  // משימות משובצות ליום הנבחר
  const scheduledForDay = useMemo(() => {
    const dateISO = getDateISO(selectedDate);
    return tasks.filter(task => {
      if (task.is_completed) return false;
      return task.due_date === dateISO && task.due_time;
    });
  }, [tasks, selectedDate]);

  // קיבולת היום הנבחר
  const todayCapacity = useMemo(() => {
    return capacityDays.find(d => d.dateISO === getDateISO(selectedDate)) || {
      freeMinutes: 0,
      freeSlots: [],
      occupiedMinutes: 0,
      totalMinutes: 480
    };
  }, [capacityDays, selectedDate]);

  // סה"כ זמן משימות לא משובצות
  const totalUnscheduledTime = useMemo(() => {
    return unscheduledTasks.reduce((sum, task) => sum + (task.estimated_duration || 30), 0);
  }, [unscheduledTasks]);

  // חישוב שיבוץ
  const calculateSchedule = () => {
    // שיבוץ לפי עדיפות
    const { scheduled, unscheduled } = scheduleByPriority(
      unscheduledTasks,
      capacityDays,
      learningData
    );

    // סנן רק את אלו שמשובצים ליום הנבחר (או לכל הימים)
    const dateISO = getDateISO(selectedDate);
    
    return {
      scheduled: scheduled.filter(s => s.dateISO === dateISO),
      allScheduled: scheduled,
      unscheduled
    };
  };

  // חישוב שיבוץ לכל השבוע
  const calculateWeekSchedule = () => {
    const { scheduled, unscheduled } = scheduleByPriority(
      unscheduledTasks,
      capacityDays,
      learningData
    );

    return { scheduled, unscheduled };
  };

  // תצוגה מקדימה - יום בלבד
  const handlePreviewToday = () => {
    const result = calculateSchedule();
    setScheduledTasks(result.scheduled);
    setShowPreview(true);
  };

  // תצוגה מקדימה - כל השבוע
  const handlePreviewWeek = () => {
    const result = calculateWeekSchedule();
    setScheduledTasks(result.scheduled);
    setShowPreview(true);
  };

  // ביצוע השיבוץ
  const handleSchedule = async () => {
    if (scheduledTasks.length === 0) return;
    
    setScheduling(true);
    try {
      // שיבוץ המשימות
      for (const item of scheduledTasks) {
        await editTask(item.task.id, {
          dueDate: item.dateISO,
          dueTime: item.startTime,
          estimatedDuration: item.duration
        });
      }

      // הזזת משימות אם נבחרו
      for (const move of selectedMoves) {
        await editTask(move.task.id, {
          dueDate: move.newDate,
          dueTime: move.newTime
        });
      }
      
      await loadTasks();
      
      const message = selectedMoves.length > 0
        ? `${scheduledTasks.length} משימות שובצו, ${selectedMoves.length} הוזזו`
        : `${scheduledTasks.length} משימות שובצו בהצלחה!`;
      
      toast.success(message);
      
      if (onScheduled) onScheduled();
      if (onClose) onClose();
    } catch (err) {
      console.error('שגיאה בשיבוץ:', err);
      toast.error('שגיאה בשיבוץ המשימות');
    } finally {
      setScheduling(false);
    }
  };

  // מיון משימות לפי בחירה
  const sortedUnscheduledTasks = useMemo(() => {
    const sorted = [...unscheduledTasks];
    
    switch (sortBy) {
      case 'priority':
        return sorted.sort((a, b) => {
          const pa = PRIORITY_ORDER[a.priority] || 3;
          const pb = PRIORITY_ORDER[b.priority] || 3;
          return pa - pb;
        });
      case 'duration':
        return sorted.sort((a, b) => 
          (a.estimated_duration || 30) - (b.estimated_duration || 30)
        );
      case 'deadline':
        return sorted.sort((a, b) => {
          if (a.deadline && b.deadline) return new Date(a.deadline) - new Date(b.deadline);
          if (a.deadline) return -1;
          if (b.deadline) return 1;
          return 0;
        });
      default:
        return sorted;
    }
  }, [unscheduledTasks, sortBy]);

  // קבלת צבע עדיפות
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
      case 'high': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
      case 'normal': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
      case 'low': return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
      default: return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  const getPriorityLabel = (priority) => {
    switch (priority) {
      case 'urgent': return '🔴 דחוף';
      case 'high': return '🟠 גבוה';
      case 'normal': return '🔵 רגיל';
      case 'low': return '⚪ נמוך';
      default: return '🔵 רגיל';
    }
  };

  return (
    <div className="space-y-4">
      {/* סיכום מצב */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {unscheduledTasks.length}
          </div>
          <div className="text-sm text-blue-700 dark:text-blue-300">
            משימות לשיבוץ
          </div>
          <div className="text-xs text-blue-500 dark:text-blue-400 mt-1">
            ({formatMinutes(totalUnscheduledTime)})
          </div>
        </div>
        
        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {formatMinutes(todayCapacity.freeMinutes)}
          </div>
          <div className="text-sm text-green-700 dark:text-green-300">
            פנוי היום
          </div>
          <div className="text-xs text-green-500 dark:text-green-400 mt-1">
            ({todayCapacity.freeSlots.length} חלונות)
          </div>
        </div>
      </div>

      {/* בחירת סדר מיון */}
      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
          📊 סדר שיבוץ:
        </label>
        <div className="flex gap-2">
          {[
            { id: 'priority', label: '⭐ עדיפות', desc: 'דחופים קודם' },
            { id: 'duration', label: '⏱️ משך', desc: 'קצרים קודם' },
            { id: 'deadline', label: '📅 דדליין', desc: 'קרובים קודם' }
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => setSortBy(opt.id)}
              className={`
                flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all
                ${sortBy === opt.id 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                }
              `}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* רשימת משימות לא משובצות */}
      {unscheduledTasks.length > 0 && !showPreview && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="p-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              📋 משימות ממתינות ({unscheduledTasks.length}):
            </h4>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {sortedUnscheduledTasks.map(task => {
              const taskType = TASK_TYPES[task.task_type] || TASK_TYPES.other;
              const learning = learningData[task.task_type];
              const hasLearning = learning && learning.total_tasks >= 2;
              
              return (
                <div 
                  key={task.id}
                  className="p-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className={`px-2 py-0.5 rounded text-xs ${taskType.color}`}>
                      {taskType.icon}
                    </span>
                    <span className="truncate text-gray-900 dark:text-white">
                      {task.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`px-2 py-0.5 rounded text-xs ${getPriorityColor(task.priority)}`}>
                      {getPriorityLabel(task.priority)}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {formatMinutes(task.estimated_duration || 30)}
                      {hasLearning && (
                        <span className="text-yellow-500 mr-1" title={`יחס למידה: ${Math.round(learning.average_ratio * 100)}%`}>
                          📈
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* קיבולת שבועית */}
      {!showPreview && capacityDays.length > 0 && (
        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            📅 קיבולת שבועית:
          </h4>
          <div className="flex gap-1 overflow-x-auto pb-2">
            {capacityDays.slice(0, 7).map(day => {
              const pct = Math.round((day.occupiedMinutes / day.totalMinutes) * 100);
              const isFull = pct >= 80;
              const isSelected = day.dateISO === getDateISO(selectedDate);
              return (
                <div 
                  key={day.dateISO}
                  className={`
                    flex-shrink-0 w-16 p-2 rounded text-center text-xs cursor-pointer
                    ${isSelected ? 'ring-2 ring-blue-500' : ''}
                    ${isFull ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'}
                  `}
                >
                  <div className="font-medium">{day.dayName}</div>
                  <div className={`text-lg ${isFull ? 'text-red-600' : 'text-green-600'}`}>
                    {Math.round(day.freeMinutes / 60)}h
                  </div>
                  <div className="text-gray-500">פנוי</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* אזהרות */}
      {totalUnscheduledTime > todayCapacity.freeMinutes && !showPreview && (
        <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-orange-700 dark:text-orange-300 text-sm">
          ⚠️ יש יותר משימות ({formatMinutes(totalUnscheduledTime)}) מזמן פנוי היום ({formatMinutes(todayCapacity.freeMinutes)}). 
          חלק ישובצו לימים הבאים.
        </div>
      )}

      {unscheduledTasks.length === 0 && (
        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400 text-sm text-center">
          ✅ כל המשימות כבר משובצות!
        </div>
      )}

      {/* תצוגה מקדימה */}
      <AnimatePresence>
        {showPreview && scheduledTasks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
          >
            <div className="p-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <h4 className="font-medium text-gray-900 dark:text-white">
                📋 תצוגה מקדימה - {scheduledTasks.length} משימות
              </h4>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {scheduledTasks.map((item, index) => {
                const taskType = TASK_TYPES[item.task.task_type] || TASK_TYPES.other;
                return (
                  <div
                    key={index}
                    className="p-3 border-b border-gray-100 dark:border-gray-800"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-sm ${taskType.color}`}>
                          {taskType.icon}
                        </span>
                        <span className="text-gray-900 dark:text-white">
                          {item.task.title}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-xs ${getPriorityColor(item.task.priority)}`}>
                          {getPriorityLabel(item.task.priority)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
                      <span>📅 {item.dayName}</span>
                      <span>•</span>
                      <span className="font-medium">{item.startTime} - {item.endTime}</span>
                      <span>•</span>
                      <span>{formatMinutes(item.duration)}</span>
                      {item.wasAdjusted && (
                        <span className="text-yellow-600 dark:text-yellow-400" title="זמן מותאם לפי היסטוריה">
                          📈 (מותאם)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* כפתורים */}
      <div className="space-y-2">
        {!showPreview ? (
          <div className="flex gap-2">
            <button
              onClick={handlePreviewToday}
              disabled={unscheduledTasks.length === 0 || todayCapacity.freeSlots.length === 0}
              className="flex-1 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              🔍 שבץ להיום
            </button>
            <button
              onClick={handlePreviewWeek}
              disabled={unscheduledTasks.length === 0}
              className="flex-1 py-3 bg-purple-500 text-white rounded-lg font-medium hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              📅 שבץ לשבוע
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowPreview(false);
                setScheduledTasks([]);
              }}
              className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              ← חזרה
            </button>
            <button
              onClick={handleSchedule}
              disabled={scheduling || scheduledTasks.length === 0}
              className="flex-1 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {scheduling ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">⏳</span>
                  משבץ...
                </span>
              ) : (
                `✅ שבץ ${scheduledTasks.length} משימות`
              )}
            </button>
          </div>
        )}
      </div>

      {/* הסבר */}
      <div className="text-xs text-gray-500 dark:text-gray-400 text-center space-y-1">
        <p>💡 המערכת משבצת לפי {sortBy === 'priority' ? 'עדיפות' : sortBy === 'duration' ? 'משך' : 'דדליין'}</p>
        {Object.keys(learningData).length > 0 && (
          <p>📈 זמנים מותאמים לפי ההיסטוריה שלך</p>
        )}
      </div>
    </div>
  );
}

export default SmartScheduler;

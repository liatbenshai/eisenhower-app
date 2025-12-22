import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { TASK_TYPES } from '../DailyView/DailyView';
import toast from 'react-hot-toast';

/**
 * שעות העבודה
 */
const WORK_HOURS = {
  start: 8,
  end: 16
};

/**
 * קבלת תאריך בפורמט ISO
 */
function getDateISO(date) {
  return date.toISOString().split('T')[0];
}

/**
 * שיבוץ אוטומטי חכם
 */
function SmartScheduler({ selectedDate, onClose, onScheduled }) {
  const { tasks, editTask, loadTasks } = useTasks();
  const [scheduling, setScheduling] = useState(false);
  const [scheduledTasks, setScheduledTasks] = useState([]);
  const [showPreview, setShowPreview] = useState(false);

  // משימות לא משובצות (ללא תאריך או שעה)
  const unscheduledTasks = useMemo(() => {
    return tasks.filter(task => {
      if (task.is_completed) return false;
      // משימה לא משובצת = אין לה תאריך, או אין לה שעה
      if (!task.due_date) return true;
      if (!task.due_time) return true;
      return false;
    });
  }, [tasks]);

  // משימות משובצות ליום הנבחר
  const scheduledForDay = useMemo(() => {
    const dateISO = getDateISO(selectedDate);
    return tasks.filter(task => {
      if (task.is_completed) return false;
      return task.due_date === dateISO && task.due_time;
    });
  }, [tasks, selectedDate]);

  // חישוב זמנים פנויים ביום
  const freeSlots = useMemo(() => {
    const dateISO = getDateISO(selectedDate);
    const slots = [];
    
    // יצירת מפת שעות (כל 30 דקות)
    const timeMap = {};
    for (let hour = WORK_HOURS.start; hour < WORK_HOURS.end; hour++) {
      timeMap[`${hour.toString().padStart(2, '0')}:00`] = null;
      timeMap[`${hour.toString().padStart(2, '0')}:30`] = null;
    }

    // סימון זמנים תפוסים
    scheduledForDay.forEach(task => {
      if (!task.due_time) return;
      const startHour = parseInt(task.due_time.split(':')[0]);
      const startMin = parseInt(task.due_time.split(':')[1]) || 0;
      const duration = task.estimated_duration || 30;
      
      // סימון כל 30 דקות של המשימה
      let currentMin = startHour * 60 + startMin;
      const endMin = currentMin + duration;
      
      while (currentMin < endMin && currentMin < WORK_HOURS.end * 60) {
        const hour = Math.floor(currentMin / 60);
        const min = currentMin % 60;
        const timeKey = `${hour.toString().padStart(2, '0')}:${min === 0 ? '00' : '30'}`;
        if (timeMap.hasOwnProperty(timeKey)) {
          timeMap[timeKey] = task;
        }
        currentMin += 30;
      }
    });

    // מציאת רצפים פנויים
    let currentSlotStart = null;
    let currentSlotDuration = 0;

    Object.keys(timeMap).sort().forEach((time, index, arr) => {
      if (timeMap[time] === null) {
        // זמן פנוי
        if (currentSlotStart === null) {
          currentSlotStart = time;
          currentSlotDuration = 30;
        } else {
          currentSlotDuration += 30;
        }
      } else {
        // זמן תפוס - סגור את הרצף הקודם
        if (currentSlotStart !== null && currentSlotDuration >= 30) {
          slots.push({
            start: currentSlotStart,
            duration: currentSlotDuration,
            end: time
          });
        }
        currentSlotStart = null;
        currentSlotDuration = 0;
      }
    });

    // סגירת רצף אחרון
    if (currentSlotStart !== null && currentSlotDuration >= 30) {
      slots.push({
        start: currentSlotStart,
        duration: currentSlotDuration,
        end: `${WORK_HOURS.end}:00`
      });
    }

    return slots;
  }, [scheduledForDay, selectedDate]);

  // חישוב סה"כ זמן פנוי
  const totalFreeTime = useMemo(() => {
    return freeSlots.reduce((sum, slot) => sum + slot.duration, 0);
  }, [freeSlots]);

  // חישוב סה"כ זמן משימות לא משובצות
  const totalUnscheduledTime = useMemo(() => {
    return unscheduledTasks.reduce((sum, task) => sum + (task.estimated_duration || 30), 0);
  }, [unscheduledTasks]);

  // אלגוריתם שיבוץ
  const calculateSchedule = () => {
    const schedule = [];
    const availableSlots = [...freeSlots];
    const tasksToSchedule = [...unscheduledTasks].sort((a, b) => {
      // מיון לפי עדיפות: קודם לפי דחיפות, אח"כ לפי משך (קצרות קודם)
      const priorityA = a.priority || 0;
      const priorityB = b.priority || 0;
      if (priorityA !== priorityB) return priorityB - priorityA;
      return (a.estimated_duration || 30) - (b.estimated_duration || 30);
    });

    tasksToSchedule.forEach(task => {
      const duration = task.estimated_duration || 30;
      
      // מציאת חלון מתאים
      for (let i = 0; i < availableSlots.length; i++) {
        const slot = availableSlots[i];
        
        if (slot.duration >= duration) {
          // נמצא חלון מתאים
          schedule.push({
            task,
            time: slot.start,
            date: getDateISO(selectedDate)
          });

          // עדכון החלון
          if (slot.duration === duration) {
            // החלון נוצל במלואו
            availableSlots.splice(i, 1);
          } else {
            // עדכון זמן ההתחלה של החלון
            const startMinutes = parseInt(slot.start.split(':')[0]) * 60 + parseInt(slot.start.split(':')[1]);
            const newStartMinutes = startMinutes + duration;
            const newHour = Math.floor(newStartMinutes / 60);
            const newMin = newStartMinutes % 60;
            slot.start = `${newHour.toString().padStart(2, '0')}:${newMin.toString().padStart(2, '0')}`;
            slot.duration -= duration;
          }
          
          break;
        }
      }
    });

    return schedule;
  };

  // תצוגה מקדימה
  const handlePreview = () => {
    const schedule = calculateSchedule();
    setScheduledTasks(schedule);
    setShowPreview(true);
  };

  // ביצוע השיבוץ
  const handleSchedule = async () => {
    if (scheduledTasks.length === 0) return;
    
    setScheduling(true);
    try {
      for (const item of scheduledTasks) {
        await editTask(item.task.id, {
          dueDate: item.date,
          dueTime: item.time
        });
      }
      
      await loadTasks();
      toast.success(`${scheduledTasks.length} משימות שובצו בהצלחה!`);
      
      if (onScheduled) onScheduled();
      if (onClose) onClose();
    } catch (err) {
      console.error('שגיאה בשיבוץ:', err);
      toast.error('שגיאה בשיבוץ המשימות');
    } finally {
      setScheduling(false);
    }
  };

  // פורמט דקות
  const formatMinutes = (minutes) => {
    if (minutes < 60) return `${minutes} דק'`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours} שעות`;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
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
            {formatMinutes(totalFreeTime)}
          </div>
          <div className="text-sm text-green-700 dark:text-green-300">
            זמן פנוי היום
          </div>
          <div className="text-xs text-green-500 dark:text-green-400 mt-1">
            ({freeSlots.length} חלונות)
          </div>
        </div>
      </div>

      {/* חלונות זמן פנויים */}
      {freeSlots.length > 0 && (
        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            🕐 חלונות זמן פנויים:
          </h4>
          <div className="flex flex-wrap gap-2">
            {freeSlots.map((slot, index) => (
              <span 
                key={index}
                className="px-2 py-1 bg-white dark:bg-gray-700 rounded text-sm border border-gray-200 dark:border-gray-600"
              >
                {slot.start} - {slot.end} ({formatMinutes(slot.duration)})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* אזהרות */}
      {totalUnscheduledTime > totalFreeTime && (
        <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-orange-700 dark:text-orange-300 text-sm">
          ⚠️ יש יותר משימות מזמן פנוי. חלק מהמשימות לא ישובצו.
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
                    className="p-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-sm ${taskType.color}`}>
                        {taskType.icon}
                      </span>
                      <span className="text-gray-900 dark:text-white">
                        {item.task.title}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {item.time} • {formatMinutes(item.task.estimated_duration || 30)}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* כפתורים */}
      <div className="flex gap-2">
        {!showPreview ? (
          <button
            onClick={handlePreview}
            disabled={unscheduledTasks.length === 0 || freeSlots.length === 0}
            className="flex-1 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            🔍 תצוגה מקדימה
          </button>
        ) : (
          <>
            <button
              onClick={() => setShowPreview(false)}
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
          </>
        )}
      </div>

      {/* הסבר */}
      <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
        💡 המערכת משבצת משימות קצרות קודם לניצול מיטבי של הזמן
      </div>
    </div>
  );
}

export default SmartScheduler;

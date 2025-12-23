import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TASK_TYPES } from './DailyView';
import { findOverlappingTasks, findNextFreeSlot, timeToMinutes, minutesToTime } from '../../utils/timeOverlap';
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
 * בדיקה אם התאריך הוא היום
 */
function isToday(date) {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

/**
 * המרה לתאריך עברי
 */
function getHebrewDate(date) {
  try {
    const formatter = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
      day: 'numeric',
      month: 'short'
    });
    return formatter.format(date);
  } catch (e) {
    return '';
  }
}

/**
 * תצוגת שבוע כיומן עם גרירה
 */
function WeeklyCalendarView({ tasks, selectedDate, onSelectDate, onEditTask, onUpdateTask }) {
  const [draggedTask, setDraggedTask] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [overlapDialog, setOverlapDialog] = useState(null); // {task, newDate, newTime, overlapping, suggestedTime}

  // ימות השבוע (ראשון עד חמישי - ימי עבודה)
  const weekDays = useMemo(() => {
    const days = [];
    const startOfWeek = new Date(selectedDate);
    const dayOfWeek = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek); // חזרה ליום ראשון
    
    // רק ימי עבודה: ראשון עד חמישי (0-4)
    for (let i = 0; i <= 4; i++) {
      const day = new Date(startOfWeek);
      day.setDate(day.getDate() + i);
      days.push(day);
    }
    return days;
  }, [selectedDate]);

  // שעות העבודה
  const hours = useMemo(() => {
    const hoursArray = [];
    for (let h = WORK_HOURS.start; h < WORK_HOURS.end; h++) {
      hoursArray.push(h);
    }
    return hoursArray;
  }, []);

  // מיפוי משימות לפי יום ושעה
  const tasksByDayAndHour = useMemo(() => {
    const map = {};
    
    weekDays.forEach(day => {
      const dateISO = getDateISO(day);
      map[dateISO] = {};
      
      // אתחול כל השעות
      hours.forEach(hour => {
        map[dateISO][hour] = [];
      });
    });

    // מיון משימות
    tasks.forEach(task => {
      const taskDate = task.due_date;
      if (!taskDate || !map[taskDate]) return;
      
      // אם יש שעה - נשים בשעה הנכונה
      if (task.due_time) {
        const hour = parseInt(task.due_time.split(':')[0]);
        if (hour >= WORK_HOURS.start && hour < WORK_HOURS.end) {
          map[taskDate][hour].push(task);
          return;
        }
      }
      
      // אם אין שעה - נשים בתחילת היום
      map[taskDate][WORK_HOURS.start].push(task);
    });

    return map;
  }, [tasks, weekDays, hours]);

  // חישוב כמה שורות תופסת משימה (לפי משך)
  const getTaskRowSpan = (task) => {
    const duration = task.estimated_duration || 30;
    return Math.max(1, Math.ceil(duration / 60));
  };

  // התחלת גרירה
  const handleDragStart = (e, task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);
  };

  // גרירה מעל תא
  const handleDragOver = (e, dateISO, hour) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget({ date: dateISO, hour });
  };

  // יציאה מתא
  const handleDragLeave = () => {
    setDropTarget(null);
  };

  // שחרור
  const handleDrop = async (e, dateISO, hour) => {
    e.preventDefault();
    setDropTarget(null);
    
    if (!draggedTask) return;
    
    const newTime = `${hour.toString().padStart(2, '0')}:00`;
    
    // בדיקה אם יש שינוי
    if (draggedTask.due_date === dateISO && draggedTask.due_time === newTime) {
      setDraggedTask(null);
      return;
    }

    // בדיקת חפיפות
    const newTaskData = {
      id: draggedTask.id,
      dueDate: dateISO,
      dueTime: newTime,
      estimatedDuration: draggedTask.estimated_duration || 30
    };

    const overlapping = findOverlappingTasks(newTaskData, tasks);
    
    if (overlapping.length > 0) {
      // מציאת זמן פנוי חלופי
      const nextFree = findNextFreeSlot(
        dateISO,
        draggedTask.estimated_duration || 30,
        tasks
      );

      setOverlapDialog({
        task: draggedTask,
        newDate: dateISO,
        newTime: newTime,
        overlapping: overlapping,
        suggestedTime: nextFree
      });
      setDraggedTask(null);
      return;
    }

    // אין חפיפה - מעדכן
    try {
      if (onUpdateTask) {
        await onUpdateTask(draggedTask.id, {
          dueDate: dateISO,
          dueTime: newTime
        });
        toast.success('המשימה הועברה');
      }
    } catch (err) {
      toast.error('שגיאה בהעברת המשימה');
    }
    
    setDraggedTask(null);
  };

  // אישור העברה למרות חפיפה
  const handleForceMove = async () => {
    if (!overlapDialog) return;
    
    try {
      if (onUpdateTask) {
        await onUpdateTask(overlapDialog.task.id, {
          dueDate: overlapDialog.newDate,
          dueTime: overlapDialog.newTime
        });
        toast.success('המשימה הועברה');
      }
    } catch (err) {
      toast.error('שגיאה בהעברת המשימה');
    }
    
    setOverlapDialog(null);
  };

  // העברה לזמן פנוי
  const handleMoveToFreeSlot = async () => {
    if (!overlapDialog?.suggestedTime) return;
    
    try {
      if (onUpdateTask) {
        await onUpdateTask(overlapDialog.task.id, {
          dueDate: overlapDialog.newDate,
          dueTime: overlapDialog.suggestedTime
        });
        toast.success(`המשימה הועברה ל-${overlapDialog.suggestedTime}`);
      }
    } catch (err) {
      toast.error('שגיאה בהעברת המשימה');
    }
    
    setOverlapDialog(null);
  };

  // סיום גרירה
  const handleDragEnd = () => {
    setDraggedTask(null);
    setDropTarget(null);
  };

  // שמות הימים בעברית
  const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי'];

  // חישוב סיכום לכל יום
  const daySummary = useMemo(() => {
    const summary = {};
    weekDays.forEach(day => {
      const dateISO = getDateISO(day);
      const dayTasks = tasks.filter(t => t.due_date === dateISO && !t.is_completed);
      const completedTasks = tasks.filter(t => t.due_date === dateISO && t.is_completed);
      const totalMinutes = dayTasks.reduce((sum, t) => sum + (t.estimated_duration || 30), 0);
      const completedMinutes = completedTasks.reduce((sum, t) => sum + (t.time_spent || t.estimated_duration || 30), 0);
      
      summary[dateISO] = {
        taskCount: dayTasks.length,
        completedCount: completedTasks.length,
        totalMinutes,
        completedMinutes,
        isFull: totalMinutes >= (WORK_HOURS.end - WORK_HOURS.start) * 60 * 0.8
      };
    });
    return summary;
  }, [tasks, weekDays]);

  return (
    <div className="overflow-x-auto bg-white dark:bg-gray-900 rounded-xl shadow-lg">
      <div className="min-w-[800px]">
        {/* כותרת עם ימים */}
        <div className="grid grid-cols-[70px_repeat(5,1fr)] border-b-2 border-gray-200 dark:border-gray-700">
          {/* פינה ריקה */}
          <div className="p-3 bg-gradient-to-b from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-850"></div>
          
          {/* כותרות ימים */}
          {weekDays.map((day, index) => {
            const isTodayDay = isToday(day);
            const isSelected = getDateISO(day) === getDateISO(selectedDate);
            const dateISO = getDateISO(day);
            const summary = daySummary[dateISO] || {};
            
            return (
              <button
                key={index}
                onClick={() => onSelectDate(day)}
                className={`
                  p-3 text-center border-r border-gray-200 dark:border-gray-700
                  transition-all cursor-pointer
                  ${isTodayDay 
                    ? 'bg-gradient-to-b from-blue-100 to-blue-50 dark:from-blue-900/40 dark:to-blue-900/20' 
                    : 'bg-gradient-to-b from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-850'}
                  ${isSelected ? 'ring-2 ring-blue-500 ring-inset shadow-inner' : ''}
                  hover:from-blue-50 hover:to-white dark:hover:from-blue-900/30 dark:hover:to-gray-800
                `}
              >
                <div className="font-bold text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wide">
                  {dayNames[index]}
                </div>
                <div className={`text-2xl font-bold my-1 ${
                  isTodayDay 
                    ? 'text-blue-600 dark:text-blue-400' 
                    : 'text-gray-800 dark:text-gray-200'
                }`}>
                  {day.getDate()}
                </div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-1">
                  {getHebrewDate(day)}
                </div>
                {isTodayDay && (
                  <span className="inline-block px-2 py-0.5 bg-blue-500 text-white text-[10px] font-bold rounded-full">
                    היום
                  </span>
                )}
                {/* סיכום יומי */}
                {summary.taskCount > 0 && (
                  <div className={`mt-1 text-[10px] px-1.5 py-0.5 rounded-full ${
                    summary.isFull 
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' 
                      : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                  }`}>
                    {summary.taskCount} משימות
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* שורות שעות */}
        {hours.map((hour) => (
          <div
            key={hour}
            className="grid grid-cols-[70px_repeat(5,1fr)] border-b border-gray-100 dark:border-gray-800 min-h-[70px] hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
          >
            {/* עמודת שעות */}
            <div className="p-2 text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 border-l border-gray-200 dark:border-gray-700 flex items-start justify-center pt-3">
              {hour.toString().padStart(2, '0')}:00
            </div>
            
            {/* תאי ימים */}
            {weekDays.map((day, dayIndex) => {
              const dateISO = getDateISO(day);
              const tasksInSlot = tasksByDayAndHour[dateISO]?.[hour] || [];
              const isTodayDay = isToday(day);
              const isDropZone = dropTarget?.date === dateISO && dropTarget?.hour === hour;
              
              return (
                <div
                  key={dayIndex}
                  onDragOver={(e) => handleDragOver(e, dateISO, hour)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, dateISO, hour)}
                  className={`
                    p-1.5 border-r border-gray-100 dark:border-gray-800 relative
                    transition-all duration-200
                    ${isTodayDay ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}
                    ${isDropZone ? 'bg-green-100 dark:bg-green-900/30 ring-2 ring-green-400 ring-inset scale-[1.02]' : ''}
                    hover:bg-gray-50 dark:hover:bg-gray-800/50
                  `}
                >
                  {/* אינדיקטור שחרור */}
                  {isDropZone && tasksInSlot.length === 0 && (
                    <div className="absolute inset-2 border-2 border-dashed border-green-400 rounded-lg flex items-center justify-center bg-green-50/50 dark:bg-green-900/20">
                      <span className="text-green-600 dark:text-green-400 text-xs font-medium">📍 שחרר כאן</span>
                    </div>
                  )}
                  
                  {tasksInSlot.map((task) => {
                    const taskType = TASK_TYPES[task.task_type] || TASK_TYPES.other;
                    const rowSpan = getTaskRowSpan(task);
                    const isDragging = draggedTask?.id === task.id;
                    const progressPercent = task.estimated_duration 
                      ? Math.min(100, Math.round((task.time_spent || 0) / task.estimated_duration * 100))
                      : 0;
                    
                    return (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: isDragging ? 0.5 : 1, scale: 1 }}
                        whileHover={{ scale: 1.02 }}
                        draggable={!task.is_completed}
                        onDragStart={(e) => handleDragStart(e, task)}
                        onDragEnd={handleDragEnd}
                        onClick={() => onEditTask(task)}
                        className={`
                          w-full text-right p-2 rounded-lg text-xs mb-1.5 border shadow-sm
                          transition-all hover:shadow-lg
                          ${task.is_completed 
                            ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 line-through opacity-60 border-gray-200 dark:border-gray-700 cursor-pointer' 
                            : taskType.color + ' hover:opacity-90 cursor-grab active:cursor-grabbing'
                          }
                          ${isDragging ? 'shadow-xl ring-2 ring-blue-500 rotate-1' : ''}
                        `}
                        style={{
                          minHeight: `${rowSpan * 55}px`
                        }}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-base">{taskType.icon}</span>
                          <span className="font-semibold truncate flex-1">{task.title}</span>
                          {task.priority === 'urgent' && <span className="text-red-500">🔴</span>}
                          {task.priority === 'high' && <span className="text-orange-500">🟠</span>}
                        </div>
                        
                        {/* זמן */}
                        {task.due_time && (
                          <div className="text-[10px] opacity-80 mb-1">
                            🕐 {task.due_time}
                          </div>
                        )}
                        
                        {/* התקדמות */}
                        {task.estimated_duration && !task.is_completed && (
                          <div className="mt-1">
                            <div className="flex justify-between text-[10px] opacity-75 mb-0.5">
                              <span>{task.time_spent || 0}/{task.estimated_duration} דק'</span>
                              <span>{progressPercent}%</span>
                            </div>
                            <div className="w-full h-1 bg-white/50 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all ${
                                  progressPercent >= 100 ? 'bg-green-500' : 'bg-white/80'
                                }`}
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                          </div>
                        )}
                        
                        {/* אייקון גרירה */}
                        {!task.is_completed && (
                          <div className="absolute top-1 left-1 opacity-30 hover:opacity-70 text-[10px]">
                            ⋮⋮
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      
      {/* מקרא צבעים */}
      <div className="mt-4 flex flex-wrap gap-2 justify-center text-xs">
        {Object.values(TASK_TYPES).map(type => (
          <div 
            key={type.id}
            className={`px-2 py-1 rounded-full border ${type.color}`}
          >
            {type.icon} {type.name}
          </div>
        ))}
      </div>

      {/* דיאלוג חפיפה */}
      <AnimatePresence>
        {overlapDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setOverlapDialog(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-5 max-w-md w-full shadow-xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start gap-3 mb-4">
                <span className="text-3xl">⚠️</span>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    יש חפיפה בזמנים!
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    המשימה "{overlapDialog.task.title}" חופפת עם:
                  </p>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                {overlapDialog.overlapping.map(t => {
                  const taskType = TASK_TYPES[t.task_type] || TASK_TYPES.other;
                  const endTime = timeToMinutes(t.due_time) + (t.estimated_duration || 30);
                  return (
                    <div key={t.id} className="flex items-center gap-2 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                      <span className={`px-2 py-1 rounded ${taskType.color}`}>{taskType.icon}</span>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-white">{t.title}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {t.due_time} - {minutesToTime(endTime)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-2">
                {overlapDialog.suggestedTime && (
                  <button
                    onClick={handleMoveToFreeSlot}
                    className="w-full py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors"
                  >
                    ✅ העבר ל-{overlapDialog.suggestedTime} (זמן פנוי)
                  </button>
                )}
                <button
                  onClick={handleForceMove}
                  className="w-full py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
                >
                  ⚡ העבר בכל זאת (חפיפה)
                </button>
                <button
                  onClick={() => setOverlapDialog(null)}
                  className="w-full py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  ✕ ביטול
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default WeeklyCalendarView;

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TASK_TYPES } from './DailyView';
import toast from 'react-hot-toast';

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
      day: 'numeric'
    });
    return formatter.format(date);
  } catch (e) {
    return '';
  }
}

/**
 * תצוגת שבוע קומפקטית
 */
function WeeklyCalendarView({ tasks, selectedDate, onSelectDate, onEditTask, onUpdateTask }) {
  const [draggedTask, setDraggedTask] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);

  // ימות השבוע (ראשון עד חמישי)
  const weekDays = useMemo(() => {
    const days = [];
    const startOfWeek = new Date(selectedDate);
    const dayOfWeek = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);
    
    for (let i = 0; i <= 4; i++) {
      const day = new Date(startOfWeek);
      day.setDate(day.getDate() + i);
      days.push(day);
    }
    return days;
  }, [selectedDate]);

  // משימות לפי יום
  const tasksByDay = useMemo(() => {
    const map = {};
    weekDays.forEach(day => {
      const dateISO = getDateISO(day);
      map[dateISO] = tasks
        .filter(t => t.due_date === dateISO)
        .sort((a, b) => {
          if (!a.due_time) return 1;
          if (!b.due_time) return -1;
          return a.due_time.localeCompare(b.due_time);
        });
    });
    return map;
  }, [tasks, weekDays]);

  // סיכום לכל יום
  const daySummary = useMemo(() => {
    const summary = {};
    weekDays.forEach(day => {
      const dateISO = getDateISO(day);
      const dayTasks = tasksByDay[dateISO] || [];
      const activeTasks = dayTasks.filter(t => !t.is_completed);
      const completedTasks = dayTasks.filter(t => t.is_completed);
      const totalMinutes = activeTasks.reduce((sum, t) => sum + (t.estimated_duration || 30), 0);
      
      summary[dateISO] = {
        total: dayTasks.length,
        active: activeTasks.length,
        completed: completedTasks.length,
        minutes: totalMinutes,
        hours: Math.floor(totalMinutes / 60),
        mins: totalMinutes % 60
      };
    });
    return summary;
  }, [tasksByDay, weekDays]);

  // גרירה
  const handleDragStart = (e, task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, dateISO) => {
    e.preventDefault();
    setDropTarget(dateISO);
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  const handleDrop = async (e, dateISO) => {
    e.preventDefault();
    setDropTarget(null);
    
    if (!draggedTask || draggedTask.due_date === dateISO) {
      setDraggedTask(null);
      return;
    }

    try {
      if (onUpdateTask) {
        await onUpdateTask(draggedTask.id, {
          dueDate: dateISO,
          dueTime: draggedTask.due_time
        });
        toast.success('המשימה הועברה');
      }
    } catch (err) {
      toast.error('שגיאה בהעברה');
    }
    
    setDraggedTask(null);
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
    setDropTarget(null);
  };

  const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי'];

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* כותרות ימים */}
      <div className="grid grid-cols-5 border-b border-gray-200 dark:border-gray-700">
        {weekDays.map((day, index) => {
          const isTodayDay = isToday(day);
          const isSelected = getDateISO(day) === getDateISO(selectedDate);
          const dateISO = getDateISO(day);
          const summary = daySummary[dateISO];
          
          return (
            <button
              key={index}
              onClick={() => onSelectDate(day)}
              className={`
                py-3 px-2 text-center transition-all
                ${isTodayDay 
                  ? 'bg-blue-50 dark:bg-blue-900/30' 
                  : 'bg-gray-50 dark:bg-gray-800/50'}
                ${isSelected ? 'ring-2 ring-inset ring-blue-500' : ''}
                ${index < 4 ? 'border-l border-gray-200 dark:border-gray-700' : ''}
                hover:bg-blue-100 dark:hover:bg-blue-900/40
              `}
            >
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {dayNames[index]}
              </div>
              <div className={`text-xl font-bold ${
                isTodayDay ? 'text-blue-600 dark:text-blue-400' : 'text-gray-800 dark:text-gray-200'
              }`}>
                {day.getDate()}
              </div>
              <div className="text-[10px] text-gray-400">{getHebrewDate(day)}</div>
              {isTodayDay && (
                <span className="inline-block mt-1 px-1.5 py-0.5 bg-blue-500 text-white text-[10px] rounded-full">
                  היום
                </span>
              )}
              {summary.active > 0 && (
                <div className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
                  {summary.active} משימות • {summary.hours > 0 ? `${summary.hours}:${summary.mins.toString().padStart(2,'0')}` : `${summary.mins}ד'`}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* תוכן - משימות */}
      <div className="grid grid-cols-5 min-h-[400px]">
        {weekDays.map((day, dayIndex) => {
          const dateISO = getDateISO(day);
          const dayTasks = tasksByDay[dateISO] || [];
          const isTodayDay = isToday(day);
          const isDropZone = dropTarget === dateISO;
          
          return (
            <div
              key={dayIndex}
              onDragOver={(e) => handleDragOver(e, dateISO)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, dateISO)}
              className={`
                p-2 transition-all
                ${dayIndex < 4 ? 'border-l border-gray-100 dark:border-gray-800' : ''}
                ${isTodayDay ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}
                ${isDropZone ? 'bg-green-50 dark:bg-green-900/20 ring-2 ring-inset ring-green-400' : ''}
              `}
            >
              {/* אזור שחרור */}
              {isDropZone && dayTasks.length === 0 && (
                <div className="h-20 border-2 border-dashed border-green-400 rounded-lg flex items-center justify-center mb-2">
                  <span className="text-green-600 dark:text-green-400 text-xs">📍 שחרר כאן</span>
                </div>
              )}

              {/* משימות */}
              <div className="space-y-1.5">
                {dayTasks.map((task) => {
                  const taskType = TASK_TYPES[task.task_type] || TASK_TYPES.other;
                  const isDragging = draggedTask?.id === task.id;
                  const progress = task.estimated_duration 
                    ? Math.min(100, Math.round((task.time_spent || 0) / task.estimated_duration * 100))
                    : 0;
                  
                  return (
                    <motion.div
                      key={task.id}
                      layout
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: isDragging ? 0.5 : 1, y: 0 }}
                      draggable={!task.is_completed}
                      onDragStart={(e) => handleDragStart(e, task)}
                      onDragEnd={handleDragEnd}
                      onClick={() => onEditTask(task)}
                      className={`
                        p-2 rounded-lg text-xs cursor-pointer
                        transition-all hover:shadow-md
                        ${task.is_completed 
                          ? 'bg-gray-100 dark:bg-gray-800 opacity-50 line-through' 
                          : taskType.color}
                        ${isDragging ? 'shadow-lg ring-2 ring-blue-500' : ''}
                        ${!task.is_completed ? 'cursor-grab active:cursor-grabbing' : ''}
                      `}
                    >
                      {/* שורה עליונה */}
                      <div className="flex items-center gap-1 mb-0.5">
                        <span className="text-sm">{taskType.icon}</span>
                        <span className="font-medium truncate flex-1">{task.title}</span>
                      </div>
                      
                      {/* שעה וזמן */}
                      <div className="flex items-center justify-between text-[10px] opacity-80">
                        <span>{task.due_time || '--:--'}</span>
                        {task.estimated_duration && (
                          <span>{task.time_spent || 0}/{task.estimated_duration}ד'</span>
                        )}
                      </div>
                      
                      {/* סרגל התקדמות */}
                      {task.estimated_duration && !task.is_completed && progress > 0 && (
                        <div className="mt-1 h-1 bg-white/30 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${progress >= 100 ? 'bg-green-400' : 'bg-white/70'}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {/* הודעה אם אין משימות */}
              {dayTasks.length === 0 && !isDropZone && (
                <div className="h-20 flex items-center justify-center text-gray-400 dark:text-gray-600 text-xs">
                  אין משימות
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* מקרא */}
      <div className="p-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex flex-wrap gap-2 justify-center">
          {Object.values(TASK_TYPES).map(type => (
            <div 
              key={type.id}
              className={`px-2 py-0.5 rounded-full text-[10px] ${type.color}`}
            >
              {type.icon} {type.name}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default WeeklyCalendarView;

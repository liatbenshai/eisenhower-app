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
 * פורמט דקות
 */
function formatMinutes(minutes) {
  if (!minutes) return '0';
  if (minutes < 60) return `${minutes}ד'`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}:${mins.toString().padStart(2, '0')}` : `${hours}ש'`;
}

/**
 * המרת תאריך עברי
 */
function getHebrewDate(date) {
  try {
    const formatter = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { day: 'numeric' });
    return formatter.format(date);
  } catch {
    return '';
  }
}

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const DAY_NAMES_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

/**
 * תצוגת שבוע - עיצוב חדש ונקי
 */
function WeeklyCalendarView({ tasks, selectedDate, onSelectDate, onEditTask, onUpdateTask }) {
  const [draggedTask, setDraggedTask] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [hoveredDay, setHoveredDay] = useState(null);

  // ימות השבוע (ראשון עד שבת)
  const weekDays = useMemo(() => {
    const days = [];
    const startOfWeek = new Date(selectedDate);
    const dayOfWeek = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);
    
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(day.getDate() + i);
      days.push(day);
    }
    return days;
  }, [selectedDate]);

  // ניווט שבועות
  const goToPrevWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 7);
    onSelectDate(newDate);
  };

  const goToNextWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 7);
    onSelectDate(newDate);
  };

  const goToThisWeek = () => {
    onSelectDate(new Date());
  };

  // טווח תאריכים של השבוע
  const weekRange = useMemo(() => {
    const first = weekDays[0];
    const last = weekDays[6];
    const formatDate = (d) => `${d.getDate()}/${d.getMonth() + 1}`;
    return `${formatDate(first)} - ${formatDate(last)}`;
  }, [weekDays]);

  // משימות לפי יום
  const tasksByDay = useMemo(() => {
    const map = {};
    weekDays.forEach(day => {
      const dateISO = getDateISO(day);
      map[dateISO] = tasks
        .filter(t => t.due_date === dateISO && !t.is_completed)
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
      const totalMinutes = dayTasks.reduce((sum, t) => sum + (t.estimated_duration || 30), 0);
      const completedTasks = tasks.filter(t => t.due_date === dateISO && t.is_completed);
      
      summary[dateISO] = {
        active: dayTasks.length,
        completed: completedTasks.length,
        minutes: totalMinutes,
        isBusy: totalMinutes > 360, // יותר מ-6 שעות
        isEmpty: dayTasks.length === 0
      };
    });
    return summary;
  }, [tasksByDay, tasks, weekDays]);

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
        toast.success('📅 המשימה הועברה!');
      }
    } catch {
      toast.error('שגיאה');
    }
    
    setDraggedTask(null);
  };

  return (
    <div className="space-y-4">
      {/* כותרת וניווט */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={goToPrevWeek}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-xl"
          >
            ◀
          </button>
          
          <div className="text-center">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {weekRange}
            </h2>
            <p className="text-sm text-gray-500">
              {weekDays[0].toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })}
            </p>
          </div>
          
          <button
            onClick={goToNextWeek}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-xl"
          >
            ▶
          </button>
        </div>

        <button
          onClick={goToThisWeek}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          השבוע
        </button>
      </div>

      {/* לוח שבועי */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700">
        {/* כותרות ימים */}
        <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
          {weekDays.map((day, index) => {
            const isTodayDay = isToday(day);
            const dateISO = getDateISO(day);
            const summary = daySummary[dateISO];
            const isWeekend = index >= 5;
            
            return (
              <button
                key={index}
                onClick={() => onSelectDate(day)}
                className={`
                  py-3 px-2 text-center transition-all relative
                  ${isTodayDay ? 'bg-blue-50 dark:bg-blue-900/30' : ''}
                  ${isWeekend ? 'bg-gray-100/50 dark:bg-gray-800/50' : ''}
                  hover:bg-blue-100 dark:hover:bg-blue-900/40
                  ${index > 0 ? 'border-r border-gray-200 dark:border-gray-700' : ''}
                `}
              >
                {/* שם היום */}
                <div className={`text-xs font-medium ${
                  isTodayDay ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'
                }`}>
                  {DAY_NAMES_SHORT[index]}
                </div>
                
                {/* מספר */}
                <div className={`
                  text-2xl font-bold mt-1
                  ${isTodayDay 
                    ? 'text-blue-600 dark:text-blue-400' 
                    : 'text-gray-800 dark:text-gray-200'
                  }
                `}>
                  {day.getDate()}
                </div>
                
                {/* תאריך עברי */}
                <div className="text-[10px] text-gray-400 mt-0.5">
                  {getHebrewDate(day)}
                </div>
                
                {/* אינדיקטור היום */}
                {isTodayDay && (
                  <div className="absolute top-1 left-1 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                )}
                
                {/* סיכום */}
                {summary.active > 0 && (
                  <div className={`
                    mt-2 text-[10px] px-2 py-0.5 rounded-full mx-auto inline-block
                    ${summary.isBusy 
                      ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' 
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                    }
                  `}>
                    {summary.active} • {formatMinutes(summary.minutes)}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* תוכן - משימות */}
        <div className="grid grid-cols-7 min-h-[350px]">
          {weekDays.map((day, dayIndex) => {
            const dateISO = getDateISO(day);
            const dayTasks = tasksByDay[dateISO] || [];
            const isTodayDay = isToday(day);
            const isDropZone = dropTarget === dateISO;
            const isHovered = hoveredDay === dateISO;
            const isWeekend = dayIndex >= 5;
            
            return (
              <div
                key={dayIndex}
                onDragOver={(e) => handleDragOver(e, dateISO)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, dateISO)}
                onMouseEnter={() => setHoveredDay(dateISO)}
                onMouseLeave={() => setHoveredDay(null)}
                className={`
                  p-2 transition-all min-h-[300px]
                  ${dayIndex > 0 ? 'border-r border-gray-100 dark:border-gray-700' : ''}
                  ${isTodayDay ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}
                  ${isWeekend ? 'bg-gray-50/30 dark:bg-gray-800/30' : ''}
                  ${isDropZone ? 'bg-green-50 dark:bg-green-900/20 ring-2 ring-inset ring-green-400' : ''}
                `}
              >
                {/* אזור גרירה */}
                {isDropZone && dayTasks.length === 0 && (
                  <div className="h-16 border-2 border-dashed border-green-400 rounded-lg flex items-center justify-center mb-2 animate-pulse">
                    <span className="text-green-600 text-xs">📍 שחרר כאן</span>
                  </div>
                )}

                {/* משימות */}
                <div className="space-y-1.5">
                  <AnimatePresence>
                    {dayTasks.slice(0, 6).map((task) => {
                      const taskType = TASK_TYPES[task.task_type] || TASK_TYPES.other;
                      const isDragging = draggedTask?.id === task.id;
                      const progress = task.estimated_duration 
                        ? Math.min(100, Math.round((task.time_spent || 0) / task.estimated_duration * 100))
                        : 0;
                      
                      return (
                        <motion.div
                          key={task.id}
                          layout
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: isDragging ? 0.5 : 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task)}
                          onDragEnd={() => setDraggedTask(null)}
                          onClick={() => onEditTask(task)}
                          className={`
                            p-2 rounded-lg text-xs cursor-grab active:cursor-grabbing
                            transition-all hover:shadow-md border
                            ${taskType.color}
                            ${isDragging ? 'shadow-lg ring-2 ring-blue-500 opacity-50' : ''}
                          `}
                        >
                          {/* שורה עליונה */}
                          <div className="flex items-center gap-1.5">
                            <span className="flex-shrink-0">{taskType.icon}</span>
                            <span className="font-medium truncate">{task.title}</span>
                          </div>
                          
                          {/* פרטים */}
                          <div className="flex items-center justify-between mt-1 text-[10px] opacity-70">
                            <span dir="ltr">{task.due_time ? task.due_time.substring(0, 5) : '---'}</span>
                            <span>{formatMinutes(task.estimated_duration)}</span>
                          </div>
                          
                          {/* התקדמות */}
                          {progress > 0 && (
                            <div className="mt-1.5 h-1 bg-white/30 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${progress >= 100 ? 'bg-green-400' : 'bg-white/70'}`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                  
                  {/* עוד משימות */}
                  {dayTasks.length > 6 && (
                    <button
                      onClick={() => onSelectDate(day)}
                      className="w-full text-center text-xs text-blue-500 hover:text-blue-700 py-1"
                    >
                      +{dayTasks.length - 6} עוד...
                    </button>
                  )}
                </div>

                {/* ריק */}
                {dayTasks.length === 0 && !isDropZone && (
                  <div className={`
                    h-full flex items-center justify-center transition-opacity
                    ${isHovered ? 'opacity-100' : 'opacity-0'}
                  `}>
                    <button
                      onClick={() => onSelectDate(day)}
                      className="text-xs text-gray-400 hover:text-blue-500"
                    >
                      + הוסף
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* מקרא */}
      <div className="flex flex-wrap gap-2 justify-center">
        {Object.values(TASK_TYPES).map(type => (
          <div 
            key={type.id}
            className={`px-2.5 py-1 rounded-lg text-xs border ${type.color}`}
          >
            {type.icon} {type.name}
          </div>
        ))}
      </div>
      
      {/* טיפ */}
      <p className="text-center text-xs text-gray-400">
        💡 גרור משימה ליום אחר כדי להזיז אותה
      </p>
    </div>
  );
}

export default WeeklyCalendarView;

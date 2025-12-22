import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTasks } from '../../hooks/useTasks';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  isToday, 
  startOfWeek, 
  endOfWeek,
  startOfDay,
  endOfDay,
  addDays,
  subDays,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  differenceInDays,
  parse,
  setHours,
  setMinutes
} from 'date-fns';
import { he } from 'date-fns/locale';
import TaskCard from '../Tasks/TaskCard';
import { isTaskOverdue, isTaskDueToday } from '../../utils/taskHelpers';
import toast from 'react-hot-toast';

/**
 * יומן - תצוגה יומית/שבועית/חודשית עם שעות
 */
function CalendarView({ onAddTask, onEditTask }) {
  const { tasks, editTask, removeTask, loadTasks } = useTasks();
  const [draggedTask, setDraggedTask] = useState(null);
  const [dragOverTarget, setDragOverTarget] = useState(null); // { date, hour }
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('week'); // 'day', 'week', 'month'
  
  // חישוב ימים לפי מצב תצוגה
  const { days, viewStart, viewEnd } = useMemo(() => {
    if (viewMode === 'day') {
      const day = startOfDay(currentDate);
      return {
        days: [day],
        viewStart: day,
        viewEnd: endOfDay(day)
      };
    } else if (viewMode === 'week') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
      return {
        days: eachDayOfInterval({ start: weekStart, end: weekEnd }),
        viewStart: weekStart,
        viewEnd: weekEnd
      };
    } else {
      // month
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
      const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
      return {
        days: eachDayOfInterval({ start: calendarStart, end: calendarEnd }),
        viewStart: monthStart,
        viewEnd: monthEnd
      };
    }
  }, [currentDate, viewMode]);
  
  // שעות היום (6:00-23:00)
  const hours = Array.from({ length: 18 }, (_, i) => i + 6);
  
  // קבלת משימות לפי תאריך ושעה
  const getTasksForDate = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const tasksForDate = [];
    
    tasks.forEach(task => {
      // משימות רגילות
      if (!task.parent_task_id) {
        const startDate = task.start_date || task.due_date;
        const dueDate = task.due_date;
        
        if (dueDate === dateStr || (startDate && dueDate && startDate <= dateStr && dateStr <= dueDate)) {
          tasksForDate.push(task);
        }
      }
      
      // שלבים של פרויקטים
      if (task.subtasks && task.subtasks.length > 0) {
        task.subtasks.forEach(st => {
          const subtaskStartDate = st.start_date || st.due_date;
          const subtaskDueDate = st.due_date;
          
          if (subtaskDueDate === dateStr || (subtaskStartDate && subtaskDueDate && subtaskStartDate <= dateStr && dateStr <= subtaskDueDate)) {
            tasksForDate.push({
              ...task,
              id: `subtask-${st.id}`,
              title: `${task.title} - ${st.title}`,
              due_date: st.due_date,
              start_date: st.start_date,
              due_time: st.due_time,
              is_subtask: true,
              subtask_data: st,
              progress: st.estimated_duration > 0 
                ? Math.min(100, Math.round((st.time_spent || 0) / st.estimated_duration * 100))
                : 0
            });
          }
        });
      }
    });
    
    return tasksForDate;
  };
  
  // קבלת משימות לפי שעה (ביום מסוים)
  const getTasksForHour = (date, hour) => {
    const tasksForDate = getTasksForDate(date);
    return tasksForDate.filter(task => {
      if (!task.due_time) return false;
      const [taskHour] = task.due_time.split(':').map(Number);
      return taskHour === hour;
    });
  };
  
  // בדיקה אם משימה באיחור או קרובה
  const getTaskStatus = (task, date) => {
    if (!task.due_date) return 'normal';
    const taskDate = new Date(task.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    taskDate.setHours(0, 0, 0, 0);
    
    if (taskDate < today) return 'overdue';
    if (taskDate.getTime() === today.getTime()) return 'today';
    const daysDiff = differenceInDays(taskDate, today);
    if (daysDiff <= 2) return 'urgent';
    if (daysDiff <= 7) return 'upcoming';
    return 'normal';
  };
  
  // ניווט
  const goToPrevious = () => {
    if (viewMode === 'day') {
      setCurrentDate(subDays(currentDate, 1));
    } else if (viewMode === 'week') {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subMonths(currentDate, 1));
    }
  };
  
  const goToNext = () => {
    if (viewMode === 'day') {
      setCurrentDate(addDays(currentDate, 1));
    } else if (viewMode === 'week') {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };
  
  const goToToday = () => {
    setCurrentDate(new Date());
  };
  
  // פורמט כותרת
  const getViewTitle = () => {
    if (viewMode === 'day') {
      return format(currentDate, 'EEEE, d בMMMM yyyy', { locale: he });
    } else if (viewMode === 'week') {
      return `שבוע ${format(viewStart, 'd/MM')} - ${format(viewEnd, 'd/MM/yyyy')}`;
    } else {
      return format(currentDate, 'MMMM yyyy', { locale: he });
    }
  };
  
  // שמות ימים
  const weekDays = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const weekDaysShort = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
  
  // הזזה אוטומטית של משימות לא הושלמו למחר
  const handleMoveUncompletedToTomorrow = useCallback(async () => {
    try {
      const movedTasks = await moveUncompletedTasksToTomorrow(editTask, tasks);
      if (movedTasks.length > 0) {
        toast.success(`${movedTasks.length} משימות הוזזו למחר`);
        await loadTasks();
      } else {
        toast.success('אין משימות להזיז');
      }
    } catch (err) {
      console.error('שגיאה בהזזת משימות:', err);
      toast.error('שגיאה בהזזת משימות');
    }
  }, [editTask, tasks, loadTasks]);
  
  // בדיקה אוטומטית בבוקר - אם יש משימות להזיז
  useEffect(() => {
    const checkAndMove = async () => {
      const lastMoveDate = localStorage.getItem('lastAutoMoveDate');
      const today = format(new Date(), 'yyyy-MM-dd');
      
      // רק פעם ביום, בבוקר (אחרי 6:00)
      if (lastMoveDate !== today && new Date().getHours() >= 6) {
        const movedTasks = await moveUncompletedTasksToTomorrow(editTask, tasks);
        if (movedTasks.length > 0) {
          localStorage.setItem('lastAutoMoveDate', today);
          toast.success(`הוזזו ${movedTasks.length} משימות לא הושלמו למחר`, { duration: 5000 });
          await loadTasks();
        }
      }
    };
    
    checkAndMove();
  }, [tasks, editTask, loadTasks]);
  
  return (
    <div className="space-y-4">
      {/* כותרת עם ניווט */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {getViewTitle()}
        </h2>
        
        <div className="flex items-center gap-3">
          {/* בחירת מצב תצוגה */}
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setViewMode('day')}
              className={`px-4 py-2 text-sm rounded-md transition-colors font-medium ${
                viewMode === 'day'
                  ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              יומי
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-4 py-2 text-sm rounded-md transition-colors font-medium ${
                viewMode === 'week'
                  ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              שבועי
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-4 py-2 text-sm rounded-md transition-colors font-medium ${
                viewMode === 'month'
                  ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              חודשי
            </button>
          </div>
          
          {/* כפתורי ניווט */}
          <div className="flex gap-2">
            <button
              onClick={goToPrevious}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              title="קודם"
            >
              ←
            </button>
            <button
              onClick={goToToday}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600 font-medium"
            >
              היום
            </button>
            <button
              onClick={handleMoveUncompletedToTomorrow}
              className="px-4 py-2 text-sm rounded-lg bg-green-600 dark:bg-green-500 text-white hover:bg-green-700 dark:hover:bg-green-600 font-medium"
              title="הזז משימות לא הושלמו למחר"
            >
              📅 הזז למחר
            </button>
            <button
              onClick={goToNext}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              title="הבא"
            >
              →
            </button>
          </div>
        </div>
      </div>
      
      {/* תוכן לוח השנה */}
      {viewMode === 'day' ? (
        /* תצוגה יומית עם שעות */
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* כותרת יום */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-b border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-4xl font-bold text-gray-900 dark:text-white mb-1">
                  {format(currentDate, 'd')}
                </div>
                <div className="text-xl text-gray-600 dark:text-gray-400">
                  {format(currentDate, 'EEEE, MMMM yyyy', { locale: he })}
                </div>
              </div>
              {onAddTask && (
                <button
                  onClick={() => onAddTask(format(currentDate, 'yyyy-MM-dd'))}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm transition-colors"
                >
                  + הוסף משימה
                </button>
              )}
            </div>
          </div>
          
          {/* שעות היום */}
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {hours.map(hour => {
              const hourTasks = getTasksForHour(currentDate, hour);
              const now = new Date();
              const isCurrentHour = isToday(currentDate) && now.getHours() === hour;
              
              return (
                <div
                  key={hour}
                  className={`relative min-h-[80px] flex ${
                    isCurrentHour ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                  }`}
                >
                  {/* שעה */}
                  <div className="w-20 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 p-3 text-right">
                    <div className={`text-sm font-medium ${
                      isCurrentHour 
                        ? 'text-blue-600 dark:text-blue-400' 
                        : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {hour}:00
                    </div>
                  </div>
                  
                  {/* תוכן - משימות */}
                  <div 
                    className={`flex-1 p-3 relative ${
                      dragOverTarget?.date && isSameDay(dragOverTarget.date, currentDate) && dragOverTarget.hour === hour
                        ? 'bg-blue-100 dark:bg-blue-900/30 ring-2 ring-blue-500'
                        : ''
                    }`}
                    onDragOver={(e) => handleDragOver(e, currentDate, hour)}
                    onDrop={(e) => handleDrop(e, currentDate, hour)}
                    onClick={() => onAddTask && onAddTask(format(currentDate, 'yyyy-MM-dd'), `${hour.toString().padStart(2, '0')}:00`)}
                  >
                    {hourTasks.length > 0 ? (
                      <div className="space-y-2">
                        {hourTasks.map(task => {
                          const status = getTaskStatus(task, currentDate);
                          return (
                            <div
                              key={task.id}
                              draggable={!task.is_subtask && !task.id?.startsWith('subtask-')}
                              onDragStart={(e) => {
                                if (!task.is_subtask && !task.id?.startsWith('subtask-')) {
                                  handleDragStart(task, currentDate, hour);
                                  e.dataTransfer.effectAllowed = 'move';
                                } else {
                                  e.preventDefault();
                                }
                              }}
                              onDragEnd={handleDragEnd}
                              onClick={(e) => {
                                e.stopPropagation();
                                // אם זו subtask, לא מאפשרים עריכה ישירה (צריך לערוך דרך הפרויקט)
                                if (!task.is_subtask && !task.id?.startsWith('subtask-') && onEditTask) {
                                  onEditTask(task);
                                }
                              }}
                              className={`p-2 rounded-lg border-2 transition-all relative group ${
                                task.is_subtask || task.id?.startsWith('subtask-')
                                  ? 'cursor-default opacity-75' 
                                  : 'cursor-pointer hover:shadow-md'
                              } ${
                                draggedTask?.task.id === task.id ? 'opacity-50' : ''
                              } ${
                                status === 'overdue' 
                                  ? 'border-red-500 bg-red-50 dark:bg-red-900/20' 
                                  : status === 'today'
                                  ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                                  : status === 'urgent'
                                  ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                                  : 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/10'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <h4 className="font-medium text-sm text-gray-900 dark:text-white flex-1">
                                  {task.title}
                                </h4>
                                <div className="flex items-center gap-2">
                                  {task.due_time && (
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                      {task.due_time}
                                    </span>
                                  )}
                                  {!task.is_subtask && !task.id?.startsWith('subtask-') && (
                                    <button
                                      onClick={(e) => handleDeleteTask(task.id, e)}
                                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-opacity"
                                      title="מחק משימה"
                                    >
                                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400 dark:text-gray-600 h-full flex items-center">
                        {/* ריק - לחיצה תוסיף משימה */}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : viewMode === 'week' ? (
        /* תצוגה שבועית עם שעות */
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* כותרות ימים */}
          <div className="grid grid-cols-8 border-b border-gray-200 dark:border-gray-700">
            <div className="p-3 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50"></div>
            {days.map((day, index) => {
              const isTodayDate = isToday(day);
              const dayTasks = getTasksForDate(day);
              return (
                <div
                  key={day.toISOString()}
                  className={`p-3 border-r border-gray-200 dark:border-gray-700 text-center ${
                    isTodayDate 
                      ? 'bg-blue-50 dark:bg-blue-900/20' 
                      : 'bg-gray-50 dark:bg-gray-900/50'
                  }`}
                >
                  <div className={`text-sm font-medium ${
                    isTodayDate 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    {weekDaysShort[index]}
                  </div>
                  <div className={`text-lg font-bold mt-1 ${
                    isTodayDate 
                      ? 'text-blue-700 dark:text-blue-300' 
                      : 'text-gray-900 dark:text-white'
                  }`}>
                    {format(day, 'd')}
                  </div>
                  {dayTasks.length > 0 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {dayTasks.length} משימות
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          {/* שעות + ימים */}
          <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[600px] overflow-y-auto">
            {hours.map(hour => {
              const now = new Date();
              return (
                <div key={hour} className="grid grid-cols-8">
                  {/* שעה */}
                  <div className="w-full flex-shrink-0 border-r border-gray-200 dark:border-gray-700 p-2 text-right bg-gray-50 dark:bg-gray-900/50">
                    <div className={`text-xs font-medium ${
                      isToday(currentDate) && now.getHours() === hour
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {hour}:00
                    </div>
                  </div>
                  
                  {/* ימים */}
                  {days.map(day => {
                    const hourTasks = getTasksForHour(day, hour);
                    const isTodayDate = isToday(day);
                    const isCurrentHour = isTodayDate && now.getHours() === hour;
                    
                    return (
                      <div
                        key={`${day.toISOString()}-${hour}`}
                        className={`min-h-[80px] border-r border-gray-200 dark:border-gray-700 p-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                          dragOverTarget?.date && isSameDay(dragOverTarget.date, day) && dragOverTarget.hour === hour
                            ? 'bg-blue-100 dark:bg-blue-900/30 ring-2 ring-blue-500'
                            : isCurrentHour ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                        }`}
                        onDragOver={(e) => handleDragOver(e, day, hour)}
                        onDrop={(e) => handleDrop(e, day, hour)}
                        onClick={() => onAddTask && onAddTask(format(day, 'yyyy-MM-dd'), `${hour.toString().padStart(2, '0')}:00`)}
                      >
                        {hourTasks.length > 0 && (
                          <div className="space-y-1">
                            {hourTasks.map(task => {
                              const status = getTaskStatus(task, day);
                              return (
                                <div
                                  key={task.id}
                                  draggable={!task.is_subtask && !task.id?.startsWith('subtask-')}
                                  onDragStart={(e) => {
                                    if (!task.is_subtask && !task.id?.startsWith('subtask-')) {
                                      handleDragStart(task, day, hour);
                                      e.dataTransfer.effectAllowed = 'move';
                                    } else {
                                      e.preventDefault();
                                    }
                                  }}
                                  onDragEnd={handleDragEnd}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // אם זו subtask, לא מאפשרים עריכה ישירה
                                    if (!task.is_subtask && !task.id?.startsWith('subtask-') && onEditTask) {
                                      onEditTask(task);
                                    }
                                  }}
                                  className={`p-1.5 rounded border text-xs transition-all relative group ${
                                    task.is_subtask || task.id?.startsWith('subtask-')
                                      ? 'cursor-default opacity-75' 
                                      : 'cursor-pointer hover:shadow-sm'
                                  } ${
                                    draggedTask?.task.id === task.id ? 'opacity-50' : ''
                                  } ${
                                    status === 'overdue' 
                                      ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' 
                                      : status === 'today'
                                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300'
                                      : status === 'urgent'
                                      ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300'
                                      : 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/10 text-gray-900 dark:text-white'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="font-medium truncate flex-1">{task.title}</div>
                                    <div className="flex items-center gap-1">
                                      {task.due_time && (
                                        <span className="text-[10px] opacity-75">{task.due_time}</span>
                                      )}
                                      {!task.is_subtask && !task.id?.startsWith('subtask-') && (
                                        <button
                                          onClick={(e) => handleDeleteTask(task.id, e)}
                                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-opacity"
                                          title="מחק משימה"
                                        >
                                          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* תצוגה חודשית */
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          {/* כותרות ימים */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {weekDaysShort.map(day => (
              <div
                key={day}
                className="text-center text-sm font-bold text-gray-600 dark:text-gray-400 py-2"
              >
                {day}
              </div>
            ))}
          </div>
          
          {/* לוח חודשי */}
          <div className="grid grid-cols-7 gap-2">
            {days.map(day => {
              const dayTasks = getTasksForDate(day);
              const isCurrentMonth = day.getMonth() === currentDate.getMonth();
              const isTodayDate = isToday(day);
              
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => {
                    setViewMode('day');
                    setCurrentDate(day);
                  }}
                  className={`aspect-square p-2 rounded-lg text-sm transition-all text-right border-2 ${
                    !isCurrentMonth 
                      ? 'text-gray-300 dark:text-gray-600 border-transparent' 
                      : isTodayDate
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold'
                      : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="font-medium mb-1">{format(day, 'd')}</div>
                  {dayTasks.length > 0 && (
                    <div className="space-y-1">
                      {dayTasks.slice(0, 3).map(task => {
                        const status = getTaskStatus(task, day);
                        return (
                          <div
                            key={task.id}
                            className={`h-1.5 rounded-full ${
                              status === 'overdue' 
                                ? 'bg-red-500' 
                                : status === 'today'
                                ? 'bg-orange-500'
                                : status === 'urgent'
                                ? 'bg-yellow-500'
                                : 'bg-blue-500'
                            }`}
                          />
                        );
                      })}
                      {dayTasks.length > 3 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          +{dayTasks.length - 3}
                        </div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default CalendarView;

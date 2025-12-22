import { useState, useMemo } from 'react';
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
  isPast,
  isFuture,
  differenceInDays
} from 'date-fns';
import { he } from 'date-fns/locale';
import TaskCard from '../Tasks/TaskCard';
import { isTaskOverdue, isTaskDueToday } from '../../utils/taskHelpers';

/**
 * תצוגת יומן - יומי, שבועי, חודשי
 */
function CalendarView() {
  const { tasks } = useTasks();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('month'); // 'day', 'week', 'month'
  
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
  
  // קבלת משימות לפי תאריך (כולל שלבים) - לפי תאריך התחלה ותאריך יעד
  const getTasksForDate = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const tasksForDate = [];
    
    tasks.forEach(task => {
      // משימות רגילות - מופיעות אם התאריך בין תאריך התחלה לתאריך יעד
      if (!task.parent_task_id) {
        const startDate = task.start_date || task.due_date; // אם אין start_date, נשתמש ב-due_date
        const dueDate = task.due_date;
        
        // אם יש תאריך יעד, המשימה מופיעה בתאריך זה או בתאריכים בין התחלה ליעד
        if (dueDate === dateStr) {
          tasksForDate.push(task);
        } else if (startDate && dueDate && startDate <= dateStr && dateStr <= dueDate) {
          // אם התאריך בין תאריך התחלה לתאריך יעד, מוסיפים את המשימה
          tasksForDate.push(task);
        }
      }
      
      // שלבים של פרויקטים
      if (task.subtasks && task.subtasks.length > 0) {
        task.subtasks.forEach(st => {
          const subtaskStartDate = st.start_date || st.due_date;
          const subtaskDueDate = st.due_date;
          
          if (subtaskDueDate === dateStr) {
            // יצירת משימה וירטואלית לשלב
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
          } else if (subtaskStartDate && subtaskDueDate && subtaskStartDate <= dateStr && dateStr <= subtaskDueDate) {
            // אם התאריך בין תאריך התחלה לתאריך יעד של השלב
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
  
  // ניווט לפי מצב תצוגה
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
  
  // פורמט כותרת לפי מצב תצוגה
  const getViewTitle = () => {
    if (viewMode === 'day') {
      return format(currentDate, 'dd MMMM yyyy', { locale: he });
    } else if (viewMode === 'week') {
      return `${format(viewStart, 'dd/MM')} - ${format(viewEnd, 'dd/MM/yyyy')}`;
    } else {
      return format(currentDate, 'MMMM yyyy', { locale: he });
    }
  };
  
  // בחירת תאריך
  const [selectedDate, setSelectedDate] = useState(new Date());
  const selectedTasks = getTasksForDate(selectedDate);
  
  // שמות ימים
  const weekDays = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
  
  return (
    <div className="space-y-4">
      {/* כותרת עם ניווט */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          {getViewTitle()}
        </h2>
        
        <div className="flex items-center gap-3">
          {/* בחירת מצב תצוגה */}
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                viewMode === 'day'
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 font-medium shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              יומי
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                viewMode === 'week'
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 font-medium shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              שבועי
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                viewMode === 'month'
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 font-medium shadow-sm'
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
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              title="קודם"
            >
              ←
            </button>
            <button
              onClick={goToToday}
              className="px-3 py-2 text-sm rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50"
            >
              היום
            </button>
            <button
              onClick={goToNext}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              title="הבא"
            >
              →
            </button>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* לוח שנה/שבוע/יום */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            {viewMode === 'day' ? (
              /* תצוגה יומית */
              <div className="space-y-4">
                <div className="text-center pb-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="text-5xl font-bold text-gray-900 dark:text-white mb-2">
                    {format(currentDate, 'd')}
                  </div>
                  <div className="text-lg text-gray-600 dark:text-gray-400">
                    {format(currentDate, 'EEEE, MMMM yyyy', { locale: he })}
                  </div>
                </div>
                
                {/* משימות היום */}
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {getTasksForDate(currentDate).length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <span className="text-3xl block mb-2">📅</span>
                      <p>אין משימות היום</p>
                    </div>
                  ) : (
                    getTasksForDate(currentDate)
                      .sort((a, b) => {
                        // מיון: באיחור ראשון, אחר כך לפי זמן
                        const aStatus = getTaskStatus(a, currentDate);
                        const bStatus = getTaskStatus(b, currentDate);
                        if (aStatus === 'overdue' && bStatus !== 'overdue') return -1;
                        if (bStatus === 'overdue' && aStatus !== 'overdue') return 1;
                        return (a.due_time || '').localeCompare(b.due_time || '');
                      })
                      .map(task => {
                        const status = getTaskStatus(task, currentDate);
                        return (
                          <div
                            key={task.id}
                            className={`
                              p-3 rounded-lg border-2 transition-all
                              ${status === 'overdue' 
                                ? 'border-red-500 bg-red-50 dark:bg-red-900/20' 
                                : status === 'today'
                                ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                                : status === 'urgent'
                                ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                              }
                            `}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                                  {task.title}
                                </h4>
                                {task.due_time && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    🕐 {task.due_time}
                                  </p>
                                )}
                              </div>
                              {status === 'overdue' && (
                                <span className="px-2 py-1 text-xs bg-red-500 text-white rounded">
                                  באיחור
                                </span>
                              )}
                              {status === 'today' && (
                                <span className="px-2 py-1 text-xs bg-orange-500 text-white rounded">
                                  היום
                                </span>
                              )}
                            </div>
                            
                            {/* התקדמות אם יש */}
                            {task.progress !== undefined && task.progress > 0 && (
                              <div className="mt-2">
                                <div className="flex items-center justify-between text-xs mb-1">
                                  <span className="text-gray-600 dark:text-gray-400">התקדמות</span>
                                  <span className="font-medium text-blue-600 dark:text-blue-400">
                                    {task.progress}%
                                  </span>
                                </div>
                                <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-blue-500 transition-all duration-300"
                                    style={{ width: `${task.progress}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                  )}
                </div>
              </div>
            ) : viewMode === 'week' ? (
              /* תצוגה שבועית */
              <div className="space-y-2">
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {weekDays.map(day => (
                    <div
                      key={day}
                      className="text-center text-sm font-medium text-gray-600 dark:text-gray-400 py-2"
                    >
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {days.map(day => {
                    const dayTasks = getTasksForDate(day);
                    const isSelected = isSameDay(day, selectedDate);
                    const isTodayDate = isToday(day);
                    const overdueTasks = dayTasks.filter(t => getTaskStatus(t, day) === 'overdue');
                    const urgentTasks = dayTasks.filter(t => getTaskStatus(t, day) === 'urgent' || getTaskStatus(t, day) === 'today');
                    
                    return (
                      <div
                        key={day.toISOString()}
                        className={`
                          min-h-[120px] p-2 rounded-lg text-sm transition-all border-2
                          ${isSelected 
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                            : isTodayDate
                            ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/10'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                          }
                        `}
                      >
                        <button
                          onClick={() => setSelectedDate(day)}
                          className={`w-full text-right mb-2 ${
                            isSelected ? 'text-blue-700 dark:text-blue-300' : 
                            isTodayDate ? 'text-blue-600 dark:text-blue-400 font-bold' : 
                            'text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          <div className="text-sm font-medium">
                            {format(day, 'd')}
                          </div>
                        </button>
                        
                        {/* משימות היום */}
                        <div className="space-y-1 max-h-[90px] overflow-y-auto">
                          {dayTasks.slice(0, 3).map(task => {
                            const status = getTaskStatus(task, day);
                            return (
                              <div
                                key={task.id}
                                className={`
                                  text-xs p-1.5 rounded border
                                  ${status === 'overdue' 
                                    ? 'border-red-500 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' 
                                    : status === 'today' || status === 'urgent'
                                    ? 'border-orange-500 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                                    : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300'
                                  }
                                `}
                                title={task.title}
                              >
                                <div className="truncate font-medium">{task.title}</div>
                                {task.progress !== undefined && task.progress > 0 && (
                                  <div className="mt-1 flex items-center gap-1">
                                    <div className="flex-1 h-1 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-blue-500"
                                        style={{ width: `${task.progress}%` }}
                                      />
                                    </div>
                                    <span className="text-[10px]">{task.progress}%</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {dayTasks.length > 3 && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-1">
                              +{dayTasks.length - 3} עוד
                            </div>
                          )}
                        </div>
                        
                        {/* אינדיקטורים */}
                        {(overdueTasks.length > 0 || urgentTasks.length > 0) && (
                          <div className="flex gap-1 mt-1">
                            {overdueTasks.length > 0 && (
                              <span className="text-[10px] px-1 py-0.5 bg-red-500 text-white rounded">
                                {overdueTasks.length} באיחור
                              </span>
                            )}
                            {urgentTasks.length > 0 && (
                              <span className="text-[10px] px-1 py-0.5 bg-orange-500 text-white rounded">
                                {urgentTasks.length} דחוף
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* תצוגה חודשית */
              <>
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {weekDays.map(day => (
                    <div
                      key={day}
                      className="text-center text-sm font-medium text-gray-600 dark:text-gray-400 py-2"
                    >
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {days.map(day => {
                    const dayTasks = getTasksForDate(day);
                    const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                    const isSelected = isSameDay(day, selectedDate);
                    const isTodayDate = isToday(day);
                    
                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() => setSelectedDate(day)}
                        className={`
                          aspect-square p-1 rounded-lg text-sm transition-all
                          ${!isCurrentMonth ? 'text-gray-300 dark:text-gray-600' : ''}
                          ${isSelected 
                            ? 'bg-blue-500 text-white font-bold' 
                            : isTodayDate
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                          }
                        `}
                      >
                        <div className="text-xs">{format(day, 'd')}</div>
                        {dayTasks.length > 0 && (
                          <div className="text-xs mt-1">
                            <span className={`
                              inline-block w-2 h-2 rounded-full
                              ${isSelected ? 'bg-white' : 'bg-blue-500'}
                            `} />
                            <span className="mr-1">{dayTasks.length}</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
        
        {/* משימות מפורטות של התאריך הנבחר */}
        {viewMode !== 'day' && (
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                {format(selectedDate, 'dd/MM/yyyy', { locale: he })}
                {isToday(selectedDate) && (
                  <span className="mr-2 text-sm text-blue-600 dark:text-blue-400">(היום)</span>
                )}
              </h3>
              
              {selectedTasks.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                  אין משימות בתאריך זה
                </p>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {selectedTasks
                    .sort((a, b) => {
                      const aStatus = getTaskStatus(a, selectedDate);
                      const bStatus = getTaskStatus(b, selectedDate);
                      if (aStatus === 'overdue' && bStatus !== 'overdue') return -1;
                      if (bStatus === 'overdue' && aStatus !== 'overdue') return 1;
                      return (a.due_time || '').localeCompare(b.due_time || '');
                    })
                    .map(task => {
                      const status = getTaskStatus(task, selectedDate);
                      return (
                        <div
                          key={task.id}
                          className={`
                            p-3 rounded-lg border-2 transition-all
                            ${status === 'overdue' 
                              ? 'border-red-500 bg-red-50 dark:bg-red-900/20' 
                              : status === 'today'
                              ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                              : status === 'urgent'
                              ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                              : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30'
                            }
                          `}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                                {task.title}
                              </h4>
                              {task.due_time && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  🕐 {task.due_time}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              {status === 'overdue' && (
                                <span className="px-2 py-0.5 text-xs bg-red-500 text-white rounded">
                                  באיחור
                                </span>
                              )}
                              {status === 'today' && (
                                <span className="px-2 py-0.5 text-xs bg-orange-500 text-white rounded">
                                  היום
                                </span>
                              )}
                              {status === 'urgent' && (
                                <span className="px-2 py-0.5 text-xs bg-yellow-500 text-white rounded">
                                  דחוף
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {/* התקדמות */}
                          {task.progress !== undefined && (
                            <div className="mt-2">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-gray-600 dark:text-gray-400">התקדמות</span>
                                <span className="font-medium text-blue-600 dark:text-blue-400">
                                  {task.progress}%
                                </span>
                              </div>
                              <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-500 transition-all duration-300"
                                  style={{ width: `${task.progress}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CalendarView;


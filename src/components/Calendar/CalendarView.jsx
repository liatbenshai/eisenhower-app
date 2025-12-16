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
  startOfDay as startDay,
  endOfDay as endDay
} from 'date-fns';
import TaskCard from '../Tasks/TaskCard';

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
  
  // קבלת משימות לפי תאריך
  const getTasksForDate = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return tasks.filter(task => {
      if (task.due_date === dateStr) return true;
      // בדיקת שלבים
      if (task.subtasks && task.subtasks.length > 0) {
        return task.subtasks.some(st => st.due_date === dateStr);
      }
      return false;
    });
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
      return format(currentDate, 'dd MMMM yyyy');
    } else if (viewMode === 'week') {
      return `${format(viewStart, 'dd/MM')} - ${format(viewEnd, 'dd/MM/yyyy')}`;
    } else {
      return format(currentDate, 'MMMM yyyy');
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
              <div className="text-center py-8">
                <div className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                  {format(currentDate, 'd')}
                </div>
                <div className="text-lg text-gray-600 dark:text-gray-400 mb-4">
                  {format(currentDate, 'EEEE, MMMM yyyy')}
                </div>
                <div className="flex justify-center gap-2">
                  {getTasksForDate(currentDate).length > 0 && (
                    <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm">
                      {getTasksForDate(currentDate).length} משימות
                    </span>
                  )}
                </div>
              </div>
            ) : viewMode === 'week' ? (
              /* תצוגה שבועית */
              <div>
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
                    const isSelected = isSameDay(day, selectedDate);
                    const isTodayDate = isToday(day);
                    
                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() => setSelectedDate(day)}
                        className={`
                          min-h-[80px] p-2 rounded-lg text-sm transition-all border-2
                          ${isSelected 
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                            : isTodayDate
                            ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/10'
                            : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                          }
                        `}
                      >
                        <div className={`text-xs font-medium mb-1 ${
                          isSelected ? 'text-blue-700 dark:text-blue-300' : 
                          isTodayDate ? 'text-blue-600 dark:text-blue-400' : 
                          'text-gray-600 dark:text-gray-400'
                        }`}>
                          {format(day, 'd')}
                        </div>
                        {dayTasks.length > 0 && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {dayTasks.length} משימות
                          </div>
                        )}
                      </button>
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
        
        {/* משימות של התאריך/תאריכים הנבחרים */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            {viewMode === 'day' ? (
              <>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                  {format(selectedDate, 'dd/MM/yyyy')}
                </h3>
                {selectedTasks.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                    אין משימות בתאריך זה
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {selectedTasks.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        quadrantId={task.quadrant}
                        onEdit={() => {}}
                        onDragStart={() => {}}
                        onDragEnd={() => {}}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : viewMode === 'week' ? (
              <>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                  משימות השבוע
                </h3>
                <div className="space-y-4 max-h-[500px] overflow-y-auto">
                  {days.map(day => {
                    const dayTasks = getTasksForDate(day);
                    if (dayTasks.length === 0) return null;
                    
                    return (
                      <div key={day.toISOString()} className="border-b border-gray-200 dark:border-gray-700 last:border-0 pb-3 last:pb-0">
                        <h4 className={`text-sm font-medium mb-2 ${
                          isToday(day) 
                            ? 'text-blue-600 dark:text-blue-400' 
                            : 'text-gray-600 dark:text-gray-400'
                        }`}>
                          {format(day, 'dd/MM/yyyy')} {isToday(day) && '(היום)'}
                        </h4>
                        <div className="space-y-2">
                          {dayTasks.map(task => (
                            <TaskCard
                              key={task.id}
                              task={task}
                              quadrantId={task.quadrant}
                              onEdit={() => {}}
                              onDragStart={() => {}}
                              onDragEnd={() => {}}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {days.every(day => getTasksForDate(day).length === 0) && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                      אין משימות השבוע
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                  {format(selectedDate, 'dd/MM/yyyy')}
                </h3>
                {selectedTasks.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                    אין משימות בתאריך זה
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {selectedTasks.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        quadrantId={task.quadrant}
                        onEdit={() => {}}
                        onDragStart={() => {}}
                        onDragEnd={() => {}}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CalendarView;


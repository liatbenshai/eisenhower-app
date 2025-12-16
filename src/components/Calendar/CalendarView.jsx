import { useState, useMemo } from 'react';
import { useTasks } from '../../hooks/useTasks';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, startOfWeek, endOfWeek } from 'date-fns';
import TaskCard from '../Tasks/TaskCard';

/**
 * תצוגת יומן
 */
function CalendarView() {
  const { tasks } = useTasks();
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // חישוב ימי החודש
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  
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
  
  // מעבר לחודש הבא/קודם
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };
  
  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };
  
  const goToToday = () => {
    setCurrentDate(new Date());
  };
  
  // בחירת תאריך
  const [selectedDate, setSelectedDate] = useState(new Date());
  const selectedTasks = getTasksForDate(selectedDate);
  
  // שמות ימים
  const weekDays = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
  
  return (
    <div className="space-y-4">
      {/* כותרת עם ניווט */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          {format(currentDate, 'MMMM yyyy')}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={goToPreviousMonth}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
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
            onClick={goToNextMonth}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            →
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* לוח שנה */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            {/* שמות ימים */}
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
            
            {/* ימי החודש */}
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
          </div>
        </div>
        
        {/* משימות של התאריך הנבחר */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
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
          </div>
        </div>
      </div>
    </div>
  );
}

export default CalendarView;


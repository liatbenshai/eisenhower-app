import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../hooks/useAuth';
import SimpleTaskForm from './SimpleTaskForm';
import DailyTaskCard from './DailyTaskCard';
import WeeklyCalendarView from './WeeklyCalendarView';
import DiaryView from './DiaryView';
import Modal from '../UI/Modal';
import Button from '../UI/Button';

/**
 * סוגי משימות מוגדרים - כולם לפי זמן
 */
export const TASK_TYPES = {
  transcription: { 
    id: 'transcription', 
    name: 'תמלול', 
    icon: '🎙️',
    defaultDuration: 60,
    category: 'work'
  },
  proofreading: { 
    id: 'proofreading', 
    name: 'הגהה', 
    icon: '📝',
    defaultDuration: 45,
    category: 'work'
  },
  email: { 
    id: 'email', 
    name: 'מיילים', 
    icon: '📧',
    defaultDuration: 25,
    category: 'work'
  },
  course: { 
    id: 'course', 
    name: 'קורס התמלול', 
    icon: '📚',
    defaultDuration: 90,
    category: 'venture'
  },
  client_communication: { 
    id: 'client_communication', 
    name: 'לקוחות', 
    icon: '💬',
    defaultDuration: 30,
    category: 'work'
  },
  management: { 
    id: 'management', 
    name: 'ניהול', 
    icon: '👔',
    defaultDuration: 45,
    category: 'work'
  },
  family: { 
    id: 'family', 
    name: 'משפחה', 
    icon: '👨‍👩‍👧‍👦',
    defaultDuration: 60,
    category: 'family'
  },
  kids: { 
    id: 'kids', 
    name: 'ילדים', 
    icon: '🧒',
    defaultDuration: 30,
    category: 'family'
  },
  personal: { 
    id: 'personal', 
    name: 'זמן אישי', 
    icon: '🧘',
    defaultDuration: 30,
    category: 'personal'
  },
  unexpected: { 
    id: 'unexpected', 
    name: 'בלת"מים', 
    icon: '⚡',
    defaultDuration: 30,
    category: 'work'
  },
  other: { 
    id: 'other', 
    name: 'אחר', 
    icon: '📋',
    defaultDuration: 30,
    category: 'work'
  }
};

/**
 * שעות עבודה קבועות
 */
const WORK_HOURS = {
  start: 8, // 08:00
  end: 16,  // 16:00
  totalMinutes: 8 * 60 // 480 דקות
};

/**
 * המרה לתאריך עברי
 */
function getHebrewDate(date) {
  try {
    const formatter = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    return formatter.format(date);
  } catch (e) {
    return '';
  }
}

/**
 * קבלת התאריך בפורמט ישראלי
 */
function getDateHebrew(date) {
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const months = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 
                  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  const dayName = days[date.getDay()];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return {
    full: `יום ${dayName}, ${day} ב${month} ${year}`,
    short: `${day}/${date.getMonth() + 1}`,
    dayName
  };
}

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
 * תצוגת יום עבודה - מסך ראשי חדש
 */
function DailyView() {
  const { user } = useAuth();
  const { tasks, loading, error, loadTasks } = useTasks();
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('day'); // 'day' or 'week'

  // ניווט בין ימים
  const goToPreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  };

  const goToNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  // קבלת ימי השבוע הנוכחי
  const getWeekDays = () => {
    const days = [];
    const startOfWeek = new Date(selectedDate);
    const dayOfWeek = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek); // חזרה ליום ראשון
    
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(day.getDate() + i);
      days.push(day);
    }
    return days;
  };

  // משימות לתאריך מסוים
  const getTasksForDate = (date) => {
    const dateISO = getDateISO(date);
    const dateObj = new Date(dateISO);
    
    return tasks.filter(task => {
      // משימה רגילה - לפי due_date
      if (task.due_date === dateISO && !task.start_date) return true;
      if (task.start_date === dateISO && !task.due_date) return true;
      
      // משימה ארוכה - בין start_date ל-due_date
      if (task.start_date && task.due_date && task.start_date !== task.due_date) {
        const startDate = new Date(task.start_date);
        const dueDate = new Date(task.due_date);
        // אם התאריך הנבחר בין תאריך ההתחלה לדדליין (כולל)
        if (dateObj >= startDate && dateObj <= dueDate) {
          return true;
        }
      }
      
      // משימה פשוטה עם start_date = due_date
      if (task.start_date === dateISO || task.due_date === dateISO) return true;
      
      // משימות בלי תאריך מופיעות רק ביום הנוכחי
      if (!task.due_date && !task.start_date && !task.is_completed && isToday(date)) return true;
      return false;
    }).sort((a, b) => {
      // דחופים קודם
      const priorityOrder = { urgent: 0, high: 1, normal: 2 };
      const aPriority = priorityOrder[a.priority] ?? 2;
      const bPriority = priorityOrder[b.priority] ?? 2;
      if (aPriority !== bPriority) return aPriority - bPriority;
      
      if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
      if (a.due_time && b.due_time) return a.due_time.localeCompare(b.due_time);
      if (a.due_time) return -1;
      if (b.due_time) return 1;
      return 0;
    });
  };

  // משימות לתאריך הנבחר
  const selectedDateTasks = useMemo(() => {
    return getTasksForDate(selectedDate);
  }, [tasks, selectedDate]);

  // חישוב זמנים
  const timeStats = useMemo(() => {
    const completedMinutes = selectedDateTasks
      .filter(t => t.is_completed)
      .reduce((sum, t) => sum + (t.time_spent || 0), 0);
    
    const plannedMinutes = selectedDateTasks
      .filter(t => !t.is_completed)
      .reduce((sum, t) => sum + (t.estimated_duration || 0), 0);
    
    const inProgressMinutes = selectedDateTasks
      .filter(t => !t.is_completed && t.time_spent > 0)
      .reduce((sum, t) => sum + (t.time_spent || 0), 0);
    
    const remainingWorkMinutes = WORK_HOURS.totalMinutes - completedMinutes - inProgressMinutes;
    
    return {
      completed: completedMinutes,
      planned: plannedMinutes,
      inProgress: inProgressMinutes,
      remaining: Math.max(0, remainingWorkMinutes),
      total: WORK_HOURS.totalMinutes,
      usedPercent: Math.round(((completedMinutes + inProgressMinutes) / WORK_HOURS.totalMinutes) * 100),
      canFitAll: plannedMinutes <= remainingWorkMinutes
    };
  }, [selectedDateTasks]);

  // פתיחת טופס הוספה
  const handleAddTask = () => {
    setEditingTask(null);
    setShowTaskForm(true);
  };

  // פתיחת טופס עריכה
  const handleEditTask = (task) => {
    setEditingTask(task);
    setShowTaskForm(true);
  };

  // סגירת טופס
  const handleCloseForm = () => {
    setShowTaskForm(false);
    setEditingTask(null);
  };

  // פורמט דקות לשעות:דקות
  const formatMinutes = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} דקות`;
    if (mins === 0) return `${hours} שעות`;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  };

  // מסך טעינה
  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">טוען משימות...</p>
        </div>
      </div>
    );
  }

  // שגיאה
  if (error) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="card p-8 text-center max-w-md">
          <span className="text-4xl mb-4 block">⚠️</span>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">שגיאה</h2>
          <p className="text-gray-600 dark:text-gray-400">{error}</p>
          <Button onClick={loadTasks} className="mt-4">נסה שוב</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      {/* כותרת עם ניווט */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        {/* בחירת תצוגה */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('day')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'day' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              📋 רשימה
            </button>
            <button
              onClick={() => setViewMode('diary')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'diary' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              📅 יומן שעות
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'week' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              📆 שבוע
            </button>
          </div>
          
          {!isToday(selectedDate) && (
            <button
              onClick={goToToday}
              className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              חזרה להיום
            </button>
          )}
        </div>

        {/* ניווט בין ימים */}
        <div className="flex items-center justify-between">
          <button
            onClick={goToPreviousDay}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-2xl"
          >
            ◄
          </button>
          
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {getDateHebrew(selectedDate).full}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {getHebrewDate(selectedDate)}
            </p>
            {isToday(selectedDate) && (
              <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full">
                היום
              </span>
            )}
          </div>
          
          <button
            onClick={goToNextDay}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-2xl"
          >
            ►
          </button>
        </div>
        
        <p className="text-center text-gray-500 dark:text-gray-400 mt-2 text-sm">
          שעות עבודה: {WORK_HOURS.start}:00 - {WORK_HOURS.end}:00
        </p>
      </motion.div>

      {/* תצוגה שבועית - כיומן */}
      {viewMode === 'week' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card p-4 mb-6"
        >
          <WeeklyCalendarView
            tasks={tasks}
            selectedDate={selectedDate}
            onSelectDate={(day) => {
              setSelectedDate(day);
              setViewMode('day');
            }}
            onEditTask={handleEditTask}
          />
        </motion.div>
      )}

      {/* תצוגת יומן שעות - עם גרירה */}
      {viewMode === 'diary' && (
        <DiaryView
          date={selectedDate}
          tasks={selectedDateTasks}
          onEditTask={handleEditTask}
          onAddTask={handleAddTask}
          onUpdate={loadTasks}
        />
      )}

      {/* סרגל זמן - רק בתצוגה יומית */}
      {viewMode === 'day' && (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card p-4 mb-6"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⏱️</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {isToday(selectedDate) ? 'נשאר היום' : 'זמן מתוכנן'}: {formatMinutes(timeStats.remaining)}
            </span>
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {timeStats.usedPercent}% נוצל
          </span>
        </div>
        
        {/* סרגל התקדמות */}
        <div className="w-full h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full flex">
            {/* הושלם */}
            <div 
              className="bg-green-500 transition-all duration-500"
              style={{ width: `${(timeStats.completed / timeStats.total) * 100}%` }}
              title={`הושלם: ${formatMinutes(timeStats.completed)}`}
            />
            {/* בעבודה */}
            <div 
              className="bg-blue-500 transition-all duration-500"
              style={{ width: `${(timeStats.inProgress / timeStats.total) * 100}%` }}
              title={`בעבודה: ${formatMinutes(timeStats.inProgress)}`}
            />
          </div>
        </div>
        
        {/* מקרא */}
        <div className="flex items-center gap-4 mt-2 text-xs text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span>הושלם ({formatMinutes(timeStats.completed)})</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span>בעבודה ({formatMinutes(timeStats.inProgress)})</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-gray-300 dark:bg-gray-600 rounded"></div>
            <span>פנוי ({formatMinutes(timeStats.remaining)})</span>
          </div>
        </div>

        {/* אזהרה אם לא יספיק */}
        {!timeStats.canFitAll && timeStats.planned > 0 && (
          <div className="mt-3 p-2 bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 rounded-lg text-sm">
            ⚠️ המשימות המתוכננות ({formatMinutes(timeStats.planned)}) לא יכנסו לזמן שנשאר ({formatMinutes(timeStats.remaining)})
          </div>
        )}
      </motion.div>
      )}

      {/* כפתור הוספת משימה */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mb-4"
      >
        <Button onClick={handleAddTask} className="w-full py-3 text-lg">
          + משימה חדשה
        </Button>
      </motion.div>

      {/* רשימת משימות - רק בתצוגה יומית */}
      {viewMode === 'day' && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="space-y-3"
      >
        {selectedDateTasks.length === 0 ? (
          <div className="card p-8 text-center">
            <span className="text-4xl mb-4 block">📝</span>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              אין משימות ל{isToday(selectedDate) ? 'היום' : 'תאריך זה'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              הוסיפי משימה חדשה להתחיל
            </p>
          </div>
        ) : (
          <>
            {/* משימות פעילות */}
            {selectedDateTasks.filter(t => !t.is_completed).map(task => (
              <DailyTaskCard 
                key={task.id} 
                task={task} 
                onEdit={() => handleEditTask(task)}
                onUpdate={loadTasks}
              />
            ))}
            
            {/* משימות שהושלמו */}
            {selectedDateTasks.filter(t => t.is_completed).length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  ✅ הושלמו ({selectedDateTasks.filter(t => t.is_completed).length})
                </h3>
                <div className="space-y-2 opacity-60">
                  {selectedDateTasks.filter(t => t.is_completed).map(task => (
                    <DailyTaskCard 
                      key={task.id} 
                      task={task} 
                      onEdit={() => handleEditTask(task)}
                      onUpdate={loadTasks}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>
      )}

      {/* מודל טופס */}
      <Modal
        isOpen={showTaskForm}
        onClose={handleCloseForm}
        title={editingTask ? 'עריכת משימה' : 'משימה חדשה'}
      >
        <SimpleTaskForm
          task={editingTask}
          onClose={handleCloseForm}
          taskTypes={TASK_TYPES}
          defaultDate={getDateISO(selectedDate)}
        />
      </Modal>
    </div>
  );
}

export default DailyView;

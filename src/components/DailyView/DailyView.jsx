import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../hooks/useAuth';
import SimpleTaskForm from './SimpleTaskForm';
import RecurringTaskForm from './RecurringTaskForm';
import LongTaskForm from '../Tasks/LongTaskForm';
import DiaryView from './DiaryView';
import WeeklyCalendarView from './WeeklyCalendarView';
import TimeAnalyticsDashboard from '../Analytics/TimeAnalyticsDashboard';
import SmartScheduler from '../Scheduler/SmartScheduler';
import UnfinishedTasksHandler from '../Scheduler/UnfinishedTasksHandler';
import SmartWorkIntake from '../Scheduler/SmartWorkIntake';
import AlertsManager from '../Notifications/AlertsManager';
import { getTodayIdleStats, formatIdleTime } from '../../utils/idleTimeTracker';
import Modal from '../UI/Modal';
import Button from '../UI/Button';

// ייבוא סוגי משימות מקובץ מרכזי
import { TASK_TYPES } from '../../config/taskTypes';
export { TASK_TYPES }; // ייצוא לתאימות לאחור

const WORK_HOURS = {
  start: 8,
  end: 16,
  totalMinutes: 8 * 60
};

/**
 * פורמט תאריך עברי
 */
function getHebrewDate(date) {
  try {
    return new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(date);
  } catch {
    return '';
  }
}

/**
 * פורמט תאריך
 */
function getDateHebrew(date) {
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const months = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 
                  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  return {
    full: `יום ${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`,
    short: `${date.getDate()}/${date.getMonth() + 1}`,
    dayName: days[date.getDay()]
  };
}

function getDateISO(date) {
  return date.toISOString().split('T')[0];
}

function isToday(date) {
  return date.toDateString() === new Date().toDateString();
}

/**
 * פורמט דקות
 */
function formatMinutes(minutes) {
  if (!minutes) return '0 דקות';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} דקות`;
  if (mins === 0) return `${hours} שעות`;
  return `${hours}:${mins.toString().padStart(2, '0')}`;
}

/**
 * תצוגת יום עבודה - עיצוב חדש
 */
function DailyView({ initialView = 'day' }) {
  const { user } = useAuth();
  const { tasks, loading, error, loadTasks, editTask } = useTasks();
  
  // State
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [showRecurringForm, setShowRecurringForm] = useState(false);
  const [showWorkIntake, setShowWorkIntake] = useState(false);
  const [showLongTaskForm, setShowLongTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState(initialView);
  const [idleStats, setIdleStats] = useState({ totalMinutes: 0, isCurrentlyIdle: false });
  const [defaultTaskTime, setDefaultTaskTime] = useState(null);

  // עדכון סטטיסטיקות זמן מת
  useEffect(() => {
    const updateIdleStats = () => setIdleStats(getTodayIdleStats());
    updateIdleStats();
    const interval = setInterval(updateIdleStats, 30000);
    return () => clearInterval(interval);
  }, []);

  // ניווט
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

  const goToToday = () => setSelectedDate(new Date());

  // משימות ליום הנבחר
  const selectedDateTasks = useMemo(() => {
    const dateISO = getDateISO(selectedDate);
    return tasks.filter(task => {
      if (task.due_date === dateISO) return true;
      if (task.start_date === dateISO) return true;
      if (!task.due_date && !task.is_completed && isToday(selectedDate)) return true;
      return false;
    }).sort((a, b) => {
      if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
      if (a.due_time && b.due_time) return a.due_time.localeCompare(b.due_time);
      if (a.due_time) return -1;
      if (b.due_time) return 1;
      return 0;
    });
  }, [tasks, selectedDate]);

  // סטטיסטיקות זמן
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

  // פתיחת טפסים
  const handleAddTask = (hour = null) => {
    setEditingTask(null);
    setDefaultTaskTime(hour !== null ? `${hour.toString().padStart(2, '0')}:00` : null);
    setShowTaskForm(true);
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
    setShowTaskForm(true);
  };

  const handleCloseForm = () => {
    setShowTaskForm(false);
    setEditingTask(null);
  };

  const handleUpdateTaskDateTime = async (taskId, { dueDate, dueTime }) => {
    try {
      await editTask(taskId, { dueDate, dueTime });
      await loadTasks();
    } catch (err) {
      console.error('שגיאה:', err);
      throw err;
    }
  };

  // טעינה
  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto" />
          <p className="mt-4 text-gray-500">טוען...</p>
        </div>
      </div>
    );
  }

  // שגיאה
  if (error) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center max-w-md shadow-xl">
          <span className="text-5xl mb-4 block">⚠️</span>
          <h2 className="text-xl font-bold mb-2">שגיאה</h2>
          <p className="text-gray-500 mb-4">{error}</p>
          <Button onClick={loadTasks}>נסה שוב</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      {/* כותרת ראשית */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        {/* טאבים */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
            {[
              { id: 'day', label: '📅 יום', icon: '📅' },
              { id: 'week', label: '📆 שבוע', icon: '📆' },
              { id: 'analytics', label: '📊 דוחות', icon: '📊' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setViewMode(tab.id)}
                className={`
                  px-4 py-2 rounded-lg text-sm font-medium transition-all
                  ${viewMode === tab.id 
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' 
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }
                `}
              >
                {tab.label}
              </button>
            ))}
          </div>
          
          {!isToday(selectedDate) && viewMode !== 'analytics' && (
            <button
              onClick={goToToday}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              היום
            </button>
          )}
        </div>

        {/* כותרת תאריך - רק בתצוגת יום */}
        {viewMode === 'day' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <button
                onClick={goToPreviousDay}
                className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors text-xl"
              >
                ◀
              </button>
              
              <div className="text-center">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {getDateHebrew(selectedDate).full}
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  {getHebrewDate(selectedDate)}
                </p>
                {isToday(selectedDate) && (
                  <span className="inline-block mt-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-medium rounded-full">
                    ✨ היום
                  </span>
                )}
              </div>
              
              <button
                onClick={goToNextDay}
                className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors text-xl"
              >
                ▶
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* סרגל זמן - רק בתצוגת יום */}
      {viewMode === 'day' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6 bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {isToday(selectedDate) ? 'נשאר היום' : 'זמן מתוכנן'}: {formatMinutes(timeStats.remaining)}
            </span>
            <span className="text-sm text-gray-500">
              {timeStats.usedPercent}% נוצל
            </span>
          </div>
          
          {/* פס התקדמות */}
          <div className="w-full h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full flex">
              <div 
                className="bg-green-500 transition-all duration-500"
                style={{ width: `${(timeStats.completed / timeStats.total) * 100}%` }}
              />
              <div 
                className="bg-blue-500 transition-all duration-500"
                style={{ width: `${(timeStats.inProgress / timeStats.total) * 100}%` }}
              />
            </div>
          </div>
          
          {/* מקרא */}
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-green-500 rounded-full" />
              <span>הושלם ({formatMinutes(timeStats.completed)})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-blue-500 rounded-full" />
              <span>בעבודה ({formatMinutes(timeStats.inProgress)})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-gray-300 dark:bg-gray-600 rounded-full" />
              <span>פנוי ({formatMinutes(timeStats.remaining)})</span>
            </div>
            {idleStats.totalMinutes > 0 && isToday(selectedDate) && (
              <div className={`flex items-center gap-1.5 ${idleStats.isCurrentlyIdle ? 'animate-pulse' : ''}`}>
                <div className="w-3 h-3 bg-red-400 rounded-full" />
                <span className="text-red-500">
                  ⏸️ זמן מת: {formatIdleTime(idleStats.totalMinutes)}
                </span>
              </div>
            )}
          </div>

          {/* אזהרה */}
          {!timeStats.canFitAll && timeStats.planned > 0 && (
            <div className="mt-3 p-3 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 rounded-xl text-sm">
              ⚠️ יש יותר עבודה מזמן פנוי!
            </div>
          )}
        </motion.div>
      )}

      {/* תצוגת אנליטיקס */}
      {viewMode === 'analytics' && <TimeAnalyticsDashboard />}

      {/* משימות לא גמורות */}
      {viewMode === 'day' && isToday(selectedDate) && (
        <UnfinishedTasksHandler onTasksMoved={loadTasks} />
      )}

      {/* התראות */}
      {viewMode === 'day' && <AlertsManager onTaskClick={handleEditTask} />}

      {/* תצוגה שבועית */}
      {viewMode === 'week' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <WeeklyCalendarView
            tasks={tasks}
            selectedDate={selectedDate}
            onSelectDate={(day) => {
              setSelectedDate(day);
              setViewMode('day');
            }}
            onEditTask={handleEditTask}
            onUpdateTask={handleUpdateTaskDateTime}
          />
        </motion.div>
      )}

      {/* תצוגת יומן יומי */}
      {viewMode === 'day' && (
        <DiaryView
          date={selectedDate}
          tasks={tasks}
          onEditTask={handleEditTask}
          onAddTask={handleAddTask}
          onUpdate={loadTasks}
        />
      )}

      {/* פעולות מהירות - רק בתצוגת יום */}
      {viewMode === 'day' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700"
        >
          <p className="text-xs text-gray-400 mb-3 text-center">פעולות נוספות</p>
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              onClick={() => setShowScheduler(true)}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl text-sm flex items-center gap-2 transition-colors"
            >
              🗓️ שיבוץ אוטומטי
            </button>
            <button
              onClick={() => setShowWorkIntake(true)}
              className="px-4 py-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded-xl text-sm flex items-center gap-2 transition-colors"
            >
              📥 עבודה חדשה
            </button>
            <button
              onClick={() => setShowRecurringForm(true)}
              className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-xl text-sm flex items-center gap-2 transition-colors"
            >
              🔄 משימה חוזרת
            </button>
            <button
              onClick={() => setShowLongTaskForm(true)}
              className="px-4 py-2 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/40 rounded-xl text-sm flex items-center gap-2 transition-colors"
            >
              📋 משימה ארוכה
            </button>
          </div>
        </motion.div>
      )}

      {/* מודלים */}
      <Modal isOpen={showTaskForm} onClose={handleCloseForm} title={editingTask ? 'עריכת משימה' : 'משימה חדשה'}>
        <SimpleTaskForm
          task={editingTask}
          onClose={handleCloseForm}
          taskTypes={TASK_TYPES}
          defaultDate={getDateISO(selectedDate)}
          defaultTime={defaultTaskTime}
          existingTasks={tasks}
        />
      </Modal>

      <Modal isOpen={showScheduler} onClose={() => setShowScheduler(false)} title="🗓️ שיבוץ אוטומטי">
        <SmartScheduler
          selectedDate={selectedDate}
          onClose={() => setShowScheduler(false)}
          onScheduled={loadTasks}
        />
      </Modal>

      <Modal isOpen={showRecurringForm} onClose={() => setShowRecurringForm(false)} title="🔄 משימה חוזרת">
        <RecurringTaskForm
          onClose={() => setShowRecurringForm(false)}
          onCreated={loadTasks}
        />
      </Modal>

      <Modal isOpen={showWorkIntake} onClose={() => setShowWorkIntake(false)} title="📥 עבודה חדשה">
        <SmartWorkIntake
          onClose={() => setShowWorkIntake(false)}
          onCreated={loadTasks}
        />
      </Modal>

      <Modal isOpen={showLongTaskForm} onClose={() => setShowLongTaskForm(false)} title="📋 משימה ארוכה">
        <LongTaskForm onClose={() => setShowLongTaskForm(false)} />
      </Modal>
    </div>
  );
}

export default DailyView;

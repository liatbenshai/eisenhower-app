import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { planDay, planWeek, suggestTimeForTask, SCHEDULE_STATUS } from '../../utils/dayPlanner';
import { formatDuration, getAvailableMinutesForDay, BUFFER_PERCENTAGE } from '../../config/workSchedule';
import { TASK_TYPES } from '../../config/taskTypes';
import SimpleTaskForm from './SimpleTaskForm';
import TaskTimerWithInterruptions from '../Tasks/TaskTimerWithInterruptions';
import Modal from '../UI/Modal';
import Button from '../UI/Button';
import toast from 'react-hot-toast';

/**
 * תצוגת יום חכמה - עם תכנון אוטומטי
 */
function SmartDayPlanner() {
  const { tasks, loading, toggleComplete, loadTasks } = useTasks();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [viewMode, setViewMode] = useState('schedule'); // 'schedule' | 'timeline' | 'week'
  const [expandedTask, setExpandedTask] = useState(null);

  // תכנון היום
  const dayPlan = useMemo(() => {
    if (!tasks || tasks.length === 0) {
      return planDay(selectedDate, []);
    }
    return planDay(selectedDate, tasks);
  }, [tasks, selectedDate]);

  // תכנון השבוע
  const weekPlan = useMemo(() => {
    if (viewMode !== 'week') return null;
    const weekStart = new Date(selectedDate);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    return planWeek(weekStart, tasks || []);
  }, [tasks, selectedDate, viewMode]);

  // ניווט
  const goToDate = (offset) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + offset);
    setSelectedDate(newDate);
  };

  const goToToday = () => setSelectedDate(new Date());

  const isToday = selectedDate.toDateString() === new Date().toDateString();

  // פתיחת טופס משימה
  const handleAddTask = (hour = null) => {
    setEditingTask(null);
    setShowTaskForm(true);
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
    setShowTaskForm(true);
  };

  const handleCloseForm = () => {
    setShowTaskForm(false);
    setEditingTask(null);
    loadTasks();
  };

  // השלמת משימה
  const handleComplete = async (task) => {
    try {
      await toggleComplete(task.id);
      toast.success('✅ משימה הושלמה!');
    } catch (err) {
      toast.error('שגיאה בעדכון');
    }
  };

  // פורמט תאריך
  const formatDate = (date) => {
    const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    const months = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 
                    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
    return `יום ${days[date.getDay()]}, ${date.getDate()} ב${months[date.getMonth()]}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="smart-day-planner p-4 max-w-4xl mx-auto">
      {/* כותרת וניווט */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        {/* בחירת תצוגה */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('schedule')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'schedule' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              📋 תכנון יום
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'timeline' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              ⏰ ציר זמן
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
          
          {!isToday && (
            <button
              onClick={goToToday}
              className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200"
            >
              חזרה להיום
            </button>
          )}
        </div>

        {/* ניווט תאריכים */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => goToDate(-1)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-2xl"
          >
            ◄
          </button>
          
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatDate(selectedDate)}
            </h1>
            {isToday && (
              <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full">
                היום
              </span>
            )}
          </div>
          
          <button
            onClick={() => goToDate(1)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-2xl"
          >
            ►
          </button>
        </div>
      </motion.div>

      {/* כרטיס סטטוס יום */}
      {dayPlan.isWorkDay && viewMode !== 'week' && (
        <DayStatusCard dayPlan={dayPlan} />
      )}

      {/* אזהרות */}
      {dayPlan.warnings?.length > 0 && viewMode !== 'week' && (
        <WarningsPanel warnings={dayPlan.warnings} />
      )}

      {/* כפתור הוספה */}
      {viewMode !== 'week' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-4"
        >
          <Button onClick={() => handleAddTask()} className="w-full py-3 text-lg">
            + משימה חדשה
          </Button>
        </motion.div>
      )}

      {/* תצוגת תכנון */}
      {viewMode === 'schedule' && (
        <ScheduleView 
          dayPlan={dayPlan}
          onEditTask={handleEditTask}
          onComplete={handleComplete}
          expandedTask={expandedTask}
          setExpandedTask={setExpandedTask}
          onUpdate={loadTasks}
        />
      )}

      {/* תצוגת ציר זמן */}
      {viewMode === 'timeline' && (
        <TimelineView 
          dayPlan={dayPlan}
          onEditTask={handleEditTask}
          onComplete={handleComplete}
          onAddTask={handleAddTask}
        />
      )}

      {/* תצוגת שבוע */}
      {viewMode === 'week' && weekPlan && (
        <WeekView 
          weekPlan={weekPlan}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />
      )}

      {/* לא יום עבודה */}
      {!dayPlan.isWorkDay && viewMode !== 'week' && (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
          <span className="text-4xl mb-4 block">🌴</span>
          <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">
            {dayPlan.dayName || 'סוף שבוע'} - לא יום עבודה
          </h3>
          <p className="text-sm text-gray-500 mt-2">
            זמן לנוח! או שאפשר להוסיף משימות בכל זאת
          </p>
        </div>
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
          defaultDate={selectedDate.toISOString().split('T')[0]}
        />
      </Modal>
    </div>
  );
}

/**
 * כרטיס סטטוס יום
 */
function DayStatusCard({ dayPlan }) {
  const statusColors = {
    [SCHEDULE_STATUS.OK]: 'from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800',
    [SCHEDULE_STATUS.TIGHT]: 'from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border-yellow-200 dark:border-yellow-800',
    [SCHEDULE_STATUS.OVERLOAD]: 'from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border-red-200 dark:border-red-800',
    [SCHEDULE_STATUS.NO_TASKS]: 'from-gray-50 to-slate-50 dark:from-gray-900/20 dark:to-slate-900/20 border-gray-200 dark:border-gray-700'
  };

  const statusIcons = {
    [SCHEDULE_STATUS.OK]: '✅',
    [SCHEDULE_STATUS.TIGHT]: '⚠️',
    [SCHEDULE_STATUS.OVERLOAD]: '🔴',
    [SCHEDULE_STATUS.NO_TASKS]: '📭'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mb-6 p-4 rounded-xl border bg-gradient-to-l ${statusColors[dayPlan.status]}`}
    >
      {/* שורה ראשונה - סטטוס */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{statusIcons[dayPlan.status]}</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {dayPlan.message}
          </span>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {BUFFER_PERCENTAGE}% שמור לבלת"מים
        </div>
      </div>

      {/* סרגל התקדמות */}
      <div className="w-full h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
        <div className="h-full flex">
          {/* זמן מתוכנן */}
          <div 
            className={`transition-all duration-500 ${
              dayPlan.status === SCHEDULE_STATUS.OVERLOAD 
                ? 'bg-red-500' 
                : dayPlan.status === SCHEDULE_STATUS.TIGHT 
                  ? 'bg-yellow-500' 
                  : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(dayPlan.usagePercent || 0, 100)}%` }}
          />
          {/* מרווח בלת"מים */}
          <div 
            className="bg-gray-400 dark:bg-gray-500"
            style={{ width: `${BUFFER_PERCENTAGE}%` }}
          />
        </div>
      </div>

      {/* מקרא */}
      <div className="flex items-center gap-6 text-xs text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-500 rounded"></div>
          <span>מתוכנן: {formatDuration(dayPlan.scheduledMinutes || 0)}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-gray-400 rounded"></div>
          <span>מרווח: {formatDuration(dayPlan.bufferMinutes || 0)}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-white border border-gray-300 rounded"></div>
          <span>פנוי: {formatDuration(dayPlan.freeMinutes || 0)}</span>
        </div>
      </div>

      {/* משימות שלא נכנסות */}
      {dayPlan.unscheduledTasks?.length > 0 && (
        <div className="mt-3 p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
          <div className="text-sm font-medium text-red-700 dark:text-red-300">
            ⚠️ {dayPlan.unscheduledTasks.length} משימות לא נכנסות:
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {dayPlan.unscheduledTasks.map(task => (
              <span 
                key={task.id}
                className="px-2 py-0.5 bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 text-xs rounded"
              >
                {task.title}
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

/**
 * פאנל אזהרות
 */
function WarningsPanel({ warnings }) {
  const [isOpen, setIsOpen] = useState(false);
  
  const highSeverity = warnings.filter(w => w.severity === 'high');
  
  if (warnings.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg"
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
          <span>⚠️</span>
          <span className="font-medium">
            {highSeverity.length > 0 
              ? `${highSeverity.length} אזהרות חשובות`
              : `${warnings.length} הערות`
            }
          </span>
        </div>
        <span className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-1">
              {warnings.map((warning, idx) => (
                <div 
                  key={idx}
                  className={`text-sm p-2 rounded ${
                    warning.severity === 'high' 
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                      : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                  }`}
                >
                  {warning.message}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * תצוגת רשימת תכנון
 */
function ScheduleView({ dayPlan, onEditTask, onComplete, expandedTask, setExpandedTask, onUpdate }) {
  if (!dayPlan.tasks || dayPlan.tasks.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <span className="text-4xl mb-4 block">📝</span>
        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">
          אין משימות מתוכננות
        </h3>
        <p className="text-sm text-gray-500 mt-2">
          הוסיפי משימה חדשה להתחיל
        </p>
      </div>
    );
  }

  // חלוקה לפי עדיפות
  const urgentTasks = dayPlan.tasks.filter(t => t.priority === 'urgent' && !t.is_completed);
  const highTasks = dayPlan.tasks.filter(t => t.priority === 'high' && !t.is_completed);
  const normalTasks = dayPlan.tasks.filter(t => t.priority === 'normal' && !t.is_completed);
  const completedTasks = dayPlan.tasks.filter(t => t.is_completed);

  return (
    <div className="space-y-4">
      {/* משימות דחופות */}
      {urgentTasks.length > 0 && (
        <TaskGroup 
          title="🔴 דחוף - לעשות עכשיו!"
          tasks={urgentTasks}
          color="red"
          onEditTask={onEditTask}
          onComplete={onComplete}
          expandedTask={expandedTask}
          setExpandedTask={setExpandedTask}
          onUpdate={onUpdate}
        />
      )}

      {/* משימות בעדיפות גבוהה */}
      {highTasks.length > 0 && (
        <TaskGroup 
          title="🟠 עדיפות גבוהה"
          tasks={highTasks}
          color="orange"
          onEditTask={onEditTask}
          onComplete={onComplete}
          expandedTask={expandedTask}
          setExpandedTask={setExpandedTask}
          onUpdate={onUpdate}
        />
      )}

      {/* משימות רגילות */}
      {normalTasks.length > 0 && (
        <TaskGroup 
          title="🟢 משימות רגילות"
          tasks={normalTasks}
          color="green"
          onEditTask={onEditTask}
          onComplete={onComplete}
          expandedTask={expandedTask}
          setExpandedTask={setExpandedTask}
          onUpdate={onUpdate}
        />
      )}

      {/* הושלמו */}
      {completedTasks.length > 0 && (
        <div className="mt-6 opacity-60">
          <h3 className="text-sm font-medium text-gray-500 mb-2">
            ✅ הושלמו ({completedTasks.length})
          </h3>
          <div className="space-y-2">
            {completedTasks.map(task => (
              <CompletedTaskCard 
                key={task.id} 
                task={task}
                onEditTask={onEditTask}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * קבוצת משימות
 */
function TaskGroup({ title, tasks, color, onEditTask, onComplete, expandedTask, setExpandedTask, onUpdate }) {
  const colors = {
    red: 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10',
    orange: 'border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-900/10',
    green: 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10'
  };

  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <h3 className="font-medium text-gray-900 dark:text-white mb-3">{title}</h3>
      <div className="space-y-2">
        {tasks.map(task => (
          <TaskCard 
            key={task.id}
            task={task}
            onEdit={() => onEditTask(task)}
            onComplete={() => onComplete(task)}
            isExpanded={expandedTask === task.id}
            onToggleExpand={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
            onUpdate={onUpdate}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * כרטיס משימה
 */
function TaskCard({ task, onEdit, onComplete, isExpanded, onToggleExpand, onUpdate }) {
  const taskType = TASK_TYPES[task.task_type] || TASK_TYPES.other;

  return (
    <motion.div
      layout
      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
    >
      {/* שורה ראשית */}
      <div 
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
        onClick={onToggleExpand}
      >
        {/* כפתור השלמה */}
        <button
          onClick={(e) => { e.stopPropagation(); onComplete(); }}
          className="w-6 h-6 rounded-full border-2 border-gray-300 dark:border-gray-600 
                     hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/30
                     flex items-center justify-center transition-colors"
        >
          <span className="text-green-500 opacity-0 hover:opacity-100">✓</span>
        </button>

        {/* אייקון סוג */}
        <span 
          className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
          style={{ backgroundColor: taskType.bgColor || '#e5e7eb' }}
        >
          {taskType.icon}
        </span>

        {/* פרטים */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900 dark:text-white truncate">
            {task.title}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>{formatDuration(task.estimated_duration || 30)}</span>
            {task.due_time && <span>• {task.due_time}</span>}
            {task.time_spent > 0 && (
              <span className="text-blue-500">• {formatDuration(task.time_spent)} בוצע</span>
            )}
          </div>
        </div>

        {/* חץ */}
        <span className={`transform transition-transform text-gray-400 ${isExpanded ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </div>

      {/* תוכן מורחב */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden border-t border-gray-100 dark:border-gray-700"
          >
            <div className="p-3 space-y-3">
              {/* טיימר */}
              <TaskTimerWithInterruptions 
                task={task}
                onUpdate={onUpdate}
              />
              
              {/* כפתורי פעולה */}
              <div className="flex gap-2">
                <button
                  onClick={onEdit}
                  className="flex-1 py-2 px-3 text-sm bg-gray-100 dark:bg-gray-700 
                             text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200"
                >
                  ✏️ עריכה
                </button>
                <button
                  onClick={onComplete}
                  className="flex-1 py-2 px-3 text-sm bg-green-100 dark:bg-green-900/30 
                             text-green-700 dark:text-green-300 rounded-lg hover:bg-green-200"
                >
                  ✅ סיום
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * כרטיס משימה שהושלמה
 */
function CompletedTaskCard({ task, onEditTask }) {
  const taskType = TASK_TYPES[task.task_type] || TASK_TYPES.other;
  
  return (
    <div 
      className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-100"
      onClick={() => onEditTask(task)}
    >
      <span className="text-green-500">✓</span>
      <span>{taskType.icon}</span>
      <span className="line-through text-gray-500 truncate flex-1">{task.title}</span>
      <span className="text-xs text-gray-400">{formatDuration(task.time_spent || task.estimated_duration)}</span>
    </div>
  );
}

/**
 * תצוגת ציר זמן
 */
function TimelineView({ dayPlan, onEditTask, onComplete, onAddTask }) {
  const hours = [];
  const workHours = dayPlan.workHours || { start: 8, end: 16 };
  
  for (let h = workHours.start; h <= workHours.end; h++) {
    hours.push(h);
  }

  // מיפוי משימות לשעות
  const tasksByHour = {};
  dayPlan.scheduledBlocks?.forEach(block => {
    const hour = Math.floor(block.startMinute / 60);
    if (!tasksByHour[hour]) tasksByHour[hour] = [];
    tasksByHour[hour].push(block);
  });

  const now = new Date();
  const currentHour = now.getHours();
  const isToday = dayPlan.date === new Date().toISOString().split('T')[0];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {hours.map(hour => {
        const blocks = tasksByHour[hour] || [];
        const isCurrentHour = isToday && hour === currentHour;
        const isPast = isToday && hour < currentHour;

        return (
          <div 
            key={hour}
            className={`flex border-b border-gray-100 dark:border-gray-700 last:border-b-0 ${
              isCurrentHour ? 'bg-blue-50 dark:bg-blue-900/20' : 
              isPast ? 'bg-gray-50 dark:bg-gray-900/30' : ''
            }`}
          >
            {/* עמודת שעה */}
            <div className={`w-16 flex-shrink-0 p-3 border-l border-gray-100 dark:border-gray-700 ${
              isCurrentHour ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-gray-50 dark:bg-gray-900/30'
            }`}>
              <div className={`text-sm font-mono font-bold ${
                isCurrentHour ? 'text-blue-600 dark:text-blue-400' : 
                isPast ? 'text-gray-400' : 'text-gray-600 dark:text-gray-300'
              }`}>
                {hour.toString().padStart(2, '0')}:00
              </div>
              {isCurrentHour && (
                <div className="text-xs text-blue-500 mt-0.5">עכשיו</div>
              )}
            </div>

            {/* עמודת משימות */}
            <div className="flex-1 p-2 min-h-[60px]">
              {blocks.length > 0 ? (
                <div className="space-y-1">
                  {blocks.map(block => {
                    const taskType = TASK_TYPES[block.task?.task_type] || TASK_TYPES.other;
                    return (
                      <div
                        key={block.taskId}
                        onClick={() => onEditTask(block.task)}
                        className="flex items-center gap-2 p-2 rounded-lg cursor-pointer
                                   bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200"
                      >
                        <span>{taskType.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{block.task?.title}</div>
                          <div className="text-xs text-gray-500">
                            {block.startTime} - {block.endTime}
                          </div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); onComplete(block.task); }}
                          className="text-green-500 hover:text-green-700"
                        >
                          ✓
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div 
                  className="h-full min-h-[44px] border-2 border-dashed border-gray-200 dark:border-gray-700 
                             rounded-lg flex items-center justify-center text-gray-400 text-sm
                             hover:border-blue-300 hover:text-blue-500 cursor-pointer transition-colors"
                  onClick={() => onAddTask(hour)}
                >
                  + הוסף ל-{hour}:00
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * תצוגת שבוע
 */
function WeekView({ weekPlan, selectedDate, onSelectDate }) {
  const statusColors = {
    [SCHEDULE_STATUS.OK]: 'bg-green-100 dark:bg-green-900/30 border-green-300',
    [SCHEDULE_STATUS.TIGHT]: 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300',
    [SCHEDULE_STATUS.OVERLOAD]: 'bg-red-100 dark:bg-red-900/30 border-red-300',
    [SCHEDULE_STATUS.NO_TASKS]: 'bg-gray-100 dark:bg-gray-800 border-gray-300'
  };

  return (
    <div className="space-y-4">
      {/* סיכום שבוע */}
      <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <h3 className="font-bold text-lg mb-2">{weekPlan.message}</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-blue-600">{formatDuration(weekPlan.summary.totalScheduledMinutes)}</div>
            <div className="text-xs text-gray-500">מתוכנן</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">{formatDuration(weekPlan.summary.totalAvailableMinutes)}</div>
            <div className="text-xs text-gray-500">זמין</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-600">{weekPlan.summary.usagePercent}%</div>
            <div className="text-xs text-gray-500">ניצול</div>
          </div>
        </div>
      </div>

      {/* ימים */}
      <div className="grid grid-cols-5 gap-2">
        {weekPlan.days.filter(d => d.isWorkDay).map(day => {
          const isSelected = day.date === selectedDate.toISOString().split('T')[0];
          const isToday = day.date === new Date().toISOString().split('T')[0];
          
          return (
            <button
              key={day.date}
              onClick={() => onSelectDate(new Date(day.date))}
              className={`p-3 rounded-xl border-2 transition-all ${statusColors[day.status]} ${
                isSelected ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              <div className="font-bold text-sm">{day.dayName}</div>
              <div className={`text-lg font-bold ${isToday ? 'text-blue-600' : ''}`}>
                {new Date(day.date).getDate()}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {day.tasks?.length || 0} משימות
              </div>
              <div className="text-xs font-medium mt-1">
                {day.usagePercent || 0}%
              </div>
            </button>
          );
        })}
      </div>

      {/* המלצות */}
      {weekPlan.warnings?.length > 0 && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
          <h4 className="font-medium text-amber-800 dark:text-amber-200 mb-2">💡 המלצות</h4>
          {weekPlan.warnings.slice(0, 3).map((w, i) => (
            <div key={i} className="text-sm text-amber-700 dark:text-amber-300">• {w.message}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SmartDayPlanner;

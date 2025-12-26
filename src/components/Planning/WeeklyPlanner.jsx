import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { planWeek } from '../../utils/dayPlanner';
import { TASK_TYPES } from '../../config/taskTypes';
import { formatDuration } from '../../config/workSchedule';
import SimpleTaskForm from '../DailyView/SimpleTaskForm';
import Modal from '../UI/Modal';
import Button from '../UI/Button';
import toast from 'react-hot-toast';
import { supabase } from '../../services/supabase';

/**
 * תצוגה שבועית פרואקטיבית
 * מראה את כל השבוע עם משימות משובצות אוטומטית
 */
function WeeklyPlanner() {
  const { tasks, loading, loadTasks, toggleComplete } = useTasks();
  const [weekOffset, setWeekOffset] = useState(0);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [viewMode, setViewMode] = useState('week'); // 'week' | 'day'
  const [selectedDay, setSelectedDay] = useState(null);

  // חישוב תחילת השבוע - יום ראשון של השבוע הנוכחי
  const weekStart = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = ראשון, 5 = שישי, 6 = שבת
    const date = new Date(today);
    // מחזיר ליום ראשון של השבוע
    date.setDate(today.getDate() - dayOfWeek + (weekOffset * 7));
    date.setHours(0, 0, 0, 0);
    
    console.log('📅 Week calculation:', {
      today: today.toISOString(),
      todayDay: dayOfWeek,
      weekStart: date.toISOString(),
      weekOffset
    });
    
    return date;
  }, [weekOffset]);

  // היום הנוכחי
  const todayStr = new Date().toISOString().split('T')[0];

  // תכנון שבועי - משתמש ב-planWeek הקיים
  const plan = useMemo(() => {
    if (!tasks) return null;
    console.log('🔄 WeeklyPlanner calling planWeek:', {
      weekStart: weekStart.toISOString(),
      tasksCount: tasks.length
    });
    const weekPlan = planWeek(weekStart, tasks);
    console.log('📊 Week plan result:', {
      days: weekPlan.days?.map(d => ({
        date: d.date,
        dayName: d.dayName,
        isWorkDay: d.isWorkDay,
        blocksCount: d.scheduledBlocks?.length || 0
      }))
    });
    return weekPlan;
  }, [tasks, weekStart]);

  // ניווט - תיקון כיוון לעברית (RTL)
  const goToPrevWeek = () => setWeekOffset(w => w - 1);
  const goToNextWeek = () => setWeekOffset(w => w + 1);
  const goToThisWeek = () => setWeekOffset(0);

  // בדיקה אם היום הוא היום הנוכחי
  const isToday = (dateStr) => {
    return dateStr === todayStr;
  };

  // פתיחת טופס משימה
  const handleAddTask = (date = null) => {
    setEditingTask(null);
    setSelectedDate(date);
    setShowTaskForm(true);
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
    setShowTaskForm(true);
  };

  const handleCloseForm = () => {
    setShowTaskForm(false);
    setEditingTask(null);
    setSelectedDate(null);
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

  // פורמט תאריך לכותרת
  const formatWeekTitle = () => {
    const endDate = new Date(weekStart);
    endDate.setDate(endDate.getDate() + 6);
    
    const startMonth = weekStart.toLocaleDateString('he-IL', { month: 'short' });
    const endMonth = endDate.toLocaleDateString('he-IL', { month: 'short' });
    
    if (startMonth === endMonth) {
      return `${weekStart.getDate()} - ${endDate.getDate()} ${startMonth}`;
    }
    return `${weekStart.getDate()} ${startMonth} - ${endDate.getDate()} ${endMonth}`;
  };

  if (loading || !plan) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="weekly-planner p-4">
      {/* כותרת וניווט */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            📋 תכנון שבועי
          </h1>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode(viewMode === 'week' ? 'day' : 'week')}
              className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              {viewMode === 'week' ? '📅 יום' : '📆 שבוע'}
            </button>
          </div>
        </div>

        {/* ניווט שבועות */}
        <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm">
          <button
            onClick={goToNextWeek}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
            title="שבוע הבא"
          >
            ◄
          </button>
          
          <div className="flex items-center gap-3">
            <span className="font-bold text-lg text-gray-900 dark:text-white">
              {formatWeekTitle()}
            </span>
            {weekOffset !== 0 && (
              <button
                onClick={goToThisWeek}
                className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded"
              >
                השבוע
              </button>
            )}
          </div>
          
          <button
            onClick={goToPrevWeek}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
            title="שבוע קודם"
          >
            ►
          </button>
        </div>
      </div>

      {/* סטטיסטיקות שבועיות */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <StatCard
          icon="📊"
          label="ניצולת"
          value={`${plan.summary?.usagePercent || 0}%`}
          color={(plan.summary?.usagePercent || 0) >= 80 ? 'green' : (plan.summary?.usagePercent || 0) >= 50 ? 'yellow' : 'red'}
        />
        <StatCard
          icon="✅"
          label="זמן מתוכנן"
          value={formatDuration(plan.summary?.totalScheduledMinutes || 0)}
        />
        <StatCard
          icon="⏱️"
          label="זמן פנוי"
          value={formatDuration((plan.summary?.totalAvailableMinutes || 0) - (plan.summary?.totalScheduledMinutes || 0))}
        />
        <StatCard
          icon="⚠️"
          label="ימים עמוסים"
          value={plan.summary?.overloadDays || 0}
          color={(plan.summary?.overloadDays || 0) > 0 ? 'red' : 'green'}
        />
      </div>

      {/* תצוגת שבוע */}
      {viewMode === 'week' ? (
        <div className="grid grid-cols-7 gap-2">
          {[...plan.days].reverse().map((day, idx) => (
            <DayColumn
              key={day.date}
              day={day}
              isToday={isToday(day.date)}
              onAddTask={() => handleAddTask(day.date)}
              onEditTask={handleEditTask}
              onComplete={handleComplete}
              onSelectDay={() => {
                setSelectedDay(day);
                setViewMode('day');
              }}
            />
          ))}
        </div>
      ) : (
        <DayDetailView
          day={selectedDay || plan.days.find(d => isToday(d.date)) || plan.days[0]}
          allDays={plan.days}
          onBack={() => setViewMode('week')}
          onAddTask={handleAddTask}
          onEditTask={handleEditTask}
          onComplete={handleComplete}
          onSelectDay={(day) => setSelectedDay(day)}
        />
      )}

      {/* אזהרות */}
      {plan.warnings?.length > 0 && (
        <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800">
          <h3 className="font-bold text-yellow-800 dark:text-yellow-200 mb-3 flex items-center gap-2">
            <span>⚠️</span>
            {plan.warnings.length} אזהרות
          </h3>
          <div className="space-y-2">
            {plan.warnings.slice(0, 5).map((warning, idx) => (
              <div 
                key={idx}
                className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded-lg"
              >
                <span className="text-sm text-gray-700 dark:text-gray-300">{warning.message}</span>
                <span className="text-xs text-gray-500">{warning.date}</span>
              </div>
            ))}
          </div>
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
          defaultDate={selectedDate}
        />
      </Modal>
    </div>
  );
}

/**
 * כרטיס סטטיסטיקה
 */
function StatCard({ icon, label, value, subtext, color = 'gray' }) {
  const colors = {
    gray: 'bg-gray-50 dark:bg-gray-800',
    green: 'bg-green-50 dark:bg-green-900/20',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20',
    red: 'bg-red-50 dark:bg-red-900/20',
    blue: 'bg-blue-50 dark:bg-blue-900/20'
  };

  return (
    <div className={`${colors[color]} rounded-xl p-3 text-center`}>
      <div className="text-xl mb-1">{icon}</div>
      <div className="text-xl font-bold text-gray-900 dark:text-white">{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      {subtext && <div className="text-xs text-gray-400">{subtext}</div>}
    </div>
  );
}

/**
 * עמודת יום
 */
function DayColumn({ day, isToday, onAddTask, onEditTask, onComplete, onSelectDay }) {
  const bgColor = !day.isWorkDay 
    ? 'bg-gray-100 dark:bg-gray-800/50' 
    : isToday 
      ? 'bg-blue-50 dark:bg-blue-900/20' 
      : 'bg-white dark:bg-gray-800';

  const borderColor = isToday 
    ? 'border-blue-400 dark:border-blue-600' 
    : 'border-gray-200 dark:border-gray-700';

  // שימוש ב-scheduledBlocks מתוך planDay
  const blocks = day.scheduledBlocks || [];
  const usagePercent = day.usagePercent || 0;

  // חישוב שם היום והתאריך מתוך day.date
  const dateObj = new Date(day.date + 'T12:00:00'); // הוספת שעה למניעת בעיות timezone
  const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const dayName = dayNames[dateObj.getDay()];
  const dayNumber = dateObj.getDate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${bgColor} rounded-xl border-2 ${borderColor} overflow-hidden min-h-[300px] flex flex-col`}
    >
      {/* כותרת יום */}
      <button
        onClick={onSelectDay}
        className="p-2 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className={`text-sm font-bold ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
          {dayName}
        </div>
        <div className={`text-xs ${isToday ? 'text-blue-500' : 'text-gray-500'}`}>
          {dayNumber}
        </div>
      </button>

      {/* תוכן */}
      <div className="flex-1 p-2 space-y-1 overflow-y-auto max-h-[250px]">
        {!day.isWorkDay ? (
          <div className="text-center text-gray-400 text-xs py-4">
            🌴 יום חופש
          </div>
        ) : blocks.length === 0 ? (
          <div className="text-center text-gray-400 text-xs py-4">
            אין משימות
          </div>
        ) : (
          blocks.map((block, idx) => (
            <TaskSlot
              key={block.taskId || idx}
              slot={block}
              onEdit={() => onEditTask(block.task)}
              onComplete={() => onComplete(block.task)}
              compact
            />
          ))
        )}
      </div>

      {/* כפתור הוספה */}
      {day.isWorkDay && (
        <button
          onClick={onAddTask}
          className="p-2 text-center text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-t border-gray-200 dark:border-gray-700 transition-colors text-sm"
        >
          + הוסף
        </button>
      )}

      {/* סרגל ניצולת */}
      {day.isWorkDay && (
        <div className="px-2 pb-2">
          <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all ${
                usagePercent >= 80 
                  ? 'bg-green-500' 
                  : usagePercent >= 50 
                    ? 'bg-yellow-500' 
                    : 'bg-red-400'
              }`}
              style={{ width: `${Math.min(usagePercent, 100)}%` }}
            />
          </div>
          <div className="text-center text-xs text-gray-400 mt-1">
            {usagePercent}%
          </div>
        </div>
      )}
    </motion.div>
  );
}

/**
 * תצוגת יום מפורטת
 */
function DayDetailView({ day, allDays, onBack, onAddTask, onEditTask, onComplete, onSelectDay }) {
  const hours = [];
  if (day.workHours) {
    for (let h = day.workHours.start; h < day.workHours.end; h++) {
      hours.push(h);
    }
  }

  const blocks = day.scheduledBlocks || [];
  
  // חישוב שם היום מתוך day.date
  const dateObj = new Date(day.date + 'T12:00:00');
  const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const dayName = dayNames[dateObj.getDay()];

  // מציאת היום הקודם והבא
  const currentIndex = allDays?.findIndex(d => d.date === day.date) ?? -1;
  const prevDay = currentIndex > 0 ? allDays[currentIndex - 1] : null;
  const nextDay = currentIndex < (allDays?.length || 0) - 1 ? allDays[currentIndex + 1] : null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* כותרת */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600"
          >
            ← חזרה לשבוע
          </button>
          
          <button
            onClick={() => onAddTask(day.date)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            + משימה
          </button>
        </div>
        
        {/* ניווט בין ימים */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => nextDay && onSelectDay(nextDay)}
            disabled={!nextDay}
            className={`p-2 rounded-lg ${nextDay ? 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600' : 'text-gray-300 cursor-not-allowed'}`}
          >
            ◄ {nextDay ? dayNames[new Date(nextDay.date + 'T12:00:00').getDay()] : ''}
          </button>
          
          <div className="text-center">
            <div className="text-xl font-bold text-gray-900 dark:text-white">
              יום {dayName}
            </div>
            <div className="text-sm text-gray-500">
              {dateObj.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })}
            </div>
          </div>
          
          <button
            onClick={() => prevDay && onSelectDay(prevDay)}
            disabled={!prevDay}
            className={`p-2 rounded-lg ${prevDay ? 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600' : 'text-gray-300 cursor-not-allowed'}`}
          >
            {prevDay ? dayNames[new Date(prevDay.date + 'T12:00:00').getDay()] : ''} ►
          </button>
        </div>
      </div>

      {/* ציר זמן */}
      {!day.isWorkDay ? (
        <div className="p-8 text-center text-gray-400">
          🌴 יום חופש
        </div>
      ) : (
        <div className="p-4">
          <div className="relative">
            {hours.map(hour => {
              const blocksAtHour = blocks.filter(b => {
                const blockHour = Math.floor(b.startMinute / 60);
                return blockHour === hour;
              });

              return (
                <div key={hour} className="flex border-b border-gray-100 dark:border-gray-700 min-h-[60px]">
                  {/* שעה */}
                  <div className="w-16 py-2 text-sm text-gray-500 text-left flex-shrink-0">
                    {hour}:00
                  </div>
                  
                  {/* משימות */}
                  <div className="flex-1 py-1 space-y-1">
                    {blocksAtHour.map((block, idx) => (
                      <TaskSlot
                        key={block.taskId || idx}
                        slot={block}
                        onEdit={() => onEditTask(block.task)}
                        onComplete={() => onComplete(block.task)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* סיכום */}
          <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg flex justify-around text-center">
            <div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {formatDuration(day.scheduledMinutes || 0)}
              </div>
              <div className="text-xs text-gray-500">מתוכנן</div>
            </div>
            <div>
              <div className="text-lg font-bold text-green-600">
                {formatDuration(day.freeMinutes || 0)}
              </div>
              <div className="text-xs text-gray-500">פנוי</div>
            </div>
            <div>
              <div className="text-lg font-bold text-blue-600">
                {day.usagePercent || 0}%
              </div>
              <div className="text-xs text-gray-500">ניצולת</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * חריץ משימה
 */
function TaskSlot({ slot, onEdit, onComplete, compact = false }) {
  const taskType = TASK_TYPES[slot.task?.task_type] || TASK_TYPES.other;
  
  // צבעים לפי מצב המשימה
  const priorityColors = {
    urgent: 'border-r-red-500 bg-red-50 dark:bg-red-900/20',
    high: 'border-r-orange-500 bg-orange-50 dark:bg-orange-900/20',
    normal: 'border-r-blue-500 bg-blue-50 dark:bg-blue-900/20'
  };

  const colorClass = slot.isFixed 
    ? 'border-r-purple-500 bg-purple-50 dark:bg-purple-900/20'
    : priorityColors[slot.task?.priority] || 'border-r-gray-300 bg-gray-50 dark:bg-gray-700';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`
        ${colorClass} rounded-lg border-r-4 p-2 cursor-pointer
        hover:shadow-md transition-shadow
      `}
      onClick={onEdit}
    >
      <div className="flex items-start gap-2">
        {/* אייקון סוג */}
        <span className={compact ? 'text-sm' : 'text-lg'}>{taskType.icon}</span>
        
        <div className="flex-1 min-w-0">
          {/* כותרת */}
          <div className={`font-medium text-gray-900 dark:text-white truncate ${compact ? 'text-xs' : 'text-sm'}`}>
            {slot.task?.title}
          </div>
          
          {/* שעות */}
          <div className={`text-gray-500 ${compact ? 'text-xs' : 'text-xs'}`}>
            {slot.startTime} - {slot.endTime}
          </div>
          
          {/* תגית שעה קבועה */}
          {slot.isFixed && !compact && (
            <span className="inline-block mt-1 px-1.5 py-0.5 bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-200 text-xs rounded">
              📍 שעה קבועה
            </span>
          )}
        </div>

        {/* כפתור השלמה */}
        {!compact && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onComplete();
            }}
            className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-900/30 text-gray-400 hover:text-green-600"
          >
            ✓
          </button>
        )}
      </div>
    </motion.div>
  );
}

export default WeeklyPlanner;

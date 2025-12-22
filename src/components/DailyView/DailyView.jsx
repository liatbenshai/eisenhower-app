import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../hooks/useAuth';
import SimpleTaskForm from './SimpleTaskForm';
import DailyTaskCard from './DailyTaskCard';
import Modal from '../UI/Modal';
import Button from '../UI/Button';

/**
 * סוגי משימות מוגדרים
 */
export const TASK_TYPES = {
  transcription: { 
    id: 'transcription', 
    name: 'תמלול', 
    icon: '🎙️',
    hasParameter: true,
    parameterName: 'אורך קובץ (דקות)',
    defaultMultiplier: 3 // ברירת מחדל: פי 3 מאורך הקובץ
  },
  proofreading: { 
    id: 'proofreading', 
    name: 'הגהה', 
    icon: '📝',
    hasParameter: true,
    parameterName: 'מספר עמודים',
    defaultMultiplier: 15 // ברירת מחדל: 15 דקות לעמוד
  },
  email: { 
    id: 'email', 
    name: 'מיילים', 
    icon: '📧',
    hasParameter: false,
    defaultDuration: 25
  },
  course: { 
    id: 'course', 
    name: 'עבודה על הקורס', 
    icon: '📚',
    hasParameter: false,
    defaultDuration: 90
  },
  client_communication: { 
    id: 'client_communication', 
    name: 'תקשורת עם לקוחות', 
    icon: '💬',
    hasParameter: false,
    defaultDuration: 30
  },
  unexpected: { 
    id: 'unexpected', 
    name: 'בלת"מים', 
    icon: '⚡',
    hasParameter: false,
    defaultDuration: 30
  },
  other: { 
    id: 'other', 
    name: 'אחר', 
    icon: '📋',
    hasParameter: false,
    defaultDuration: 30
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
 * קבלת התאריך של היום בפורמט ישראלי
 */
function getTodayHebrew() {
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const months = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 
                  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  const today = new Date();
  const dayName = days[today.getDay()];
  const day = today.getDate();
  const month = months[today.getMonth()];
  const year = today.getFullYear();
  return `יום ${dayName}, ${day} ב${month} ${year}`;
}

/**
 * קבלת התאריך של היום בפורמט ISO
 */
function getTodayISO() {
  return new Date().toISOString().split('T')[0];
}

/**
 * תצוגת יום עבודה - מסך ראשי חדש
 */
function DailyView() {
  const { user } = useAuth();
  const { tasks, loading, error, loadTasks } = useTasks();
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  // משימות להיום
  const todaysTasks = useMemo(() => {
    const today = getTodayISO();
    return tasks.filter(task => {
      // משימות עם תאריך יעד היום
      if (task.due_date === today) return true;
      // משימות עם תאריך התחלה היום
      if (task.start_date === today) return true;
      // משימות פעילות בלי תאריך (נראה אותן תמיד)
      if (!task.due_date && !task.is_completed) return true;
      return false;
    }).sort((a, b) => {
      // קודם לפי סטטוס (פעילות קודם)
      if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
      // אחר כך לפי שעה
      if (a.due_time && b.due_time) return a.due_time.localeCompare(b.due_time);
      if (a.due_time) return -1;
      if (b.due_time) return 1;
      return 0;
    });
  }, [tasks]);

  // חישוב זמנים
  const timeStats = useMemo(() => {
    const completedMinutes = todaysTasks
      .filter(t => t.is_completed)
      .reduce((sum, t) => sum + (t.time_spent || 0), 0);
    
    const plannedMinutes = todaysTasks
      .filter(t => !t.is_completed)
      .reduce((sum, t) => sum + (t.estimated_duration || 0), 0);
    
    const inProgressMinutes = todaysTasks
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
  }, [todaysTasks]);

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
      {/* כותרת היום */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {getTodayHebrew()}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          שעות עבודה: {WORK_HOURS.start}:00 - {WORK_HOURS.end}:00
        </p>
      </motion.div>

      {/* סרגל זמן */}
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
              נשאר היום: {formatMinutes(timeStats.remaining)}
            </span>
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {timeStats.usedPercent}% מהיום נוצל
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

      {/* רשימת משימות */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="space-y-3"
      >
        {todaysTasks.length === 0 ? (
          <div className="card p-8 text-center">
            <span className="text-4xl mb-4 block">📝</span>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              אין משימות להיום
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              הוסיפי משימה חדשה להתחיל
            </p>
          </div>
        ) : (
          <>
            {/* משימות פעילות */}
            {todaysTasks.filter(t => !t.is_completed).map(task => (
              <DailyTaskCard 
                key={task.id} 
                task={task} 
                onEdit={() => handleEditTask(task)}
                onUpdate={loadTasks}
              />
            ))}
            
            {/* משימות שהושלמו */}
            {todaysTasks.filter(t => t.is_completed).length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  ✅ הושלמו היום ({todaysTasks.filter(t => t.is_completed).length})
                </h3>
                <div className="space-y-2 opacity-60">
                  {todaysTasks.filter(t => t.is_completed).map(task => (
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
        />
      </Modal>
    </div>
  );
}

export default DailyView;

import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../hooks/useAuth';
import { TASK_TYPES } from '../../config/taskTypes';
import { getInterruptionStats } from '../../services/supabase';
import SimpleTaskForm from '../DailyView/SimpleTaskForm';
import Modal from '../UI/Modal';
import Button from '../UI/Button';
import toast from 'react-hot-toast';

/**
 * דשבורד חכם - עמוד הבית
 * מציג סיכומים, תובנות מהירות, גרפים ומשימות להיום
 */
function SmartDashboard() {
  const { tasks, loading, toggleComplete } = useTasks();
  const { user } = useAuth();
  
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [interruptionStats, setInterruptionStats] = useState(null);
  const [dismissedInsights, setDismissedInsights] = useState([]);

  // טעינת סטטיסטיקות הפרעות
  useEffect(() => {
    if (user?.id) {
      loadInterruptionStats();
      loadDismissedInsights();
    }
  }, [user?.id]);

  const loadInterruptionStats = async () => {
    try {
      const stats = await getInterruptionStats(user.id, 30);
      setInterruptionStats(stats);
    } catch (err) {
      console.log('אין נתוני הפרעות עדיין');
    }
  };

  const loadDismissedInsights = () => {
    const saved = localStorage.getItem(`dismissed_insights_${user?.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // סינון הצעות שעבר שבוע מאז הדחייה
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const valid = parsed.filter(d => d.dismissedAt > weekAgo);
        setDismissedInsights(valid);
      } catch (e) {}
    }
  };

  // תאריכים
  const today = new Date();
  const todayISO = today.toISOString().split('T')[0];
  const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const todayName = dayNames[today.getDay()];

  // ברכה לפי שעה
  const getGreeting = () => {
    const hour = today.getHours();
    if (hour < 12) return 'בוקר טוב';
    if (hour < 17) return 'צהריים טובים';
    if (hour < 21) return 'ערב טוב';
    return 'לילה טוב';
  };

  // שם המשתמש
  const userName = user?.profile?.full_name?.split(' ')[0] || 'שלום';

  // === סטטיסטיקות ===
  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(todayISO);
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartISO = weekStart.toISOString().split('T')[0];

    // משימות להיום
    const todayTasks = tasks.filter(t => {
      if (t.is_completed) return false;
      if (t.due_date === todayISO) return true;
      if (t.start_date === todayISO) return true;
      if (!t.due_date && !t.start_date) return true;
      return false;
    });

    // משימות שהושלמו היום
    const completedToday = tasks.filter(t => 
      t.is_completed && t.completed_at?.startsWith(todayISO)
    );

    // משימות שהושלמו השבוע
    const completedThisWeek = tasks.filter(t => 
      t.is_completed && t.completed_at >= weekStartISO
    );

    // זמן עבודה היום
    const workedToday = completedToday.reduce((sum, t) => sum + (t.time_spent || 0), 0);
    
    // זמן עבודה השבוע
    const workedThisWeek = completedThisWeek.reduce((sum, t) => sum + (t.time_spent || 0), 0);

    // זמן מתוכנן להיום
    const plannedToday = todayTasks.reduce((sum, t) => sum + (t.estimated_duration || 0), 0);

    // משימות דחופות
    const urgentTasks = todayTasks.filter(t => t.priority === 'urgent');

    // משימות עם דדליין קרוב (מחר)
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowISO = tomorrow.toISOString().split('T')[0];
    const dueTomorrow = tasks.filter(t => !t.is_completed && t.due_date === tomorrowISO);

    // התפלגות לפי סוג משימה (השבוע)
    const byType = {};
    completedThisWeek.forEach(t => {
      const type = t.task_type || 'other';
      if (!byType[type]) byType[type] = { count: 0, minutes: 0 };
      byType[type].count++;
      byType[type].minutes += t.time_spent || 0;
    });

    // חישוב אחוז היום "מלא"
    const workDayMinutes = 8 * 60; // 480 דקות
    const dayFullness = Math.min(100, Math.round((plannedToday / workDayMinutes) * 100));

    return {
      todayTasks,
      completedToday,
      completedThisWeek,
      workedToday,
      workedThisWeek,
      plannedToday,
      urgentTasks,
      dueTomorrow,
      byType,
      dayFullness
    };
  }, [tasks, todayISO]);

  // === תובנות מהירות ===
  const quickInsights = useMemo(() => {
    const insights = [];
    const dismissedIds = dismissedInsights.map(d => d.id);

    // תובנה: יום עמוס
    if (stats.dayFullness > 90 && !dismissedIds.includes('busy_day')) {
      insights.push({
        id: 'busy_day',
        type: 'warning',
        icon: '⚠️',
        title: 'יום עמוס',
        text: `תכננת ${formatMinutes(stats.plannedToday)} היום - שקלי לדחות משימות`,
        action: null
      });
    }

    // תובנה: משימות דחופות
    if (stats.urgentTasks.length > 2 && !dismissedIds.includes('too_urgent')) {
      insights.push({
        id: 'too_urgent',
        type: 'alert',
        icon: '🔴',
        title: `${stats.urgentTasks.length} משימות דחופות`,
        text: 'אולי לא הכל באמת דחוף?',
        action: { label: 'לסדר עדיפויות', link: '/daily' }
      });
    }

    // תובנה: דדליין מחר
    if (stats.dueTomorrow.length > 0 && !dismissedIds.includes('due_tomorrow')) {
      insights.push({
        id: 'due_tomorrow',
        type: 'info',
        icon: '⏰',
        title: `${stats.dueTomorrow.length} משימות לסיום מחר`,
        text: stats.dueTomorrow.map(t => t.title).slice(0, 2).join(', '),
        action: { label: 'לצפות', link: '/weekly' }
      });
    }

    // תובנה: הרבה הפרעות
    if (interruptionStats?.avgPerDay > 5 && !dismissedIds.includes('many_interruptions')) {
      insights.push({
        id: 'many_interruptions',
        type: 'insight',
        icon: '📞',
        title: 'הרבה הפרעות',
        text: `ממוצע ${interruptionStats.avgPerDay} הפרעות ליום. שעות השיא: ${interruptionStats.peakHours?.[0]?.hour || '?'}:00`,
        action: { label: 'לראות פירוט', link: '/insights' }
      });
    }

    // תובנה: עידוד
    if (stats.completedToday.length >= 3 && !dismissedIds.includes('good_progress')) {
      insights.push({
        id: 'good_progress',
        type: 'success',
        icon: '🌟',
        title: 'יופי של התקדמות!',
        text: `כבר סיימת ${stats.completedToday.length} משימות היום`,
        action: null
      });
    }

    // תובנה: עוד לא התחלת
    if (stats.completedToday.length === 0 && today.getHours() >= 10 && !dismissedIds.includes('not_started')) {
      insights.push({
        id: 'not_started',
        type: 'nudge',
        icon: '💪',
        title: 'בואי נתחיל!',
        text: 'עוד לא סימנת משימות כהושלמו היום',
        action: { label: 'למשימות', link: '/daily' }
      });
    }

    return insights.slice(0, 3); // מקסימום 3 תובנות
  }, [stats, interruptionStats, dismissedInsights]);

  // דחיית תובנה
  const dismissInsight = (insightId) => {
    const newDismissed = [...dismissedInsights, { id: insightId, dismissedAt: Date.now() }];
    setDismissedInsights(newDismissed);
    localStorage.setItem(`dismissed_insights_${user?.id}`, JSON.stringify(newDismissed));
    toast.success('התובנה נדחתה לשבוע');
  };

  // פורמט דקות
  function formatMinutes(minutes) {
    if (!minutes || minutes <= 0) return '0 דק\'';
    if (minutes < 60) return `${minutes} דק'`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours} שעות`;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="smart-dashboard p-4 max-w-6xl mx-auto">
      {/* === ברכה אישית === */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
          {getGreeting()}, {userName}! 👋
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          יום {todayName}, {today.toLocaleDateString('he-IL')}
          {stats.completedToday.length > 0 && (
            <span className="text-green-600 dark:text-green-400 mr-2">
              • סיימת {stats.completedToday.length} משימות היום
            </span>
          )}
        </p>
      </motion.div>

      {/* === כרטיסי סיכום === */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard
          icon="✅"
          label="הושלם היום"
          value={stats.completedToday.length}
          subtext={`מתוך ${stats.todayTasks.length + stats.completedToday.length}`}
          color="green"
        />
        <StatCard
          icon="⏱️"
          label="שעות עבודה היום"
          value={formatMinutes(stats.workedToday)}
          subtext={`מתוכנן: ${formatMinutes(stats.plannedToday)}`}
          color="blue"
        />
        <StatCard
          icon="📊"
          label="השבוע"
          value={formatMinutes(stats.workedThisWeek)}
          subtext={`${stats.completedThisWeek.length} משימות`}
          color="purple"
        />
        <StatCard
          icon="📈"
          label="מילוי היום"
          value={`${stats.dayFullness}%`}
          subtext={stats.dayFullness > 80 ? 'יום מלא!' : 'יש מקום'}
          color={stats.dayFullness > 90 ? 'red' : stats.dayFullness > 60 ? 'yellow' : 'gray'}
        />
      </div>

      {/* === תובנות מהירות === */}
      {quickInsights.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            💡 תובנות מהירות
          </h2>
          <div className="grid md:grid-cols-3 gap-3">
            {quickInsights.map((insight) => (
              <InsightCard
                key={insight.id}
                insight={insight}
                onDismiss={() => dismissInsight(insight.id)}
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* === שני עמודות: משימות + גרפים === */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* משימות להיום */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
              📋 משימות להיום
              <span className="text-sm font-normal text-gray-500">
                ({stats.todayTasks.length})
              </span>
            </h2>
            <Button
              size="sm"
              onClick={() => setShowTaskForm(true)}
            >
              + חדש
            </Button>
          </div>

          {stats.todayTasks.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <div className="text-4xl mb-2">🎉</div>
              <p>אין משימות פתוחות להיום!</p>
              <Link to="/weekly" className="text-blue-500 hover:underline text-sm">
                לצפות בשבוע →
              </Link>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {stats.todayTasks.slice(0, 8).map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onComplete={() => toggleComplete(task.id)}
                  onEdit={() => {
                    setEditingTask(task);
                    setShowTaskForm(true);
                  }}
                />
              ))}
              {stats.todayTasks.length > 8 && (
                <Link
                  to="/daily"
                  className="block text-center text-blue-500 hover:underline text-sm py-2"
                >
                  + עוד {stats.todayTasks.length - 8} משימות
                </Link>
              )}
            </div>
          )}
        </motion.div>

        {/* גרף התפלגות לפי סוג */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700"
        >
          <h2 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            📊 התפלגות השבוע
          </h2>

          {Object.keys(stats.byType).length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <div className="text-4xl mb-2">📈</div>
              <p>עוד אין נתונים להצגה</p>
              <p className="text-sm">סיימי משימות כדי לראות סטטיסטיקות</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(stats.byType)
                .sort((a, b) => b[1].minutes - a[1].minutes)
                .slice(0, 6)
                .map(([type, data]) => {
                  const taskType = TASK_TYPES[type] || TASK_TYPES.other;
                  const totalMinutes = Object.values(stats.byType).reduce((sum, d) => sum + d.minutes, 0);
                  const percent = totalMinutes > 0 ? Math.round((data.minutes / totalMinutes) * 100) : 0;
                  
                  return (
                    <div key={type}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="flex items-center gap-2">
                          <span>{taskType.icon}</span>
                          <span className="text-gray-700 dark:text-gray-300">{taskType.name}</span>
                        </span>
                        <span className="text-gray-500">
                          {formatMinutes(data.minutes)} ({percent}%)
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${percent}%` }}
                          transition={{ duration: 0.5, delay: 0.1 }}
                          className="h-full bg-blue-500 rounded-full"
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {/* קישור לתובנות מלאות */}
          <Link
            to="/insights"
            className="block text-center text-blue-500 hover:underline text-sm mt-4 pt-4 border-t border-gray-100 dark:border-gray-700"
          >
            לתובנות מלאות →
          </Link>
        </motion.div>
      </div>

      {/* === הפרעות (אם יש נתונים) === */}
      {interruptionStats && interruptionStats.totalInterruptions > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-6 bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700"
        >
          <h2 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            📞 הפרעות (30 יום אחרונים)
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {interruptionStats.totalInterruptions}
              </div>
              <div className="text-sm text-gray-500">סה"כ הפרעות</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatMinutes(interruptionStats.totalMinutes)}
              </div>
              <div className="text-sm text-gray-500">זמן מבוזבז</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {interruptionStats.avgPerDay}
              </div>
              <div className="text-sm text-gray-500">ממוצע ליום</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {interruptionStats.avgDurationMinutes} דק'
              </div>
              <div className="text-sm text-gray-500">ממוצע להפרעה</div>
            </div>
          </div>
        </motion.div>
      )}

      {/* מודל טופס */}
      <Modal
        isOpen={showTaskForm}
        onClose={() => { setShowTaskForm(false); setEditingTask(null); }}
        title={editingTask?.id ? 'עריכת משימה' : 'משימה חדשה'}
      >
        <SimpleTaskForm
          task={editingTask}
          onClose={() => { setShowTaskForm(false); setEditingTask(null); }}
          defaultDate={todayISO}
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
    gray: 'bg-gray-50 dark:bg-gray-800 border-gray-200',
    green: 'bg-green-50 dark:bg-green-900/20 border-green-200',
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200',
    purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200',
    red: 'bg-red-50 dark:bg-red-900/20 border-red-200'
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className={`${colors[color]} rounded-xl p-3 text-center border dark:border-gray-700`}
    >
      <div className="text-xl mb-1">{icon}</div>
      <div className="text-xl font-bold text-gray-900 dark:text-white">{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      {subtext && <div className="text-xs text-gray-400 mt-0.5">{subtext}</div>}
    </motion.div>
  );
}

/**
 * כרטיס תובנה
 */
function InsightCard({ insight, onDismiss }) {
  const typeColors = {
    warning: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
    alert: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    insight: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
    nudge: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`${typeColors[insight.type]} rounded-xl p-3 border relative group`}
    >
      {/* כפתור דחייה */}
      <button
        onClick={onDismiss}
        className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 transition-opacity"
        title="דחה לשבוע"
      >
        ✕
      </button>

      <div className="flex items-start gap-2">
        <span className="text-xl">{insight.icon}</span>
        <div className="flex-1">
          <div className="font-medium text-gray-900 dark:text-white text-sm">
            {insight.title}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
            {insight.text}
          </div>
          {insight.action && (
            <Link
              to={insight.action.link}
              className="inline-block mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              {insight.action.label} →
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/**
 * שורת משימה
 */
function TaskRow({ task, onComplete, onEdit }) {
  const taskType = TASK_TYPES[task.task_type] || TASK_TYPES.other;
  const spent = task.time_spent || 0;
  const estimated = task.estimated_duration || 0;
  const progress = estimated > 0 ? Math.min(100, Math.round((spent / estimated) * 100)) : 0;

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
      {/* כפתור השלמה */}
      <button
        onClick={onComplete}
        className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600 hover:border-green-500 hover:bg-green-500 flex-shrink-0 transition-all flex items-center justify-center"
      >
        <span className="text-white text-xs opacity-0 group-hover:opacity-100">✓</span>
      </button>

      {/* אייקון */}
      <span className="text-lg">{taskType.icon}</span>

      {/* תוכן */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 dark:text-white truncate text-sm">
            {task.title}
          </span>
          {task.priority === 'urgent' && (
            <span className="text-xs px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 rounded">
              דחוף
            </span>
          )}
        </div>
        {estimated > 0 && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>{Math.round(estimated)} דק'</span>
            {progress > 0 && (
              <div className="flex-1 max-w-16 h-1 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500" 
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* כפתור עריכה */}
      <button
        onClick={onEdit}
        className="p-1 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        ✏️
      </button>
    </div>
  );
}

export default SmartDashboard;

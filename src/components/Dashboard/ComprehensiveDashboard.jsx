import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { TASK_TYPES } from '../../config/taskTypes';
import DailySummaryCard from './DailySummaryCard';
import WeeklySummaryCard from './WeeklySummaryCard';
import WorkPaceInsights from './WorkPaceInsights';
import UpcomingTasks from './UpcomingTasks';
import InterruptionsTracker from './InterruptionsTracker';
import SmartRecommendationsPanel from './SmartRecommendationsPanel';

/**
 * דשבורד מקיף לניהול זמן
 * מציג סיכום יומי, שבועי, תובנות ומשימות קרובות
 */
function ComprehensiveDashboard() {
  const { tasks, loading } = useTasks();
  const [activeTab, setActiveTab] = useState('today'); // today, week, insights, interruptions
  const [selectedDate, setSelectedDate] = useState(new Date());

  // חישוב תאריכים
  const today = new Date();
  const todayISO = today.toISOString().split('T')[0];
  
  // תחילת השבוע (יום ראשון)
  const startOfWeek = useMemo(() => {
    const start = new Date(today);
    start.setDate(start.getDate() - start.getDay());
    return start;
  }, []);

  // סוף השבוע (שבת)
  const endOfWeek = useMemo(() => {
    const end = new Date(startOfWeek);
    end.setDate(end.getDate() + 6);
    return end;
  }, [startOfWeek]);

  // משימות היום
  const todayTasks = useMemo(() => {
    return tasks.filter(t => t.due_date === todayISO);
  }, [tasks, todayISO]);

  // משימות השבוע
  const weekTasks = useMemo(() => {
    const startISO = startOfWeek.toISOString().split('T')[0];
    const endISO = endOfWeek.toISOString().split('T')[0];
    return tasks.filter(t => {
      if (!t.due_date) return false;
      return t.due_date >= startISO && t.due_date <= endISO;
    });
  }, [tasks, startOfWeek, endOfWeek]);

  // סטטיסטיקות יומיות
  const dailyStats = useMemo(() => {
    const completed = todayTasks.filter(t => t.is_completed);
    const pending = todayTasks.filter(t => !t.is_completed);
    const totalTimeSpent = completed.reduce((sum, t) => sum + (t.time_spent || 0), 0);
    const totalEstimated = pending.reduce((sum, t) => sum + (t.estimated_duration || 30), 0);
    const completedEstimated = completed.reduce((sum, t) => sum + (t.estimated_duration || 30), 0);
    
    // דיוק הערכות
    const accuracy = completedEstimated > 0 
      ? Math.round((completedEstimated / Math.max(totalTimeSpent, 1)) * 100)
      : 100;

    return {
      total: todayTasks.length,
      completed: completed.length,
      pending: pending.length,
      totalTimeSpent,
      totalEstimated,
      accuracy,
      completionRate: todayTasks.length > 0 
        ? Math.round((completed.length / todayTasks.length) * 100) 
        : 0
    };
  }, [todayTasks]);

  // סטטיסטיקות שבועיות
  const weeklyStats = useMemo(() => {
    const completed = weekTasks.filter(t => t.is_completed);
    const pending = weekTasks.filter(t => !t.is_completed);
    const totalTimeSpent = completed.reduce((sum, t) => sum + (t.time_spent || 0), 0);
    
    // התפלגות לפי יום
    const byDay = {};
    const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(startOfWeek);
      dayDate.setDate(dayDate.getDate() + i);
      const dayISO = dayDate.toISOString().split('T')[0];
      
      const dayTasks = weekTasks.filter(t => t.due_date === dayISO);
      byDay[i] = {
        name: dayNames[i],
        date: dayISO,
        total: dayTasks.length,
        completed: dayTasks.filter(t => t.is_completed).length,
        timeSpent: dayTasks.filter(t => t.is_completed).reduce((sum, t) => sum + (t.time_spent || 0), 0)
      };
    }

    // התפלגות לפי סוג משימה
    const byType = {};
    weekTasks.forEach(t => {
      const type = t.task_type || 'other';
      if (!byType[type]) {
        byType[type] = { completed: 0, pending: 0, timeSpent: 0 };
      }
      if (t.is_completed) {
        byType[type].completed++;
        byType[type].timeSpent += t.time_spent || 0;
      } else {
        byType[type].pending++;
      }
    });

    return {
      total: weekTasks.length,
      completed: completed.length,
      pending: pending.length,
      totalTimeSpent,
      byDay,
      byType,
      completionRate: weekTasks.length > 0 
        ? Math.round((completed.length / weekTasks.length) * 100) 
        : 0,
      averageTasksPerDay: Math.round(weekTasks.length / 7)
    };
  }, [weekTasks, startOfWeek]);

  // פורמט זמן
  const formatTime = (minutes) => {
    if (!minutes) return '0 דק\'';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} דק'`;
    if (mins === 0) return `${hours} שעות`;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  };

  // טאבים
  const tabs = [
    { id: 'today', label: 'היום', icon: '📅' },
    { id: 'week', label: 'השבוע', icon: '📊' },
    { id: 'insights', label: 'תובנות', icon: '💡' },
    { id: 'interruptions', label: 'הפרעות', icon: '⏸️' }
  ];

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">טוען נתונים...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* כותרת */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          📊 דשבורד ניהול זמן
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          {today.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </motion.div>

      {/* כרטיסי סיכום מהיר */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"
      >
        {/* משימות היום */}
        <div className="card p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border border-blue-200 dark:border-blue-700">
          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
            {dailyStats.completed}/{dailyStats.total}
          </div>
          <div className="text-sm text-blue-700 dark:text-blue-300">משימות היום</div>
          <div className="mt-2 w-full h-2 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-500"
              style={{ width: `${dailyStats.completionRate}%` }}
            />
          </div>
        </div>

        {/* זמן עבודה */}
        <div className="card p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border border-green-200 dark:border-green-700">
          <div className="text-3xl font-bold text-green-600 dark:text-green-400">
            {formatTime(dailyStats.totalTimeSpent)}
          </div>
          <div className="text-sm text-green-700 dark:text-green-300">עבדת היום</div>
          <div className="text-xs text-green-600 dark:text-green-400 mt-1">
            נשאר: {formatTime(dailyStats.totalEstimated)}
          </div>
        </div>

        {/* דיוק הערכות */}
        <div className="card p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border border-purple-200 dark:border-purple-700">
          <div className={`text-3xl font-bold ${
            dailyStats.accuracy >= 80 ? 'text-green-600 dark:text-green-400' :
            dailyStats.accuracy >= 60 ? 'text-yellow-600 dark:text-yellow-400' :
            'text-red-600 dark:text-red-400'
          }`}>
            {dailyStats.accuracy}%
          </div>
          <div className="text-sm text-purple-700 dark:text-purple-300">דיוק הערכות</div>
          <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
            {dailyStats.accuracy >= 80 ? '🎯 מצוין!' : 
             dailyStats.accuracy >= 60 ? '📈 טוב' : '⚠️ צריך שיפור'}
          </div>
        </div>

        {/* סיכום שבועי */}
        <div className="card p-4 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border border-orange-200 dark:border-orange-700">
          <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
            {weeklyStats.completed}/{weeklyStats.total}
          </div>
          <div className="text-sm text-orange-700 dark:text-orange-300">השבוע</div>
          <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
            {formatTime(weeklyStats.totalTimeSpent)} סה"כ
          </div>
        </div>
      </motion.div>

      {/* טאבים */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex gap-2 mb-6 overflow-x-auto pb-2"
      >
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </motion.div>

      {/* תוכן לפי טאב */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'today' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <DailySummaryCard 
                tasks={todayTasks} 
                stats={dailyStats}
                date={today}
              />
              <UpcomingTasks tasks={tasks} />
            </div>
          )}

          {activeTab === 'week' && (
            <WeeklySummaryCard 
              stats={weeklyStats}
              startOfWeek={startOfWeek}
              endOfWeek={endOfWeek}
            />
          )}

          {activeTab === 'insights' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <WorkPaceInsights tasks={tasks} />
              <SmartRecommendationsPanel tasks={tasks} />
            </div>
          )}

          {activeTab === 'interruptions' && (
            <InterruptionsTracker />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default ComprehensiveDashboard;

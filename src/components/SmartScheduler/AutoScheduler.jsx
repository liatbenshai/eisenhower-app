import { useState, useEffect, useMemo } from 'react';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../hooks/useAuth';
import { scheduleDay, scheduleWeek, getSchedulingRecommendations } from '../../utils/autoScheduler';
import { analyzeWorkPatterns } from '../../utils/smartRecommendations';
import { createTimeBlock } from '../../services/supabase';
import { format, startOfWeek, addDays } from 'date-fns';
import { he } from 'date-fns/locale';
import toast from 'react-hot-toast';
import Button from '../UI/Button';

/**
 * תכנון אוטומטי של היום והשבוע
 */
function AutoScheduler() {
  const { tasks, loadTasks } = useTasks();
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [schedule, setSchedule] = useState(null);
  const [workPatterns, setWorkPatterns] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('day'); // 'day' or 'week'
  const [showRecommendations, setShowRecommendations] = useState(false);

  // ניתוח דפוסי עבודה
  useEffect(() => {
    if (tasks && tasks.length > 0) {
      const patterns = analyzeWorkPatterns(tasks, []);
      setWorkPatterns(patterns);
    }
  }, [tasks]);

  // חישוב תכנון
  useEffect(() => {
    if (tasks && tasks.length > 0) {
      calculateSchedule();
    } else {
      // אם אין משימות, צור תכנון ריק
      if (viewMode === 'day') {
        setSchedule({
          scheduledBlocks: [],
          unscheduledTasks: [],
          totalScheduledTime: 0,
          utilizationRate: 0
        });
      } else {
        setSchedule({
          weekSchedule: {},
          summary: {
            totalScheduled: 0,
            totalUnscheduled: 0,
            totalTime: 0,
            averageUtilization: 0
          }
        });
      }
    }
  }, [selectedDate, tasks, workPatterns, viewMode]);

  const calculateSchedule = () => {
    try {
      console.log('📅 AutoScheduler: מחשב תכנון עבור', tasks.length, 'משימות');
      
      if (viewMode === 'day') {
        const daySchedule = scheduleDay(tasks, selectedDate, workPatterns, []);
        console.log('📅 תכנון יום:', daySchedule);
        setSchedule(daySchedule);
      } else {
        const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
        const weekSchedule = scheduleWeek(tasks, weekStart, workPatterns, []);
        console.log('📅 תכנון שבוע:', weekSchedule);
        setSchedule(weekSchedule);
      }
    } catch (err) {
      console.error('❌ שגיאה בחישוב תכנון:', err);
      toast.error('שגיאה בחישוב תכנון: ' + err.message);
      // צור תכנון ריק במקרה של שגיאה
      if (viewMode === 'day') {
        setSchedule({
          scheduledBlocks: [],
          unscheduledTasks: tasks,
          totalScheduledTime: 0,
          utilizationRate: 0
        });
      }
    }
  };

  // יישום תכנון
  const applySchedule = async () => {
    if (!user?.id || !schedule) return;

    setLoading(true);
    try {
      const blocksToCreate = viewMode === 'day' 
        ? schedule.scheduledBlocks 
        : Object.values(schedule.weekSchedule).flatMap(day => day.scheduledBlocks);

      let created = 0;
      for (const block of blocksToCreate) {
        try {
          await createTimeBlock({
            user_id: user.id,
            task_id: block.task_id || null,
            title: block.title,
            description: block.description || null,
            start_time: block.start_time,
            end_time: block.end_time
          });
          created++;
        } catch (err) {
          console.error('שגיאה ביצירת בלוק:', err);
        }
      }

      toast.success(`נוצרו ${created} בלוקי זמן`);
      await loadTasks();
    } catch (err) {
      console.error('שגיאה ביישום תכנון:', err);
      toast.error('שגיאה ביישום תכנון');
    } finally {
      setLoading(false);
    }
  };

  const recommendations = useMemo(() => {
    if (!schedule) return [];
    if (viewMode === 'day') {
      return getSchedulingRecommendations(schedule, tasks);
    }
    return [];
  }, [schedule, tasks, viewMode]);

  // טעינה
  if (!schedule) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent mx-auto"></div>
        <p className="mt-2 text-gray-500 dark:text-gray-400">מחשב תכנון...</p>
      </div>
    );
  }

  // אין משימות
  const activeTasks = tasks?.filter(t => !t.is_completed) || [];
  if (activeTasks.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            תכנון אוטומטי
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            המערכת מתכננת את היום/שבוע שלך לפי עדיפויות, אנרגיה ודפוסי עבודה
          </p>
        </div>
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <span className="text-4xl mb-4 block">📅</span>
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
            אין משימות פעילות לתכנן
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            הוסיפי משימות עם זמן משוער כדי שהמערכת תוכל לתכנן אותן
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* כותרת ובקרות */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            תכנון אוטומטי
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            המערכת מתכננת את היום/שבוע שלך לפי עדיפויות, אנרגיה ודפוסי עבודה
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setViewMode(viewMode === 'day' ? 'week' : 'day')}
            variant="secondary"
            size="sm"
          >
            {viewMode === 'day' ? 'תצוגת שבוע' : 'תצוגת יום'}
          </Button>
          <Button
            onClick={applySchedule}
            loading={loading}
            disabled={loading}
          >
            יישם תכנון
          </Button>
        </div>
      </div>

      {/* המלצות */}
      {recommendations.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-yellow-800 dark:text-yellow-200">
              💡 המלצות
            </h3>
            <button
              onClick={() => setShowRecommendations(!showRecommendations)}
              className="text-sm text-yellow-600 dark:text-yellow-400 hover:underline"
            >
              {showRecommendations ? 'הסתר' : 'הצג'}
            </button>
          </div>
          {showRecommendations && (
            <div className="space-y-2 mt-2">
              {recommendations.map((rec, idx) => (
                <div key={idx} className="text-sm text-yellow-700 dark:text-yellow-300">
                  • {rec.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* תצוגת יום */}
      {viewMode === 'day' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {format(selectedDate, 'EEEE, d MMMM yyyy', { locale: he })}
              </h3>
              <div className="flex gap-2">
                <Button
                  onClick={() => setSelectedDate(addDays(selectedDate, -1))}
                  variant="secondary"
                  size="sm"
                >
                  ← יום קודם
                </Button>
                <Button
                  onClick={() => setSelectedDate(new Date())}
                  variant="secondary"
                  size="sm"
                >
                  היום
                </Button>
                <Button
                  onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                  variant="secondary"
                  size="sm"
                >
                  יום הבא →
                </Button>
              </div>
            </div>

            {/* סטטיסטיקות */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                <div className="text-sm text-gray-600 dark:text-gray-400">מתוכנן</div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {schedule.scheduledBlocks.length}
                </div>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3">
                <div className="text-sm text-gray-600 dark:text-gray-400">לא מתוכנן</div>
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {schedule.unscheduledTasks.length}
                </div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                <div className="text-sm text-gray-600 dark:text-gray-400">ניצול זמן</div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {schedule.utilizationRate}%
                </div>
              </div>
            </div>

            {/* בלוקים מתוכננים */}
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                בלוקים מתוכננים
              </h4>
              {schedule.scheduledBlocks.length > 0 ? (
                schedule.scheduledBlocks.map((block, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {block.title}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {format(new Date(block.start_time), 'HH:mm', { locale: he })} -{' '}
                        {format(new Date(block.end_time), 'HH:mm', { locale: he })}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {block.category && `📁 ${block.category}`}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                  אין בלוקים מתוכננים
                </p>
              )}
            </div>

            {/* משימות לא מתוכננות */}
            {schedule.unscheduledTasks.length > 0 && (
              <div className="mt-4 space-y-2">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                  משימות שלא נכנסו לתכנון
                </h4>
                {schedule.unscheduledTasks.map((task, idx) => (
                  <div
                    key={idx}
                    className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded border border-orange-200 dark:border-orange-800 text-sm text-orange-800 dark:text-orange-200"
                  >
                    {task.title}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* תצוגת שבוע */}
      {viewMode === 'week' && schedule.weekSchedule && (
        <div className="space-y-4">
          {Object.entries(schedule.weekSchedule).map(([dateStr, daySchedule]) => (
            <div
              key={dateStr}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {format(new Date(dateStr), 'EEEE, d MMMM', { locale: he })}
                </h3>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {daySchedule.scheduledBlocks.length} מתוכנן | {daySchedule.unscheduledTasks.length} לא מתוכנן
                </div>
              </div>
              <div className="space-y-1">
                {daySchedule.scheduledBlocks.slice(0, 3).map((block, idx) => (
                  <div key={idx} className="text-sm text-gray-700 dark:text-gray-300">
                    {format(new Date(block.start_time), 'HH:mm')} - {block.title}
                  </div>
                ))}
                {daySchedule.scheduledBlocks.length > 3 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    +{daySchedule.scheduledBlocks.length - 3} נוספים
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AutoScheduler;


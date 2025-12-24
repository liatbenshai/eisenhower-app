import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../hooks/useAuth';
import Button from '../UI/Button';
import toast from 'react-hot-toast';

/**
 * סוגי הפרעות
 */
const INTERRUPTION_TYPES = {
  client_call: { id: 'client_call', name: 'שיחת לקוח', icon: '📞', color: 'blue' },
  phone_call: { id: 'phone_call', name: 'טלפון', icon: '📱', color: 'green' },
  distraction: { id: 'distraction', name: 'הסחת דעת', icon: '🎯', color: 'orange' },
  break: { id: 'break', name: 'הפסקה', icon: '☕', color: 'yellow' },
  urgent: { id: 'urgent', name: 'משימה דחופה', icon: '🚨', color: 'red' },
  other: { id: 'other', name: 'אחר', icon: '❓', color: 'gray' }
};

/**
 * טיימר עם תמיכה בהפרעות
 * הזמן של ההפרעות נספר בנפרד ולא מתווסף לזמן המשימה
 */
function TaskTimerWithInterruptions({ task, onUpdate, onComplete }) {
  const { updateTaskTime, tasks } = useTasks();
  const { user } = useAuth();

  // קבלת המשימה העדכנית
  const currentTask = useMemo(() => {
    if (!task || !task.id) return null;
    return tasks.find(t => t.id === task.id) || task;
  }, [tasks, task?.id]);

  // State
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [targetMinutes, setTargetMinutes] = useState(30);
  
  // State להפרעות
  const [isInterrupted, setIsInterrupted] = useState(false);
  const [interruptionType, setInterruptionType] = useState(null);
  const [interruptionStart, setInterruptionStart] = useState(null);
  const [interruptionSeconds, setInterruptionSeconds] = useState(0);
  const [totalInterruptionSeconds, setTotalInterruptionSeconds] = useState(0);
  const [interruptions, setInterruptions] = useState([]);
  const [showInterruptionMenu, setShowInterruptionMenu] = useState(false);

  // Refs
  const intervalRef = useRef(null);
  const interruptionIntervalRef = useRef(null);
  const savingRef = useRef(false);

  // מפתח localStorage
  const timerStorageKey = currentTask ? `timer_v2_${currentTask.id}` : null;

  // חישובים
  const timeSpent = currentTask?.time_spent ? parseInt(currentTask.time_spent) : 0;
  const estimated = currentTask?.estimated_duration ? parseInt(currentTask.estimated_duration) : 0;
  const currentSessionMinutes = Math.floor(elapsedSeconds / 60);
  const totalSpent = timeSpent + currentSessionMinutes;
  const progress = targetMinutes > 0
    ? Math.min(100, Math.round((currentSessionMinutes / targetMinutes) * 100))
    : 0;

  // עדכון targetMinutes
  useEffect(() => {
    if (currentTask?.estimated_duration) {
      setTargetMinutes(currentTask.estimated_duration);
    }
  }, [currentTask?.estimated_duration]);

  // טעינת state מ-localStorage
  useEffect(() => {
    if (currentTask?.id && timerStorageKey) {
      const saved = localStorage.getItem(timerStorageKey);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          if (data.startTime && !data.isInterrupted) {
            const start = new Date(data.startTime);
            const elapsed = Math.floor((new Date() - start) / 1000);
            if (elapsed > 0 && elapsed < 24 * 60 * 60) { // פחות מ-24 שעות
              setStartTime(start);
              setElapsedSeconds(elapsed);
              setIsRunning(true);
              setTotalInterruptionSeconds(data.totalInterruptionSeconds || 0);
              setInterruptions(data.interruptions || []);
              toast.success(`⏰ טיימר חודש! עברו ${Math.floor(elapsed / 60)} דקות`);
            }
          }
        } catch (err) {
          console.error('שגיאה בטעינת טיימר:', err);
        }
      }
    }
  }, [currentTask?.id, timerStorageKey]);

  // שמירה ב-localStorage
  const saveToStorage = useCallback(() => {
    if (timerStorageKey) {
      const data = {
        startTime: startTime?.toISOString(),
        isRunning,
        isInterrupted,
        interruptionType,
        interruptionStart: interruptionStart?.toISOString(),
        totalInterruptionSeconds,
        interruptions
      };
      localStorage.setItem(timerStorageKey, JSON.stringify(data));
    }
  }, [timerStorageKey, startTime, isRunning, isInterrupted, interruptionType, interruptionStart, totalInterruptionSeconds, interruptions]);

  useEffect(() => {
    saveToStorage();
  }, [saveToStorage]);

  // טיימר ראשי - עבודה
  useEffect(() => {
    if (isRunning && !isInterrupted) {
      intervalRef.current = setInterval(() => {
        if (startTime) {
          const now = new Date();
          const elapsed = Math.floor((now - startTime) / 1000) - totalInterruptionSeconds;
          setElapsedSeconds(Math.max(0, elapsed));
        }
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, isInterrupted, startTime, totalInterruptionSeconds]);

  // טיימר הפרעה
  useEffect(() => {
    if (isInterrupted && interruptionStart) {
      interruptionIntervalRef.current = setInterval(() => {
        const now = new Date();
        const elapsed = Math.floor((now - interruptionStart) / 1000);
        setInterruptionSeconds(elapsed);
      }, 1000);
    } else {
      if (interruptionIntervalRef.current) {
        clearInterval(interruptionIntervalRef.current);
        interruptionIntervalRef.current = null;
      }
    }
    return () => {
      if (interruptionIntervalRef.current) clearInterval(interruptionIntervalRef.current);
    };
  }, [isInterrupted, interruptionStart]);

  // התחלת עבודה
  const startTimer = () => {
    const now = new Date();
    setStartTime(now);
    setIsRunning(true);
    setIsPaused(false);
    setElapsedSeconds(0);
    toast.success('▶ התחלנו לעבוד!');
  };

  // השהיה
  const pauseTimer = () => {
    setIsRunning(false);
    setIsPaused(true);
    toast('⏸ טיימר מושהה');
  };

  // המשך
  const resumeTimer = () => {
    setIsRunning(true);
    setIsPaused(false);
    toast.success('▶ ממשיכים!');
  };

  // התחלת הפרעה
  const startInterruption = (type) => {
    setIsInterrupted(true);
    setInterruptionType(type);
    setInterruptionStart(new Date());
    setInterruptionSeconds(0);
    setShowInterruptionMenu(false);
    toast(`⏸ ${INTERRUPTION_TYPES[type].icon} ${INTERRUPTION_TYPES[type].name}`);
  };

  // סיום הפרעה
  const endInterruption = () => {
    if (!isInterrupted || !interruptionStart) return;

    const duration = Math.ceil(interruptionSeconds / 60); // בדקות
    
    // שמירת ההפרעה
    const newInterruption = {
      type: interruptionType,
      duration,
      startTime: interruptionStart.toISOString(),
      endTime: new Date().toISOString()
    };
    setInterruptions(prev => [...prev, newInterruption]);
    
    // עדכון סה"כ זמן הפרעות
    setTotalInterruptionSeconds(prev => prev + interruptionSeconds);
    
    // איפוס
    setIsInterrupted(false);
    setInterruptionType(null);
    setInterruptionStart(null);
    setInterruptionSeconds(0);

    toast.success(`✅ חזרנו לעבודה! (${duration} דק' הפרעה)`);
  };

  // שמירת התקדמות
  const saveProgress = async (reset = false) => {
    if (savingRef.current) return;
    savingRef.current = true;

    const minutesToAdd = Math.floor(elapsedSeconds / 60);
    if (minutesToAdd < 1) {
      savingRef.current = false;
      return { success: false, reason: 'less_than_minute' };
    }

    try {
      const newTimeSpent = timeSpent + minutesToAdd;
      await updateTaskTime(currentTask.id, newTimeSpent);

      // שמירת היסטוריית הפרעות
      if (user?.id && interruptions.length > 0) {
        const storedInterruptions = JSON.parse(
          localStorage.getItem(`interruptions_${user.id}`) || '[]'
        );
        const today = new Date().toISOString().split('T')[0];
        const newInterruptions = interruptions.map(i => ({
          ...i,
          id: Date.now().toString() + Math.random(),
          date: today,
          taskId: currentTask.id,
          taskTitle: currentTask.title
        }));
        localStorage.setItem(
          `interruptions_${user.id}`,
          JSON.stringify([...newInterruptions, ...storedInterruptions])
        );
      }

      if (reset) {
        resetTimer();
      }

      savingRef.current = false;
      return { success: true, minutesToAdd, newTimeSpent };
    } catch (err) {
      console.error('שגיאה בשמירה:', err);
      savingRef.current = false;
      return { success: false, error: err };
    }
  };

  // איפוס
  const resetTimer = () => {
    setIsRunning(false);
    setIsPaused(false);
    setElapsedSeconds(0);
    setStartTime(null);
    setIsInterrupted(false);
    setInterruptionType(null);
    setInterruptionStart(null);
    setInterruptionSeconds(0);
    setTotalInterruptionSeconds(0);
    setInterruptions([]);
    if (timerStorageKey) {
      localStorage.removeItem(timerStorageKey);
    }
  };

  // עצירה ושמירה
  const stopAndSave = async () => {
    const result = await saveProgress(true);
    if (result?.success) {
      toast.success(`💾 נשמר! ${result.minutesToAdd} דקות נוספו`);
    }
  };

  // פורמט זמן
  const formatSeconds = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatMinutes = (minutes) => {
    if (!minutes) return '0 דק\'';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} דק'`;
    if (mins === 0) return `${hours}:00`;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  };

  if (!currentTask) {
    return (
      <div className="p-4 text-center text-gray-500">
        בחרי משימה להתחיל
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* כותרת */}
      <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
        <h4 className="font-medium text-gray-900 dark:text-white truncate">
          {currentTask.title}
        </h4>
        <div className="flex gap-2 text-xs text-gray-500 mt-1">
          <span>יעד: {formatMinutes(targetMinutes)}</span>
          <span>•</span>
          <span>עבדת: {formatMinutes(totalSpent)}</span>
          {totalInterruptionSeconds > 0 && (
            <>
              <span>•</span>
              <span className="text-orange-500">
                הפרעות: {formatMinutes(Math.floor(totalInterruptionSeconds / 60))}
              </span>
            </>
          )}
        </div>
      </div>

      {/* טיימר */}
      <div className="p-6">
        {/* תצוגת הפרעה */}
        <AnimatePresence>
          {isInterrupted && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-4 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-xl"
            >
              <div className="text-center mb-3">
                <span className="text-3xl">
                  {INTERRUPTION_TYPES[interruptionType]?.icon || '⏸'}
                </span>
                <div className="text-sm font-medium text-orange-700 dark:text-orange-300 mt-1">
                  {INTERRUPTION_TYPES[interruptionType]?.name || 'הפרעה'}
                </div>
              </div>
              <div className="text-4xl font-mono font-bold text-center text-orange-600 dark:text-orange-400 mb-3">
                {formatSeconds(interruptionSeconds)}
              </div>
              <Button
                onClick={endInterruption}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white"
              >
                ▶ חזור לעבודה
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* תצוגת טיימר רגיל */}
        {!isInterrupted && (
          <>
            {/* פס התקדמות */}
            <div className="mb-4">
              <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-blue-400 to-blue-600"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>{progress}%</span>
                <span>{formatMinutes(targetMinutes - currentSessionMinutes)} נותר</span>
              </div>
            </div>

            {/* זמן */}
            <div className="text-center mb-4">
              <div className={`text-5xl font-mono font-bold ${
                isRunning 
                  ? 'text-blue-600 dark:text-blue-400' 
                  : 'text-gray-600 dark:text-gray-400'
              }`}>
                {formatSeconds(elapsedSeconds)}
              </div>
            </div>

            {/* כפתורים ראשיים */}
            <div className="space-y-2">
              {!isRunning && !isPaused && (
                <Button
                  onClick={startTimer}
                  className="w-full bg-green-500 hover:bg-green-600 text-white text-lg py-3"
                >
                  ▶ התחל עבודה
                </Button>
              )}

              {isRunning && (
                <div className="flex gap-2">
                  <Button
                    onClick={pauseTimer}
                    className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white"
                  >
                    ⏸ השהה
                  </Button>
                  <Button
                    onClick={stopAndSave}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                  >
                    ⏹ עצור
                  </Button>
                </div>
              )}

              {isPaused && (
                <>
                  <Button
                    onClick={resumeTimer}
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white text-lg py-3"
                  >
                    ▶ המשך עבודה
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      onClick={stopAndSave}
                      className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                    >
                      💾 שמור
                    </Button>
                    <Button
                      onClick={resetTimer}
                      variant="secondary"
                      className="flex-1"
                    >
                      🔄 איפוס
                    </Button>
                  </div>
                </>
              )}

              {/* כפתור הפרעה */}
              {(isRunning || isPaused) && elapsedSeconds > 0 && (
                <div className="relative">
                  <Button
                    onClick={() => setShowInterruptionMenu(!showInterruptionMenu)}
                    variant="secondary"
                    className="w-full mt-2 border-orange-200 text-orange-600 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400"
                  >
                    📞 לקוח מתקשר / הפרעה
                  </Button>

                  {/* תפריט הפרעות */}
                  <AnimatePresence>
                    {showInterruptionMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute bottom-full left-0 right-0 mb-2 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10"
                      >
                        <div className="text-xs text-gray-500 mb-2 text-center">
                          בחר סוג הפרעה:
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {Object.values(INTERRUPTION_TYPES).map(type => (
                            <button
                              key={type.id}
                              onClick={() => startInterruption(type.id)}
                              className="p-2 text-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                              <span className="text-xl block">{type.icon}</span>
                              <span className="text-xs text-gray-600 dark:text-gray-400">
                                {type.name}
                              </span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </>
        )}

        {/* היסטוריית הפרעות */}
        {interruptions.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 mb-2">הפרעות בסשן זה:</div>
            <div className="flex flex-wrap gap-1">
              {interruptions.map((int, i) => (
                <span 
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 dark:bg-orange-900/20 rounded text-xs text-orange-700 dark:text-orange-300"
                >
                  {INTERRUPTION_TYPES[int.type]?.icon} {int.duration} דק'
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* טיפ */}
      {isRunning && (
        <div className="px-4 pb-4 text-xs text-center text-gray-500">
          💡 לחיצה על "לקוח מתקשר" תעצור את הטיימר בלי לספור את הזמן
        </div>
      )}
    </div>
  );
}

export default TaskTimerWithInterruptions;

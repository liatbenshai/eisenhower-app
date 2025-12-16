import { useState, useEffect, useRef } from 'react';
import { updateTask, updateSubtaskProgress } from '../../services/supabase';
import toast from 'react-hot-toast';
import Button from '../UI/Button';

/**
 * טיימר למשימה - פרומדורו
 */
function TaskTimer({ task, onUpdate }) {
  if (!task || !task.id) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          אין משימה זמינה
        </p>
      </div>
    );
  }
  
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [timerMode, setTimerMode] = useState('work'); // 'work' or 'break'
  const [pomodoroMinutes, setPomodoroMinutes] = useState(25);
  const intervalRef = useRef(null);
  
  const timeSpent = (task && task.time_spent) ? parseInt(task.time_spent) : 0;
  const estimated = (task && task.estimated_duration) ? parseInt(task.estimated_duration) : 0;
  const totalSpent = timeSpent + Math.floor(elapsedSeconds / 60);
  const progress = estimated > 0 
    ? Math.min(100, Math.round((totalSpent / estimated) * 100))
    : 0;
  
  // בדיקה אם זו משימת שלב
  const isSubtask = !!task.parent_task_id;
  
  // עדכון זמן כל שנייה
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning]);
  
  // שמירה אוטומטית כל 5 דקות
  useEffect(() => {
    if (isRunning && elapsedSeconds > 0 && elapsedSeconds % 300 === 0) {
      saveProgress();
    }
  }, [elapsedSeconds, isRunning]);
  
  // בדיקת סיום פרומדורו
  useEffect(() => {
    if (isRunning && timerMode === 'work') {
      const workSeconds = pomodoroMinutes * 60;
      if (elapsedSeconds >= workSeconds) {
        setIsRunning(false);
        toast.success('🎉 פרומדורו הושלם! זמן להפסקה');
        setTimerMode('break');
        setElapsedSeconds(0);
        saveProgress();
      }
    } else if (isRunning && timerMode === 'break') {
      const breakSeconds = 5 * 60; // 5 דקות הפסקה
      if (elapsedSeconds >= breakSeconds) {
        setIsRunning(false);
        toast.success('✅ הפסקה הסתיימה! מוכנים לעבודה');
        setTimerMode('work');
        setElapsedSeconds(0);
      }
    }
  }, [elapsedSeconds, isRunning, timerMode, pomodoroMinutes]);
  
  const startTimer = () => {
    setStartTime(new Date());
    setIsRunning(true);
    toast.success('טיימר הופעל');
  };
  
  const stopTimer = async () => {
    setIsRunning(false);
    if (elapsedSeconds > 0) {
      await saveProgress();
    }
    setElapsedSeconds(0);
    setStartTime(null);
  };
  
  const saveProgress = async () => {
    try {
      const minutesToAdd = Math.floor(elapsedSeconds / 60);
      if (minutesToAdd > 0 && task && task.id) {
        const newTimeSpent = timeSpent + minutesToAdd;
        
        // אם זו משימת שלב, עדכן את ה-subtask
        if (isSubtask && task.subtask_id) {
          await updateSubtaskProgress(task.subtask_id, newTimeSpent);
        } else {
          // אחרת, עדכן את המשימה הרגילה
          await updateTask(task.id, { time_spent: newTimeSpent });
        }
        
        setElapsedSeconds(0);
        if (onUpdate) onUpdate();
        toast.success(`נוסף ${minutesToAdd} דקות`);
      }
    } catch (err) {
      console.error('שגיאה בשמירת התקדמות:', err);
      toast.error(err.message || 'שגיאה בשמירת התקדמות');
    }
  };
  
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };
  
  const remainingSeconds = timerMode === 'work' 
    ? (pomodoroMinutes * 60) - elapsedSeconds
    : (5 * 60) - elapsedSeconds;
  
  const displayTime = timerMode === 'work' ? remainingSeconds : elapsedSeconds;
  
  return (
    <div className={`p-4 rounded-lg border-2 ${
      timerMode === 'work'
        ? 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800'
        : 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {timerMode === 'work' ? '⏱️ טיימר עבודה' : '☕ הפסקה'}
        </h3>
        {estimated > 0 && timerMode === 'work' && (
          <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
            {progress}%
          </span>
        )}
      </div>
      
      {/* מצב פרומדורו */}
      {timerMode === 'work' && (
        <div className="mb-2">
          <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">
            משך פרומדורו:
          </label>
          <select
            value={pomodoroMinutes}
            onChange={(e) => setPomodoroMinutes(parseInt(e.target.value))}
            disabled={isRunning}
            className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
          >
            <option value={15}>15 דקות</option>
            <option value={25}>25 דקות (קלאסי)</option>
            <option value={45}>45 דקות</option>
            <option value={60}>60 דקות</option>
          </select>
        </div>
      )}
      
      {/* תצוגת זמן */}
      <div className="text-center mb-4">
        <div className={`text-4xl font-bold mb-1 ${
          timerMode === 'work' 
            ? 'text-gray-900 dark:text-white' 
            : 'text-green-700 dark:text-green-300'
        }`}>
          {formatTime(timerMode === 'work' ? displayTime : displayTime)}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {timerMode === 'work' && timeSpent > 0 && (
            <span>סה"כ היום: {timeSpent} דקות</span>
          )}
          {timerMode === 'work' && estimated > 0 && (
            <span className="mr-2">• משוער: {estimated} דקות</span>
          )}
          {timerMode === 'break' && (
            <span>הפסקה של 5 דקות</span>
          )}
        </div>
      </div>
      
      {/* פס התקדמות */}
      {estimated > 0 && timerMode === 'work' && (
        <div className="mb-4">
          <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                progress >= 100 
                  ? 'bg-green-500' 
                  : progress >= 75 
                  ? 'bg-blue-500' 
                  : progress >= 50 
                  ? 'bg-yellow-500' 
                  : 'bg-orange-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
      
      {/* פס התקדמות פרומדורו */}
      {timerMode === 'work' && (
        <div className="mb-4">
          <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${Math.min(100, (elapsedSeconds / (pomodoroMinutes * 60)) * 100)}%` }}
            />
          </div>
        </div>
      )}
      
      {/* כפתורי שליטה */}
      <div className="flex gap-2">
        {!isRunning ? (
          <Button
            onClick={startTimer}
            className={`flex-1 text-white ${
              timerMode === 'work'
                ? 'bg-green-500 hover:bg-green-600'
                : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            ▶ {timerMode === 'work' ? 'התחל עבודה' : 'התחל הפסקה'}
          </Button>
        ) : (
          <Button
            onClick={stopTimer}
            className="flex-1 bg-red-500 hover:bg-red-600 text-white"
          >
            ⏸ עצור
          </Button>
        )}
        {elapsedSeconds > 0 && !isRunning && timerMode === 'work' && (
          <Button
            onClick={saveProgress}
            className="bg-blue-500 hover:bg-blue-600 text-white"
          >
            💾 שמור
          </Button>
        )}
        {timerMode === 'break' && (
          <Button
            onClick={() => {
              setTimerMode('work');
              setElapsedSeconds(0);
            }}
            className="bg-gray-500 hover:bg-gray-600 text-white"
          >
            חזור לעבודה
          </Button>
        )}
      </div>
      
      {isRunning && timerMode === 'work' && (
        <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-2">
          הטיימר שומר אוטומטית כל 5 דקות • בסיום פרומדורו תתקבל הודעה
        </p>
      )}
    </div>
  );
}

export default TaskTimer;


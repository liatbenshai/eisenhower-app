import { useState, useEffect, useRef } from 'react';
import { updateTask } from '../../services/supabase';
import toast from 'react-hot-toast';
import Button from '../UI/Button';

/**
 * טיימר למשימה
 */
function TaskTimer({ task, onUpdate }) {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const intervalRef = useRef(null);
  
  const timeSpent = task.time_spent || 0;
  const estimated = task.estimated_duration || 0;
  const totalSpent = timeSpent + Math.floor(elapsedSeconds / 60);
  const progress = estimated > 0 
    ? Math.min(100, Math.round((totalSpent / estimated) * 100))
    : 0;
  
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
      if (minutesToAdd > 0) {
        const newTimeSpent = timeSpent + minutesToAdd;
        await updateTask(task.id, { time_spent: newTimeSpent });
        setElapsedSeconds(0);
        if (onUpdate) onUpdate();
        toast.success(`נוסף ${minutesToAdd} דקות`);
      }
    } catch (err) {
      console.error('שגיאה בשמירת התקדמות:', err);
      toast.error('שגיאה בשמירת התקדמות');
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
  
  return (
    <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border-2 border-blue-200 dark:border-blue-800">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          טיימר עבודה
        </h3>
        {estimated > 0 && (
          <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
            {progress}%
          </span>
        )}
      </div>
      
      {/* תצוגת זמן */}
      <div className="text-center mb-4">
        <div className="text-4xl font-bold text-gray-900 dark:text-white mb-1">
          {formatTime(elapsedSeconds)}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {timeSpent > 0 && (
            <span>סה"כ: {timeSpent} דקות</span>
          )}
          {estimated > 0 && (
            <span className="mr-2">• משוער: {estimated} דקות</span>
          )}
        </div>
      </div>
      
      {/* פס התקדמות */}
      {estimated > 0 && (
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
      
      {/* כפתורי שליטה */}
      <div className="flex gap-2">
        {!isRunning ? (
          <Button
            onClick={startTimer}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white"
          >
            ▶ התחל
          </Button>
        ) : (
          <Button
            onClick={stopTimer}
            className="flex-1 bg-red-500 hover:bg-red-600 text-white"
          >
            ⏸ עצור ושמור
          </Button>
        )}
        {elapsedSeconds > 0 && !isRunning && (
          <Button
            onClick={saveProgress}
            className="bg-blue-500 hover:bg-blue-600 text-white"
          >
            💾 שמור
          </Button>
        )}
      </div>
      
      {isRunning && (
        <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-2">
          הטיימר שומר אוטומטית כל 5 דקות
        </p>
      )}
    </div>
  );
}

export default TaskTimer;


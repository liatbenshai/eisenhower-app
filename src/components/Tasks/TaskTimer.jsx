import { useState, useEffect, useRef } from 'react';
import { updateTask, updateSubtaskProgress } from '../../services/supabase';
import toast from 'react-hot-toast';
import Button from '../UI/Button';

/**
 * טיימר למשימה - פרומדורו
 */
function TaskTimer({ task, onUpdate, onComplete }) {
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
  const [targetMinutes, setTargetMinutes] = useState(task.estimated_duration || 30); // זמן יעד
  const [hasReachedTarget, setHasReachedTarget] = useState(false);
  const intervalRef = useRef(null);
  const audioRef = useRef(null);
  
  const timeSpent = (task && task.time_spent) ? parseInt(task.time_spent) : 0;
  const estimated = (task && task.estimated_duration) ? parseInt(task.estimated_duration) : 0;
  const currentSessionMinutes = Math.floor(elapsedSeconds / 60);
  const totalSpent = timeSpent + currentSessionMinutes;
  
  // חישוב זמן נותר
  const remainingMinutes = targetMinutes - currentSessionMinutes;
  const isTargetReached = currentSessionMinutes >= targetMinutes;
  
  const progress = targetMinutes > 0 
    ? Math.min(100, Math.round((currentSessionMinutes / targetMinutes) * 100))
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
      saveProgress(false); // שמירה אוטומטית בלי איפוס
    }
  }, [elapsedSeconds, isRunning]);
  
  // בדיקת הגעה ליעד זמן
  useEffect(() => {
    if (isRunning && targetMinutes > 0 && !hasReachedTarget) {
      const targetSeconds = targetMinutes * 60;
      if (elapsedSeconds >= targetSeconds) {
        setHasReachedTarget(true);
        setIsRunning(false);
        playAlarm();
        toast.success(`⏰ הגעת ליעד של ${targetMinutes} דקות!`, {
          duration: 5000,
          icon: '🎉'
        });
        // שמירה אוטומטית
        saveProgress(false);
      }
    }
  }, [elapsedSeconds, isRunning, targetMinutes, hasReachedTarget]);
  
  // צפצוף/התראה
  const playAlarm = () => {
    try {
      // יצירת צליל צפצוף
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 1);
      
      // חזרה על הצפצוף 3 פעמים
      setTimeout(() => {
        const oscillator2 = audioContext.createOscillator();
        const gainNode2 = audioContext.createGain();
        oscillator2.connect(gainNode2);
        gainNode2.connect(audioContext.destination);
        oscillator2.frequency.value = 800;
        oscillator2.type = 'sine';
        gainNode2.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1);
        oscillator2.start(audioContext.currentTime);
        oscillator2.stop(audioContext.currentTime + 1);
      }, 500);
      
      setTimeout(() => {
        const oscillator3 = audioContext.createOscillator();
        const gainNode3 = audioContext.createGain();
        oscillator3.connect(gainNode3);
        gainNode3.connect(audioContext.destination);
        oscillator3.frequency.value = 800;
        oscillator3.type = 'sine';
        gainNode3.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode3.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1);
        oscillator3.start(audioContext.currentTime);
        oscillator3.stop(audioContext.currentTime + 1);
      }, 1000);
    } catch (err) {
      console.error('שגיאה בהשמעת צפצוף:', err);
    }
  };
  
  const startTimer = () => {
    if (hasReachedTarget) {
      // התחלה מחדש אחרי שהגענו ליעד
      setElapsedSeconds(0);
      setHasReachedTarget(false);
    }
    setStartTime(new Date());
    setIsRunning(true);
    toast.success('טיימר הופעל');
  };
  
  const pauseTimer = () => {
    setIsRunning(false);
    toast.success('טיימר הושהה - יכול לעבור למשימה אחרת');
  };
  
  const stopTimer = async () => {
    setIsRunning(false);
    if (elapsedSeconds > 0) {
      await saveProgress(true); // שמירה עם איפוס
      toast.success('🎯 הטיימר נעצר. עכשיו אפשר לסמן את המשימה כהושלמה!', {
        duration: 4000
      });
    }
    setElapsedSeconds(0);
    setStartTime(null);
  };
  
  const resetTimer = () => {
    setIsRunning(false);
    setElapsedSeconds(0);
    setHasReachedTarget(false);
    setStartTime(null);
  };
  
  const saveProgress = async (reset = false) => {
    try {
      const minutesToAdd = Math.floor(elapsedSeconds / 60);
      if (minutesToAdd > 0 && task && task.id) {
        const newTimeSpent = timeSpent + minutesToAdd;
        
        // עדכון המשימה
        await updateTask(task.id, { time_spent: newTimeSpent });
        
        // אם יש subtask_id, עדכן גם את ה-subtask table
        if (task.subtask_id) {
          await updateSubtaskProgress(task.subtask_id, newTimeSpent);
        }
        
        if (reset) {
          setElapsedSeconds(0);
        }
        // עדכון רק אם יש callback - אבל זה לא יסגור את הכרטיס
        if (onUpdate) {
          onUpdate();
        }
        toast.success(`✅ נשמר! ${minutesToAdd} דקות נוספו. סה"כ: ${newTimeSpent} דקות`, {
          duration: 3000,
          icon: '💾'
        });
      } else if (minutesToAdd === 0) {
        toast('עבדת פחות מדקה - לא נשמר', { icon: '⏱️' });
      }
    } catch (err) {
      console.error('שגיאה בשמירת התקדמות:', err);
      toast.error(err.message || 'שגיאה בשמירת התקדמות');
    }
  };
  
  const continueAfterTarget = () => {
    setHasReachedTarget(false);
    setElapsedSeconds(0);
    setIsRunning(true);
    toast.success('ממשיכים לעבוד!');
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
  
  const displayTime = isTargetReached ? elapsedSeconds : (targetMinutes * 60 - elapsedSeconds);
  
  return (
    <div className={`p-4 rounded-lg border-2 ${
      hasReachedTarget
        ? 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-300 dark:border-green-700 animate-pulse'
        : 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          ⏱️ טיימר עבודה
        </h3>
        {hasReachedTarget && (
          <span className="text-xs font-bold text-green-600 dark:text-green-400 animate-bounce">
            🎉 הושלם!
          </span>
        )}
      </div>
      
      {/* הגדרת זמן יעד */}
      {!isRunning && !hasReachedTarget && (
        <div className="mb-3">
          <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">
            זמן יעד (דקות):
          </label>
          <input
            type="number"
            value={targetMinutes}
            onChange={(e) => setTargetMinutes(parseInt(e.target.value) || 30)}
            min="1"
            max="240"
            className="text-sm px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 w-full"
            placeholder="30"
          />
        </div>
      )}
      
      {/* תצוגת זמן */}
      <div className="text-center mb-4">
        <div className={`text-5xl font-bold mb-1 ${
          hasReachedTarget
            ? 'text-green-600 dark:text-green-400'
            : remainingMinutes <= 5 && isRunning
            ? 'text-red-600 dark:text-red-400'
            : 'text-gray-900 dark:text-white'
        }`}>
          {formatTime(Math.abs(displayTime))}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
          {!hasReachedTarget && isRunning && (
            <div>
              {remainingMinutes > 0 ? (
                <span className="text-orange-600 dark:text-orange-400 font-medium">
                  נותרו {remainingMinutes} דקות
                </span>
              ) : (
                <span className="text-red-600 dark:text-red-400 font-bold">
                  עברת את היעד!
                </span>
              )}
            </div>
          )}
          <div>
            <span className="font-medium">סה"כ עבדת: {totalSpent} דקות</span>
            {estimated > 0 && (
              <span className="mr-2">• משוער: {estimated} דקות</span>
            )}
          </div>
          {currentSessionMinutes > 0 && (
            <div>
              <span>הסשן הנוכחי: {currentSessionMinutes} דקות</span>
            </div>
          )}
        </div>
      </div>
      
      {/* פס התקדמות */}
      {targetMinutes > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-600 dark:text-gray-400">התקדמות ליעד</span>
            <span className={`font-medium ${
              progress >= 100
                ? 'text-green-600 dark:text-green-400'
                : progress >= 75
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400'
            }`}>
              {progress}%
            </span>
          </div>
          <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
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
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
        </div>
      )}
      
      {/* כפתורי שליטה */}
      <div className="space-y-2">
        {hasReachedTarget ? (
          <div className="space-y-2">
            <div className="text-center p-3 bg-green-100 dark:bg-green-900/30 rounded-lg border-2 border-green-300 dark:border-green-700">
              <p className="text-sm font-bold text-green-700 dark:text-green-300 mb-2">
                🎉 הגעת ליעד של {targetMinutes} דקות!
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                סה"כ עבדת: {totalSpent} דקות
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={continueAfterTarget}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
              >
                ▶ המשך לעבוד
              </Button>
              <Button
                onClick={async () => {
                  await saveProgress(true);
                  resetTimer();
                }}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white"
              >
                💾 שמור וסיים
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {/* כפתורים עיקריים */}
            <div className="flex gap-2">
              {!isRunning ? (
                <Button
                  onClick={startTimer}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                >
                  ▶ התחל עבודה
                </Button>
              ) : (
                <>
                  <Button
                    onClick={pauseTimer}
                    className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white"
                    title="השהה את הטיימר בלי לשמור - תוכל לעבור למשימה אחרת"
                  >
                    ⏸ השהה
                  </Button>
                  <Button
                    onClick={stopTimer}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                    title="עצור ושמור את הזמן שעבדת"
                  >
                    ⏹ עצור ושמור
                  </Button>
                </>
              )}
            </div>
            
            {/* כפתורים משניים */}
            {elapsedSeconds > 0 && !isRunning && (
              <div className="space-y-2">
                {/* כפתור מהיר - שומר ומסמן כהושלם */}
                <Button
                  onClick={async () => {
                    await saveProgress(true);
                    resetTimer();
                    if (onComplete) {
                      // סימון המשימה כהושלמה
                      onComplete();
                      toast.success('🎉 המשימה הושלמה! הזמן נשמר והמערכת למדה ממנה', {
                        duration: 4000
                      });
                    } else {
                      toast.success('✅ הזמן נשמר!', {
                        duration: 3000
                      });
                    }
                  }}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold shadow-lg"
                >
                  ✅ שמור וסמן כהושלם
                </Button>
                
                {/* כפתורים נוספים */}
                <div className="flex gap-2">
                  <Button
                    onClick={async () => {
                      await saveProgress(true);
                      resetTimer();
                      toast.success('💾 הזמן נשמר!', {
                        duration: 3000
                      });
                    }}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
                  >
                    💾 רק שמור
                  </Button>
                  <Button
                    onClick={resetTimer}
                    className="bg-gray-500 hover:bg-gray-600 text-white"
                    title="מחק את הזמן הנוכחי בלי לשמור"
                  >
                    🔄 איפוס
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {isRunning && (
        <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-2">
          💡 לחץ "השהה" לעבור למשימה אחרת • שמירה אוטומטית כל 5 דקות
        </p>
      )}
      {elapsedSeconds > 0 && !isRunning && (
        <p className="text-xs text-center text-blue-600 dark:text-blue-400 mt-2">
          💡 הטיימר מושהה - תוכל לחזור או לעבור למשימה אחרת
        </p>
      )}
    </div>
  );
}

export default TaskTimer;


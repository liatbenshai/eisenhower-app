import { useState, useEffect, useRef, useMemo } from 'react';
import { updateSubtaskProgress } from '../../services/supabase';
import { useTasks } from '../../hooks/useTasks';
import toast from 'react-hot-toast';
import Button from '../UI/Button';

/**
 * טיימר למשימה - פרומדורו
 */
function TaskTimer({ task, onUpdate, onComplete }) {
  const { updateTaskTime, tasks } = useTasks();

  // קבלת המשימה העדכנית מה-TaskContext במקום מה-prop - עם useMemo לעדכון אוטומטי
  // חשוב: כל ה-hooks חייבים להיקרא לפני ה-early return!
  const currentTask = useMemo(() => {
    if (!task || !task.id) return null;
    const found = tasks.find(t => t.id === task.id);
    if (found) {
      // אם time_spent השתנה, נדווח
      if (found.time_spent !== task.time_spent) {
        console.log('🔄 TaskTimer: משימה עודכנה מה-context', {
          id: found.id,
          time_spent_old: task.time_spent,
          time_spent_new: found.time_spent
        });
      }
      return found;
    }
    return task;
  }, [tasks, task?.id, task?.time_spent]);

  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [targetMinutes, setTargetMinutes] = useState(30); // זמן יעד - נעדכן ב-useEffect
  const [hasReachedTarget, setHasReachedTarget] = useState(false);
  const intervalRef = useRef(null);
  const audioRef = useRef(null);
  // מניעת שמירות כפולות במקביל - עם timeout אוטומטי
  const savingRef = useRef(null); // Promise של השמירה הנוכחית
  const savingTimeoutRef = useRef(null);

  // מפתח ב-localStorage לשמירת זמן התחלה
  const timerStorageKey = currentTask ? `timer_${currentTask.id}_startTime` : null;

  // חישובים - יכולים להיות גם כשאין משימה (יחזירו 0)
  const timeSpent = currentTask?.time_spent ? parseInt(currentTask.time_spent) : 0;
  const estimated = currentTask?.estimated_duration ? parseInt(currentTask.estimated_duration) : 0;
  const currentSessionMinutes = Math.floor(elapsedSeconds / 60);
  const totalSpent = timeSpent + currentSessionMinutes;
  const remainingMinutes = targetMinutes - currentSessionMinutes;
  const isTargetReached = currentSessionMinutes >= targetMinutes;
  const progress = targetMinutes > 0
    ? Math.min(100, Math.round((currentSessionMinutes / targetMinutes) * 100))
    : 0;

  // פונקציית saveProgress מוגדרת כאן כדי שתהיה זמינה ל-useEffect
  const saveProgressRef = useRef(null);

  // צפצוף/התראה
  const playAlarm = () => {
    try {
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

  // עדכון targetMinutes כשהמשימה משתנה
  useEffect(() => {
    if (currentTask?.estimated_duration) {
      setTargetMinutes(currentTask.estimated_duration);
    }
  }, [currentTask?.estimated_duration]);

  // טעינת זמן התחלה מ-localStorage כשהטיימר נטען
  useEffect(() => {
    if (currentTask?.id && timerStorageKey) {
      const savedStartTime = localStorage.getItem(timerStorageKey);
      if (savedStartTime) {
        const start = new Date(savedStartTime);
        const now = new Date();
        const elapsed = Math.floor((now - start) / 1000);

        if (elapsed > 0) {
          console.log('⏰ נמצא טיימר פעיל ב-localStorage:', {
            startTime: start.toISOString(),
            elapsedSeconds: elapsed,
            elapsedMinutes: Math.floor(elapsed / 60)
          });

          setStartTime(start);
          setElapsedSeconds(elapsed);
          setIsRunning(true);

          toast.success(`⏰ טיימר חודש! עברו ${Math.floor(elapsed / 60)} דקות`, {
            duration: 3000
          });
        } else {
          localStorage.removeItem(timerStorageKey);
        }
      }
    }
  }, [currentTask?.id, timerStorageKey]);

  // עדכון זמן כל שנייה
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setElapsedSeconds(prev => {
          if (startTime) {
            const now = new Date();
            const elapsed = Math.floor((now - startTime) / 1000);
            return elapsed;
          }
          return prev + 1;
        });
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
  }, [isRunning, startTime]);

  // טיפול ב-visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isRunning && startTime) {
        const now = new Date();
        const elapsed = Math.floor((now - startTime) / 1000);

        if (elapsed > elapsedSeconds) {
          const diffMinutes = Math.floor((elapsed - elapsedSeconds) / 60);
          console.log('👁️ דפדפן חזר להיות פעיל - עדכון זמן:', {
            elapsedSeconds,
            newElapsed: elapsed,
            diffMinutes
          });

          setElapsedSeconds(elapsed);

          if (diffMinutes > 0) {
            toast.info(`⏰ עודכנו ${diffMinutes} דקות נוספות`, {
              duration: 2000
            });
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isRunning, startTime, elapsedSeconds]);

  // שמירה אוטומטית כל 5 דקות
  useEffect(() => {
    if (isRunning && elapsedSeconds > 0 && elapsedSeconds % 300 === 0 && saveProgressRef.current) {
      saveProgressRef.current(false, true);
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
        if (saveProgressRef.current) {
          saveProgressRef.current(false, true);
        }
      }
    }
  }, [elapsedSeconds, isRunning, targetMinutes, hasReachedTarget]);

  // Early return AFTER all hooks are called
  if (!task || !task.id || !currentTask) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          אין משימה זמינה
        </p>
      </div>
    );
  }

  const startTimer = () => {
    if (hasReachedTarget) {
      // התחלה מחדש אחרי שהגענו ליעד
      setElapsedSeconds(0);
      setHasReachedTarget(false);
    }
    const now = new Date();
    setStartTime(now);
    
    // שמירת זמן התחלה ב-localStorage
    if (currentTask?.id) {
      localStorage.setItem(timerStorageKey, now.toISOString());
      console.log('💾 זמן התחלה נשמר ב-localStorage:', now.toISOString());
    }
    
    setIsRunning(true);
    toast.success('טיימר הופעל');
  };
  
  const pauseTimer = () => {
    setIsRunning(false);
    toast.success('טיימר הושהה - יכול לעבור למשימה אחרת');
  };
  
  const stopTimer = async () => {
    setIsRunning(false);
    
    // חישוב זמן מדויק לפי startTime
    let finalElapsedSeconds = elapsedSeconds;
    if (startTime) {
      const now = new Date();
      finalElapsedSeconds = Math.floor((now - startTime) / 1000);
      setElapsedSeconds(finalElapsedSeconds);
    }
    
    if (finalElapsedSeconds > 0) {
      const result = await saveProgress(true, true); // שמירה עם איפוס, בלי onUpdate
      if (result && result.success) {
        toast.success(`🎯 נשמר! ${result.minutesToAdd} דקות נוספו. סה"כ: ${result.newTimeSpent} דקות`, {
          duration: 4000,
          icon: '💾'
        });
      }
    }
    
    // ניקוי מ-localStorage
    if (currentTask?.id) {
      localStorage.removeItem(timerStorageKey);
      console.log('🗑️ זמן התחלה נמחק מ-localStorage');
    }
    
    setElapsedSeconds(0);
    setStartTime(null);
  };
  
  const resetTimer = () => {
    setIsRunning(false);
    setElapsedSeconds(0);
    setHasReachedTarget(false);
    setStartTime(null);
    
    // ניקוי מ-localStorage
    if (currentTask?.id) {
      localStorage.removeItem(timerStorageKey);
      console.log('🗑️ זמן התחלה נמחק מ-localStorage (reset)');
    }
  };

  const saveProgress = async (reset = false, skipUpdate = false) => {
    // מניעת שמירות כפולות - נשתמש ב-Promise במקום דגל בוליאני
    if (savingRef.current) {
      console.log('⏳ שמירה כבר בתהליך, ממתין לעדכון קודם...');
      try {
        // נמתין לשמירה הקודמת להסתיים
        await savingRef.current;
        console.log('✅ שמירה קודמת הסתיימה, ממשיך...');
      } catch (err) {
        console.warn('⚠️ שמירה קודמת נכשלה, ממשיך עם שמירה חדשה:', err);
        // אם השמירה הקודמת נכשלה, נמשיך עם שמירה חדשה
      }
    }
    
    // יצירת Promise חדש לשמירה
    const savePromise = (async () => {
      // חישוב זמן מדויק לפי startTime אם קיים
      let actualElapsedSeconds = elapsedSeconds;
      if (startTime) {
        const now = new Date();
        actualElapsedSeconds = Math.floor((now - startTime) / 1000);
        // עדכון ה-state עם הזמן המדויק
        if (actualElapsedSeconds !== elapsedSeconds) {
          setElapsedSeconds(actualElapsedSeconds);
        }
      }
      
      const minutesToAdd = Math.floor(actualElapsedSeconds / 60);
      if (minutesToAdd > 0 && currentTask && currentTask.id) {
        // שימוש במשימה העדכנית מה-TaskContext - טעינה מחדש מה-context
        const latestTask = tasks.find(t => t.id === currentTask.id) || currentTask;
        const currentTimeSpent = (latestTask.time_spent) ? parseInt(latestTask.time_spent) : 0;
        const newTimeSpent = currentTimeSpent + minutesToAdd;
        
        console.log('💾 saveProgress:', { 
          minutesToAdd, 
          actualElapsedSeconds,
          elapsedSeconds,
          currentTimeSpent, 
          newTimeSpent, 
          reset, 
          skipUpdate,
          taskId: latestTask.id,
          taskFromContext: latestTask.time_spent,
          startTime: startTime?.toISOString()
        });
        
        // עדכון המשימה דרך TaskContext - זה יעדכן גם את ה-DB וגם את ה-state
        const updatedTask = await updateTaskTime(latestTask.id, newTimeSpent);
        
        if (!updatedTask) {
          throw new Error('המשימה לא עודכנה - אין data');
        }
        
        console.log('✅ משימה עודכנה:', {
          id: updatedTask.id,
          time_spent: updatedTask.time_spent,
          expected: newTimeSpent
        });
        
        // אם יש subtask_id, עדכן גם את ה-subtask table
        if (latestTask.subtask_id) {
          await updateSubtaskProgress(latestTask.subtask_id, newTimeSpent);
        }
        
        if (reset) {
          setElapsedSeconds(0);
        }
        
        // עדכון TaskContext כבר קרה ב-updateTaskTime, אבל אם יש onUpdate callback, נקרא לו
        if (onUpdate && !skipUpdate) {
          console.log('🔄 קורא ל-onUpdate');
          await onUpdate();
        }
        
        return { success: true, minutesToAdd, newTimeSpent, updatedTask };
      } else if (minutesToAdd === 0) {
        toast('עבדת פחות מדקה - לא נשמר', { icon: '⏱️' });
        return { success: false, reason: 'less_than_minute' };
      }
      return { success: false, reason: 'no_time_to_save' };
    })();
    
    // שמירת ה-Promise
    savingRef.current = savePromise;
    
    // timeout אוטומטי - אם השמירה לוקחת יותר מ-30 שניות, נסיר את הדגל
    savingTimeoutRef.current = setTimeout(() => {
      if (savingRef.current === savePromise) {
        console.warn('⚠️ שמירה לוקחת יותר מדי זמן (30 שניות), מסיר דגל...');
        savingRef.current = null;
      }
    }, 30000); // הגדלתי ל-30 שניות
    
    try {
      // הוספת timeout ל-Promise עצמו
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('⏱️ שמירה לוקחת יותר מדי זמן - בדוק את החיבור לאינטרנט'));
        }, 35000); // 35 שניות timeout
      });
      
      const result = await Promise.race([savePromise, timeoutPromise]);
      return result;
    } catch (err) {
      console.error('❌ שגיאה בשמירת התקדמות:', err);
      
      // הודעת שגיאה ידידותית יותר
      let errorMessage = err.message || 'שגיאה בשמירת התקדמות';
      if (err.message?.includes('JWT') || err.message?.includes('session')) {
        errorMessage = '❌ סשן פג. אנא רענני את הדף והתחברי מחדש.';
      } else if (err.message?.includes('42501') || err.message?.includes('permission')) {
        errorMessage = '❌ אין הרשאות לשמירה. אנא התחברי מחדש.';
      } else if (err.message?.includes('user_id') || err.message?.includes('משתמש')) {
        errorMessage = '❌ בעיית התחברות. אנא רענני את הדף והתחברי מחדש.';
      }
      
      toast.error(errorMessage, { duration: 5000 });
      return { success: false, error: err };
    } finally {
      // ניקוי רק אם זה עדיין ה-Promise הנוכחי
      if (savingRef.current === savePromise) {
        savingRef.current = null;
      }
      if (savingTimeoutRef.current) {
        clearTimeout(savingTimeoutRef.current);
        savingTimeoutRef.current = null;
      }
    }
  };

  // שמירת הפונקציה ב-ref כדי שה-useEffect יוכל לקרוא לה
  saveProgressRef.current = saveProgress;

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
                  console.log('🟢 לחיצה על: שמור וסיים (אחרי הגעה ליעד)');
                  await saveProgress(true, true); // reset + skipUpdate
                  resetTimer();
                  toast.success('✅ התקדמות נשמרה וטיימר אופס');
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
            
            {/* כפתורים משניים - כשמושהה */}
            {elapsedSeconds > 0 && !isRunning && (
              <div className="space-y-2">
                {/* כפתור המשך עבודה - בולט */}
                <Button
                  onClick={() => {
                    setIsRunning(true);
                    toast.success('▶ ממשיכה לעבוד!');
                  }}
                  className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold shadow-lg text-lg py-3"
                >
                  ▶ המשך עבודה
                </Button>
                
                {/* קו הפרדה */}
                <div className="text-center text-xs text-gray-500 dark:text-gray-400">
                  או
                </div>
                
                {/* כפתור מהיר - שומר ומסמן כהושלם */}
                <Button
                  onClick={async () => {
                    console.log('🟢 לחיצה על: שמור וסמן כהושלם');
                    
                    // שמירה BLI onUpdate כדי שהכרטיס לא ייסגר באמצע
                    const result = await saveProgress(true, true);
                    
                    if (result && result.success) {
                      console.log('✅ שמירה הצליחה:', result);
                      resetTimer();
                      
                      if (onComplete) {
                        console.log('🎯 מסמן משימה כהושלמה');
                        // סימון המשימה כהושלמה - זה יעדכן הכל
                        await onComplete();
                        toast.success('🎉 המשימה הושלמה! הזמן נשמר והמערכת למדה ממנה', {
                          duration: 4000
                        });
                      } else {
                        console.warn('⚠️ אין onComplete callback');
                        toast.success('✅ הזמן נשמר!', {
                          duration: 3000
                        });
                      }
                    } else {
                      console.error('❌ השמירה נכשלה:', result);
                      if (result && result.reason !== 'less_than_minute') {
                        toast.error('שגיאה בשמירת הזמן');
                      }
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
                      console.log('💾 לחיצה על: רק שמור');
                      const result = await saveProgress(true, true); // reset + skipUpdate
                      if (result && result.success) {
                        resetTimer();
                        toast.success(`💾 נשמר! ${result.minutesToAdd} דקות נוספו. סה"כ: ${result.newTimeSpent} דקות`, {
                          duration: 3000
                        });
                      }
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


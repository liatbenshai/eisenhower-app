import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { updateSubtaskProgress } from '../../services/supabase';
import { useTasks } from '../../hooks/useTasks';
import { 
  findNextTask, 
  checkOverlapWithNext, 
  calculateNewTimeForNext,
  shouldWarnAboutOverrun 
} from '../../utils/autoReschedule';
import toast from 'react-hot-toast';
import Button from '../UI/Button';

/**
 * מפתח localStorage לשמירת מצב טיימר
 */
const getStorageKey = (taskId) => `timer_state_${taskId}`;

/**
 * שמירת מצב טיימר ב-localStorage
 */
const saveTimerState = (taskId, state) => {
  if (!taskId) return;
  try {
    localStorage.setItem(getStorageKey(taskId), JSON.stringify({
      ...state,
      savedAt: Date.now()
    }));
  } catch (e) {
    console.warn('Failed to save timer state:', e);
  }
};

/**
 * טעינת מצב טיימר מ-localStorage
 */
const loadTimerState = (taskId) => {
  if (!taskId) return null;
  try {
    const saved = localStorage.getItem(getStorageKey(taskId));
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Failed to load timer state:', e);
  }
  return null;
};

/**
 * מחיקת מצב טיימר מ-localStorage
 */
const clearTimerState = (taskId) => {
  if (!taskId) return;
  try {
    localStorage.removeItem(getStorageKey(taskId));
  } catch (e) {
    console.warn('Failed to clear timer state:', e);
  }
};

/**
 * טיימר למשימה - גרסה מתוקנת
 * 
 * שיפורים עיקריים:
 * 1. זמן שנותר מחושב נכון: estimated_duration - time_spent - sessionMinutes
 * 2. אחרי שמירה, הטיימר ממשיך מהזמן שנותר ולא מתאפס להתחלה
 * 3. localStorage שומר את מצב הסשן הנוכחי בלבד
 * 4. שמירה אוטומטית כל 5 דקות (ולא מתאפס!)
 */
function TaskTimer({ task, onUpdate, onComplete, onRescheduleNext }) {
  const { updateTaskTime, tasks, setActiveTask, editTask } = useTasks();

  // קבלת המשימה העדכנית מה-TaskContext
  const currentTask = useMemo(() => {
    if (!task || !task.id) return null;
    const found = tasks.find(t => t.id === task.id);
    return found || task;
  }, [tasks, task?.id]);

  // State
  const [isRunning, setIsRunning] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState(null); // זמן התחלת הסשן הנוכחי
  const [sessionSeconds, setSessionSeconds] = useState(0); // שניות בסשן הנוכחי בלבד
  const [hasReachedTarget, setHasReachedTarget] = useState(false);
  const [overrunWarningShown, setOverrunWarningShown] = useState(false);
  const [rescheduleOffer, setRescheduleOffer] = useState(null);
  
  // מצב הפרעה
  const [interruption, setInterruption] = useState(null); // { type: 'call'|'distraction', startTime, seconds }
  
  const intervalRef = useRef(null);
  const interruptionIntervalRef = useRef(null);
  const lastSaveRef = useRef(0); // timestamp של השמירה האחרונה
  const isSavingRef = useRef(false);
  const hasRestoredRef = useRef(false); // האם כבר שוחזר הטיימר?
  const restoredTaskIdRef = useRef(null); // איזו משימה שוחזרה
  const savedMinutesThisSessionRef = useRef(0); // כמה דקות כבר נשמרו מהסשן הנוכחי

  // חישובים בסיסיים
  const timeSpent = currentTask?.time_spent ? parseInt(currentTask.time_spent) : 0;
  const estimatedDuration = currentTask?.estimated_duration ? parseInt(currentTask.estimated_duration) : 30;
  
  // זמן בסשן הנוכחי (בדקות)
  const currentSessionMinutes = Math.floor(sessionSeconds / 60);
  
  // סה"כ זמן שעבדנו (כולל מה שנשמר + הסשן הנוכחי)
  const totalWorkedMinutes = timeSpent + currentSessionMinutes;
  
  // זמן שנותר = הערכה מקורית - סה"כ שעבדנו
  const remainingMinutes = Math.max(0, estimatedDuration - totalWorkedMinutes);
  
  // האם הגענו ליעד?
  const isTargetReached = totalWorkedMinutes >= estimatedDuration;
  
  // אחוז התקדמות
  const progress = estimatedDuration > 0
    ? Math.min(100, Math.round((totalWorkedMinutes / estimatedDuration) * 100))
    : 0;

  // פורמט זמן
  const formatTime = useCallback((seconds) => {
    const absSeconds = Math.abs(seconds);
    const hours = Math.floor(absSeconds / 3600);
    const minutes = Math.floor((absSeconds % 3600) / 60);
    const secs = absSeconds % 60;
    
    const sign = seconds < 0 ? '-' : '';
    
    if (hours > 0) {
      return `${sign}${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${sign}${minutes}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // טעינת מצב שמור מ-localStorage - רק פעם אחת למשימה!
  useEffect(() => {
    if (!currentTask?.id) return;
    
    // אם כבר שוחזר לאותה משימה - לא לשחזר שוב
    if (restoredTaskIdRef.current === currentTask.id) {
      return;
    }
    
    // סימון ששוחזר (לפני כל בדיקה אחרת!)
    restoredTaskIdRef.current = currentTask.id;

    const savedState = loadTimerState(currentTask.id);
    
    // אם אין מצב שמור או שהוא לא רץ או שכבר שוחזר - לא לשחזר
    if (!savedState || !savedState.isRunning || !savedState.sessionStartTime || savedState.restored) {
      return;
    }
    
    // חישוב כמה זמן עבר מאז ששמרנו
    const startTime = new Date(savedState.sessionStartTime);
    const now = new Date();
    const elapsedSinceStart = Math.floor((now - startTime) / 1000);
    
    if (elapsedSinceStart > 0 && elapsedSinceStart < 86400) { // פחות מ-24 שעות
      // סימון ב-localStorage שכבר שוחזר
      saveTimerState(currentTask.id, { ...savedState, restored: true });
      
      setSessionStartTime(startTime);
      setSessionSeconds(elapsedSinceStart);
      setIsRunning(true);
      
      const minutes = Math.floor(elapsedSinceStart / 60);
      if (minutes > 0) {
        toast.success(`⏰ טיימר חודש! עברו ${minutes} דקות`, {
          duration: 3000
        });
      }
    } else {
      // זמן ישן מדי - מנקים
      clearTimerState(currentTask.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTask?.id]); // רק כשה-task משתנה!

  // עדכון שניות כל שנייה
  useEffect(() => {
    if (isRunning && sessionStartTime) {
      intervalRef.current = setInterval(() => {
        const now = new Date();
        const elapsed = Math.floor((now - sessionStartTime) / 1000);
        setSessionSeconds(elapsed);
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
  }, [isRunning, sessionStartTime]);

  // שמירה אוטומטית כל 5 דקות - בלי לאפס את הטיימר!
  useEffect(() => {
    if (isRunning && sessionSeconds > 0) {
      const minutesInSession = Math.floor(sessionSeconds / 60);
      const timeSinceLastSave = Date.now() - lastSaveRef.current;
      
      // שמירה כל 5 דקות, אבל רק אם עברו לפחות 4 דקות מהשמירה האחרונה
      const shouldAutoSave = minutesInSession > 0 && 
                             minutesInSession % 5 === 0 && 
                             timeSinceLastSave > 240000; // 4 דקות מינימום
      
      if (shouldAutoSave && !isSavingRef.current) {
        console.log('💾 שמירה אוטומטית (בלי לאפס)...');
        saveProgressInternal(false).catch(err => {
          console.warn('Auto-save failed:', err);
        });
      }
    }
  }, [sessionSeconds, isRunning]);

  // טיפול ב-visibility change - כשחוזרים לטאב
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isRunning && sessionStartTime) {
        const now = new Date();
        const elapsed = Math.floor((now - sessionStartTime) / 1000);
        
        if (elapsed > sessionSeconds) {
          const diffMinutes = Math.floor((elapsed - sessionSeconds) / 60);
          console.log('👁️ חזרה לטאב:', { oldSeconds: sessionSeconds, newSeconds: elapsed, diffMinutes });
          setSessionSeconds(elapsed);
          
          if (diffMinutes > 0) {
            toast.info(`⏰ עודכנו ${diffMinutes} דקות`, { duration: 2000 });
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isRunning, sessionStartTime, sessionSeconds]);

  // שמירת מצב ב-localStorage כל שינוי
  useEffect(() => {
    if (currentTask?.id && isRunning && sessionStartTime) {
      saveTimerState(currentTask.id, {
        isRunning,
        sessionStartTime: sessionStartTime.toISOString(),
        sessionSeconds,
        restored: true // מונע שחזור כפול כשהקומפוננטה נטענת מחדש
      });
    }
  }, [currentTask?.id, isRunning, sessionStartTime, sessionSeconds]);

  // בדיקת הגעה ליעד
  useEffect(() => {
    if (isRunning && !hasReachedTarget && isTargetReached) {
      setHasReachedTarget(true);
      playAlarm();
      toast.success(`⏰ הגעת ליעד של ${estimatedDuration} דקות!`, {
        duration: 5000,
        icon: '🎉'
      });
    }
  }, [isRunning, hasReachedTarget, isTargetReached, estimatedDuration]);

  // בדיקת חריגה והזזת משימה הבאה
  useEffect(() => {
    if (!isRunning || !currentTask) return;
    
    const overrunInfo = shouldWarnAboutOverrun(currentTask, currentSessionMinutes);
    
    if (overrunInfo.shouldWarn && !overrunWarningShown) {
      toast('⏰ נשארו עוד כמה דקות לסיום המשימה', {
        icon: '⚠️',
        duration: 4000,
        style: { background: '#fef3c7', color: '#92400e' }
      });
      setOverrunWarningShown(true);
    }
    
    if (overrunInfo.isOverrun && !rescheduleOffer) {
      const nextTask = findNextTask(currentTask, tasks);
      
      if (nextTask) {
        const hasOverlap = checkOverlapWithNext(currentTask, currentSessionMinutes, nextTask);
        
        if (hasOverlap) {
          const newTime = calculateNewTimeForNext(currentTask, currentSessionMinutes + 10, nextTask);
          
          if (newTime) {
            setRescheduleOffer({ nextTask, newTime });
          }
        }
      }
    }
  }, [currentSessionMinutes, isRunning, currentTask, tasks, overrunWarningShown, rescheduleOffer]);

  // צפצוף
  const playAlarm = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      const playBeep = (delay = 0) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime + delay);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + delay + 0.5);
        oscillator.start(audioContext.currentTime + delay);
        oscillator.stop(audioContext.currentTime + delay + 0.5);
      };
      
      playBeep(0);
      playBeep(0.5);
      playBeep(1);
    } catch (err) {
      console.warn('Sound not available:', err);
    }
  }, []);

  // טיימר להפרעה
  useEffect(() => {
    if (interruption) {
      interruptionIntervalRef.current = setInterval(() => {
        setInterruption(prev => {
          if (!prev) return null;
          const now = new Date();
          const elapsed = Math.floor((now - new Date(prev.startTime)) / 1000);
          return { ...prev, seconds: elapsed };
        });
      }, 1000);
    } else {
      if (interruptionIntervalRef.current) {
        clearInterval(interruptionIntervalRef.current);
        interruptionIntervalRef.current = null;
      }
    }
    return () => {
      if (interruptionIntervalRef.current) {
        clearInterval(interruptionIntervalRef.current);
      }
    };
  }, [interruption?.startTime]);

  // התחלת הפרעה
  const startInterruption = useCallback((type) => {
    // עוצר את הטיימר הראשי
    setIsRunning(false);
    
    // עדכון localStorage שהטיימר לא רץ (למנוע שחזור בטעות)
    if (currentTask?.id) {
      saveTimerState(currentTask.id, {
        isRunning: false,
        sessionStartTime: sessionStartTime?.toISOString(),
        sessionSeconds,
        interrupted: true
      });
    }
    
    const now = new Date();
    setInterruption({
      type,
      startTime: now.toISOString(),
      seconds: 0,
      pausedTaskTime: sessionSeconds // שומר את הזמן לפני ההפרעה
    });
    
    toast(`⏸️ ${type === 'call' ? 'שיחת לקוח' : 'הפרעה'} - הטיימר הושהה`, {
      icon: type === 'call' ? '📞' : '🔔'
    });
  }, [sessionSeconds, currentTask?.id, sessionStartTime]);

  // סיום הפרעה וחזרה לעבודה
  const endInterruption = useCallback(() => {
    if (!interruption) return;
    
    const interruptionMinutes = Math.floor(interruption.seconds / 60);
    const typeLabel = interruption.type === 'call' ? 'שיחת לקוח' : 'הפרעה';
    
    // TODO: אפשר לשמור את ההפרעות ב-DB בעתיד
    console.log('📝 הפרעה הסתיימה:', {
      type: interruption.type,
      duration: interruptionMinutes,
      startTime: interruption.startTime
    });
    
    // חזרה לעבודה - חישוב sessionStartTime כך שה-elapsed יהיה נכון
    const pausedTime = interruption.pausedTaskTime || sessionSeconds;
    const now = new Date();
    // מחשבים את sessionStartTime כך ש-elapsed = pausedTime
    const adjustedStartTime = new Date(now.getTime() - pausedTime * 1000);
    setSessionStartTime(adjustedStartTime);
    setSessionSeconds(pausedTime);
    setIsRunning(true);
    setInterruption(null);
    
    // סימון שהטיימר פעיל ועדכון localStorage
    if (currentTask?.id) {
      saveTimerState(currentTask.id, {
        isRunning: true,
        sessionStartTime: adjustedStartTime.toISOString(),
        sessionSeconds: pausedTime,
        restored: true // מונע שחזור כפול
      });
    }
    
    toast.success(`✅ חזרת לעבודה! ${typeLabel} לקחה ${interruptionMinutes} דקות`, {
      duration: 3000
    });
  }, [interruption, sessionSeconds, currentTask?.id]);

  // ביטול הפרעה (לא חוזר לעבודה)
  const cancelInterruption = useCallback(() => {
    setInterruption(null);
    toast('❌ הפרעה בוטלה', { duration: 2000 });
  }, []);

  // שמירת התקדמות - פנימית (לשימוש auto-save)
  const saveProgressInternal = useCallback(async (resetAfterSave = false) => {
    if (isSavingRef.current) {
      console.log('⏳ שמירה כבר בתהליך...');
      return { success: false, reason: 'already_saving' };
    }
    
    isSavingRef.current = true;
    lastSaveRef.current = Date.now();
    
    try {
      // חישוב זמן מדויק
      let actualSessionSeconds = sessionSeconds;
      if (sessionStartTime) {
        const now = new Date();
        actualSessionSeconds = Math.floor((now - sessionStartTime) / 1000);
      }
      
      const totalSessionMinutes = Math.floor(actualSessionSeconds / 60);
      // רק הדקות שעדיין לא נשמרו
      const minutesToAdd = totalSessionMinutes - savedMinutesThisSessionRef.current;
      
      if (minutesToAdd <= 0) {
        console.log('⏱️ אין דקות חדשות לשמור');
        isSavingRef.current = false;
        return { success: false, reason: 'no_new_minutes' };
      }
      
      if (!currentTask?.id) {
        isSavingRef.current = false;
        return { success: false, reason: 'no_task' };
      }
      
      // קבלת time_spent עדכני מה-context
      const latestTask = tasks.find(t => t.id === currentTask.id);
      const currentTimeSpent = latestTask?.time_spent ? parseInt(latestTask.time_spent) : 0;
      const newTimeSpent = currentTimeSpent + minutesToAdd;
      
      console.log('💾 שומר התקדמות:', {
        totalSessionMinutes,
        alreadySaved: savedMinutesThisSessionRef.current,
        minutesToAdd,
        currentTimeSpent,
        newTimeSpent,
        resetAfterSave
      });
      
      // שמירה ב-DB
      await updateTaskTime(currentTask.id, newTimeSpent);
      
      // עדכון subtask אם יש
      if (currentTask.subtask_id) {
        await updateSubtaskProgress(currentTask.subtask_id, newTimeSpent);
      }
      
      if (resetAfterSave) {
        // איפוס מלא - סוף עבודה
        setSessionSeconds(0);
        setSessionStartTime(null);
        setIsRunning(false);
        savedMinutesThisSessionRef.current = 0;
        clearTimerState(currentTask.id);
      } else {
        // המשך עבודה - לא מאפסים כלום! רק מעדכנים כמה שמרנו בסה"כ
        savedMinutesThisSessionRef.current = totalSessionMinutes;
        
        toast.success(`💾 נשמרו ${minutesToAdd} דקות. סה"כ: ${newTimeSpent}`, {
          duration: 2000
        });
      }
      
      isSavingRef.current = false;
      return { success: true, minutesToAdd, newTimeSpent };
      
    } catch (err) {
      console.error('❌ שגיאה בשמירה:', err);
      isSavingRef.current = false;
      return { success: false, reason: 'error', error: err };
    }
  }, [currentTask, sessionStartTime, sessionSeconds, tasks, updateTaskTime]);

  // שמירת התקדמות - חיצונית (לשימוש מכפתורים)
  const saveProgress = useCallback(async (resetAfterSave = false) => {
    return saveProgressInternal(resetAfterSave);
  }, [saveProgressInternal]);

  // התחלת טיימר
  const startTimer = useCallback(() => {
    if (currentTask?.id) {
      setActiveTask(currentTask.id);
    }
    
    if (hasReachedTarget) {
      setHasReachedTarget(false);
    }
    
    if (!isRunning) {
      const now = new Date();
      setSessionStartTime(now);
      // לא מאפסים sessionSeconds אם כבר יש זמן צבור (מושהה)
      if (sessionSeconds === 0) {
        setSessionSeconds(0);
        savedMinutesThisSessionRef.current = 0; // סשן חדש - אפס את השמור
      }
      setIsRunning(true);
      
      saveTimerState(currentTask?.id, {
        isRunning: true,
        sessionStartTime: now.toISOString(),
        sessionSeconds: sessionSeconds,
        restored: true // מונע שחזור כפול
      });
      
      toast.success('▶ טיימר הופעל');
    }
  }, [currentTask?.id, hasReachedTarget, isRunning, sessionSeconds, setActiveTask]);

  // השהיית טיימר
  const pauseTimer = useCallback(() => {
    setIsRunning(false);
    setActiveTask(null);
    
    // שמירת המצב המושהה - לא מוחקים את localStorage
    if (currentTask?.id) {
      saveTimerState(currentTask.id, {
        isRunning: false,
        sessionStartTime: sessionStartTime?.toISOString(),
        sessionSeconds,
        paused: true
      });
    }
    
    toast.success('⏸ טיימר מושהה');
  }, [currentTask?.id, sessionStartTime, sessionSeconds, setActiveTask]);

  // עצירת טיימר ושמירה
  const stopTimer = useCallback(async () => {
    setIsRunning(false);
    setActiveTask(null);
    
    if (sessionSeconds >= 60) {
      const result = await saveProgress(true);
      if (result.success) {
        toast.success(`🎯 נשמר! ${result.minutesToAdd} דקות נוספו. סה"כ: ${result.newTimeSpent} דקות`, {
          duration: 4000
        });
      }
    } else {
      toast('⏱️ עבדת פחות מדקה - לא נשמר', { icon: '⏱️' });
      // איפוס בכל מקרה
      setSessionSeconds(0);
      setSessionStartTime(null);
      if (currentTask?.id) {
        clearTimerState(currentTask.id);
      }
    }
  }, [currentTask?.id, sessionSeconds, saveProgress, setActiveTask]);

  // איפוס טיימר
  const resetTimer = useCallback(() => {
    setIsRunning(false);
    setSessionSeconds(0);
    setSessionStartTime(null);
    setHasReachedTarget(false);
    setOverrunWarningShown(false);
    setActiveTask(null);
    
    if (currentTask?.id) {
      clearTimerState(currentTask.id);
    }
    
    toast.success('🔄 טיימר אופס');
  }, [currentTask?.id, setActiveTask]);

  // המשך עבודה אחרי השהיה
  const resumeTimer = useCallback(() => {
    if (!isRunning && sessionSeconds > 0) {
      const now = new Date();
      // חישוב sessionStartTime כך שה-elapsed יהיה שווה ל-sessionSeconds הקיים
      // זה מבטיח שהטיימר ימשיך מאיפה שעצר ולא יתאפס
      const adjustedStartTime = new Date(now.getTime() - sessionSeconds * 1000);
      setSessionStartTime(adjustedStartTime);
      setIsRunning(true);
      
      saveTimerState(currentTask?.id, {
        isRunning: true,
        sessionStartTime: adjustedStartTime.toISOString(),
        sessionSeconds,
        restored: true // מונע שחזור כפול
      });
      
      toast.success('▶ ממשיכים לעבוד');
    }
  }, [currentTask?.id, isRunning, sessionSeconds]);

  // המשך עבודה אחרי הגעה ליעד
  const continueAfterTarget = useCallback(() => {
    setHasReachedTarget(false);
    toast.success('ממשיכים לעבוד!');
  }, []);

  // הזזת המשימה הבאה
  const handleRescheduleNext = useCallback(async () => {
    if (!rescheduleOffer) return;
    
    try {
      await editTask(rescheduleOffer.nextTask.id, {
        dueTime: rescheduleOffer.newTime
      });
      toast.success(`✅ "${rescheduleOffer.nextTask.title}" הועברה ל-${rescheduleOffer.newTime}`);
      setRescheduleOffer(null);
    } catch (err) {
      toast.error('שגיאה בהעברת המשימה');
    }
  }, [rescheduleOffer, editTask]);

  // סגירת הצעת הזזה
  const dismissRescheduleOffer = useCallback(() => {
    setRescheduleOffer(null);
  }, []);

  // שמירה לפני סגירת הדף
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isRunning && sessionSeconds >= 60) {
        // ננסה לשמור - אבל זה async אז לא תמיד יעבוד
        saveProgressInternal(false).catch(() => {});
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isRunning, sessionSeconds, saveProgressInternal]);

  // אם אין משימה
  if (!task || !task.id || !currentTask) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          אין משימה זמינה
        </p>
      </div>
    );
  }

  // זמן להצגה
  // אם הגענו ליעד - מראים זמן חריגה (כמה זמן עברנו מעבר ליעד)
  // אחרת - מראים זמן שנותר
  const displaySeconds = isTargetReached 
    ? (totalWorkedMinutes - estimatedDuration) * 60 + (sessionSeconds % 60)
    : remainingMinutes * 60 + (60 - (sessionSeconds % 60)) % 60;

  return (
    <div className={`p-4 rounded-lg border-2 ${
      hasReachedTarget
        ? 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-300 dark:border-green-700'
        : 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800'
    }`}>
      
      {/* הצעת הזזה למשימה הבאה */}
      {rescheduleOffer && (
        <div className="mb-4 p-3 bg-orange-100 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-700 rounded-lg">
          <div className="flex items-start gap-2 mb-2">
            <span className="text-xl">🔄</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                המשימה לוקחת יותר זמן מהצפוי
              </p>
              <p className="text-xs text-orange-700 dark:text-orange-300">
                להזיז את "{rescheduleOffer.nextTask.title}" ל-{rescheduleOffer.newTime}?
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRescheduleNext}
              className="flex-1 px-3 py-1.5 bg-orange-500 text-white text-sm rounded hover:bg-orange-600"
            >
              ✅ הזז
            </button>
            <button
              onClick={dismissRescheduleOffer}
              className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded"
            >
              לא עכשיו
            </button>
          </div>
        </div>
      )}

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
      
      {/* תצוגת זמן */}
      <div className="text-center mb-4">
        <div className={`text-4xl font-mono font-bold ${
          hasReachedTarget 
            ? 'text-green-600 dark:text-green-400' 
            : remainingMinutes <= 5 
              ? 'text-red-600 dark:text-red-400' 
              : 'text-blue-600 dark:text-blue-400'
        }`}>
          {hasReachedTarget && '+'}
          {formatTime(displaySeconds)}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {hasReachedTarget 
            ? 'זמן מעבר ליעד' 
            : remainingMinutes > 0 
              ? 'זמן שנותר' 
              : 'הגעת ליעד!'}
        </div>
      </div>

      {/* פס התקדמות */}
      <div className="mb-4">
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              hasReachedTarget
                ? 'bg-green-500'
                : progress >= 80
                  ? 'bg-orange-500'
                  : 'bg-blue-500'
            }`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-xs text-gray-500 dark:text-gray-400">
          <span>עבדת: {totalWorkedMinutes} דק'</span>
          <span>יעד: {estimatedDuration} דק'</span>
        </div>
      </div>

      {/* פאנל הפרעה פעילה */}
      {interruption && (
        <div className="mb-4 p-4 bg-gradient-to-r from-orange-100 to-red-100 dark:from-orange-900/30 dark:to-red-900/30 rounded-xl border-2 border-orange-300 dark:border-orange-700">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl animate-pulse">
                {interruption.type === 'call' ? '📞' : '🔔'}
              </span>
              <span className="font-bold text-orange-800 dark:text-orange-200">
                {interruption.type === 'call' ? 'שיחת לקוח' : 'הפרעה'}
              </span>
            </div>
            <div className="text-2xl font-mono font-bold text-orange-600 dark:text-orange-400">
              {formatTime(interruption.seconds)}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={(e) => {
                e.stopPropagation();
                endInterruption();
              }}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white"
            >
              ✅ חזרה לעבודה
            </Button>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                cancelInterruption();
              }}
              className="bg-gray-400 hover:bg-gray-500 text-white"
            >
              ❌
            </Button>
          </div>
        </div>
      )}

      {/* סטטיסטיקות */}
      <div className="grid grid-cols-3 gap-2 mb-4 text-center text-xs">
        <div className="bg-white dark:bg-gray-800 rounded p-2">
          <div className="font-bold text-blue-600 dark:text-blue-400">{timeSpent}</div>
          <div className="text-gray-500">נשמר קודם</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded p-2">
          <div className="font-bold text-purple-600 dark:text-purple-400">{currentSessionMinutes}</div>
          <div className="text-gray-500">סשן נוכחי</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded p-2">
          <div className="font-bold text-green-600 dark:text-green-400">{totalWorkedMinutes}</div>
          <div className="text-gray-500">סה"כ</div>
        </div>
      </div>

      {/* כפתורים */}
      {hasReachedTarget ? (
        <div className="space-y-2">
          <p className="text-center text-green-700 dark:text-green-300 text-sm">
            🎉 הגעת ליעד! מה עושים?
          </p>
          <div className="flex gap-2">
            <Button
              onClick={continueAfterTarget}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
            >
              ▶ המשך לעבוד
            </Button>
            <Button
              onClick={async () => {
                const result = await saveProgress(true);
                if (result.success) {
                  toast.success(`✅ נשמר! סה"כ: ${result.newTimeSpent} דקות`);
                  if (onComplete) {
                    await onComplete();
                  }
                }
              }}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white"
            >
              💾 שמור וסיים
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            {!isRunning ? (
              <Button
                onClick={sessionSeconds > 0 ? resumeTimer : startTimer}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white"
              >
                ▶ {sessionSeconds > 0 ? 'המשך עבודה' : 'התחל עבודה'}
              </Button>
            ) : (
              <>
                <Button
                  onClick={pauseTimer}
                  className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white"
                >
                  ⏸ השהה
                </Button>
                <Button
                  onClick={stopTimer}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                >
                  ⏹ עצור ושמור
                </Button>
              </>
            )}
          </div>
          
          {/* כפתורי הפרעה */}
          <div className="flex gap-2 mt-3 pt-3 border-t-2 border-dashed border-orange-300 dark:border-orange-700">
            <button
              onClick={(e) => {
                e.stopPropagation();
                startInterruption('call');
              }}
              className="flex-1 py-3 px-3 bg-orange-500 text-white rounded-lg text-sm font-bold hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
            >
              📞 שיחת לקוח
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                startInterruption('distraction');
              }}
              className="flex-1 py-3 px-3 bg-pink-500 text-white rounded-lg text-sm font-bold hover:bg-pink-600 transition-colors flex items-center justify-center gap-2"
            >
              🔔 הפרעה
            </button>
          </div>
          
          {sessionSeconds > 0 && !isRunning && !interruption && (
            <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <Button
                onClick={async () => {
                  const result = await saveProgress(true);
                  if (result.success) {
                    toast.success(`✅ נשמר ומסומן כהושלם!`);
                    if (onComplete) {
                      await onComplete();
                    }
                  }
                }}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold"
              >
                ✅ שמור וסמן כהושלם
              </Button>
              <div className="flex gap-2">
                <Button
                  onClick={async () => {
                    const result = await saveProgress(true);
                    if (result.success) {
                      toast.success(`💾 נשמר! ${result.minutesToAdd} דקות`);
                    }
                  }}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
                >
                  💾 רק שמור
                </Button>
                <Button
                  onClick={resetTimer}
                  className="bg-gray-500 hover:bg-gray-600 text-white"
                >
                  🔄 איפוס
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
      
      {isRunning && (
        <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-2">
          💡 שמירה אוטומטית כל 5 דקות • הטיימר ממשיך גם אם עוברים לחלון אחר
        </p>
      )}
    </div>
  );
}

export default TaskTimer;

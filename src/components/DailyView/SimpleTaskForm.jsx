import { useState, useEffect, useMemo } from 'react';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../hooks/useAuth';
import { getTaskTypeLearning } from '../../services/supabase';
import { findOverlappingTasks, findNextFreeSlot } from '../../utils/timeOverlap';
import { findTasksToDefer, calculateNewDueDate } from '../../utils/urgentRescheduler';
import { getAvailableMinutesForDay } from '../../utils/smartTaskSplitter';
import { suggestSlots, getDayLoad } from '../../utils/slotSuggester';
import toast from 'react-hot-toast';
import Input from '../UI/Input';
import Button from '../UI/Button';
import ScheduleConflictAlert from '../Tasks/ScheduleConflictAlert';

/**
 * טופס משימה פשוט - מותאם לניהול זמן
 */
function SimpleTaskForm({ task, onClose, taskTypes, defaultDate }) {
  const { addTask, editTask, tasks } = useTasks();
  const { user } = useAuth();
  const isEditing = !!task;

  // סטייט הטופס
  const [formData, setFormData] = useState({
    title: '',
    taskType: 'other',
    estimatedDuration: '',
    startDate: defaultDate || new Date().toISOString().split('T')[0],
    dueDate: '', // דדליין - אופציונלי
    dueTime: '',
    description: '',
    priority: 'normal' // דחיפות: urgent, high, normal
  });

  // האם משימה ארוכה (מעל יום)
  const [isLongTask, setIsLongTask] = useState(false);

  const [loading, setLoading] = useState(false);
  const [learningData, setLearningData] = useState(null);
  const [suggestedTime, setSuggestedTime] = useState(null);
  
  // סטייט להתראות חפיפות
  const [showConflictAlert, setShowConflictAlert] = useState(false);
  const [conflictChecked, setConflictChecked] = useState(false);

  // בדיקת חפיפות בזמן אמת
  const conflictInfo = useMemo(() => {
    const dateToCheck = formData.startDate;
    if (!dateToCheck || !formData.dueTime || isEditing) return null;
    
    console.log('🔍 SimpleTaskForm - בדיקת חפיפות:', {
      startDate: formData.startDate,
      dueTime: formData.dueTime,
      estimatedDuration: formData.estimatedDuration,
      tasksCount: tasks?.length
    });
    
    const newTask = {
      dueDate: dateToCheck,
      dueTime: formData.dueTime,
      estimatedDuration: parseInt(formData.estimatedDuration) || 30
    };
    
    const overlapping = findOverlappingTasks(newTask, tasks);
    console.log('🔄 תוצאת חפיפות:', overlapping);
    
    const availableMinutes = getAvailableMinutesForDay(dateToCheck, tasks);
    console.log('⏰ דקות פנויות:', availableMinutes);
    
    const isOverloaded = availableMinutes < newTask.estimatedDuration;
    
    if (overlapping.length > 0 || isOverloaded) {
      console.log('⚠️ נמצאה חפיפה!');
      return {
        hasConflict: true,
        overlappingTasks: overlapping,
        isOverloaded,
        availableMinutes,
        overloadAmount: isOverloaded ? newTask.estimatedDuration - availableMinutes : 0
      };
    }
    return null;
  }, [formData.startDate, formData.dueTime, formData.estimatedDuration, tasks, isEditing]);

  // הצעות לחלונות זמן - מחשב כשמשתנה משך המשימה
  const slotSuggestions = useMemo(() => {
    if (isEditing) return null;
    
    const duration = parseInt(formData.estimatedDuration);
    if (!duration || duration <= 0) return null;
    
    const result = suggestSlots({
      estimatedDuration: duration,
      priority: formData.priority
    }, tasks);
    
    console.log('💡 הצעות זמן:', result);
    return result;
  }, [formData.estimatedDuration, formData.priority, tasks, isEditing]);

  // מילוי נתונים בעריכה
  useEffect(() => {
    if (task) {
      const hasDeadline = task.due_date && task.start_date && task.due_date !== task.start_date;
      setIsLongTask(hasDeadline);
      setFormData({
        title: task.title || '',
        taskType: task.task_type || 'other',
        estimatedDuration: task.estimated_duration || '',
        startDate: task.start_date || task.due_date || defaultDate || new Date().toISOString().split('T')[0],
        dueDate: hasDeadline ? task.due_date : '',
        dueTime: task.due_time || '',
        description: task.description || '',
        priority: task.priority || 'normal'
      });
    }
  }, [task, defaultDate]);

  // טעינת נתוני למידה כשמשתנה סוג המשימה
  useEffect(() => {
    if (user?.id && formData.taskType) {
      getTaskTypeLearning(user.id, formData.taskType)
        .then(data => {
          setLearningData(data);
        })
        .catch(err => {
          console.error('שגיאה בטעינת נתוני למידה:', err);
          setLearningData(null);
        });
    }
  }, [user?.id, formData.taskType]);

  // חישוב זמן מוצע כשמשתנה סוג משימה
  useEffect(() => {
    const taskType = taskTypes[formData.taskType];
    if (!taskType) return;

    let suggested = null;

    // אם יש נתוני למידה - נשתמש בממוצע שלה
    if (learningData && learningData.total_tasks > 0) {
      suggested = Math.round(learningData.total_actual_minutes / learningData.total_tasks);
    } else {
      // אין נתוני למידה - ברירת מחדל
      suggested = taskType.defaultDuration;
    }

    setSuggestedTime(suggested);
  }, [formData.taskType, learningData, taskTypes]);

  // טיפול בשינוי שדה
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // קבלת הצעת הזמן
  const handleAcceptSuggestion = () => {
    if (suggestedTime) {
      setFormData(prev => ({ ...prev, estimatedDuration: suggestedTime.toString() }));
      toast.success(`הוגדר ${suggestedTime} דקות`);
    }
  };

  // שליחת הטופס
  const handleSubmit = async (e) => {
    e.preventDefault();

    // וידוא
    if (!formData.title.trim()) {
      toast.error('נא להזין שם משימה');
      return;
    }

    if (!formData.estimatedDuration || parseInt(formData.estimatedDuration) <= 0) {
      toast.error('נא להזין זמן משוער');
      return;
    }

    // בדיקת חפיפות - רק במשימה חדשה ואם לא אישרו כבר
    if (!isEditing && conflictInfo?.hasConflict && !conflictChecked) {
      setShowConflictAlert(true);
      return;
    }

    setLoading(true);

    try {
      const duration = parseInt(formData.estimatedDuration);
      const startDate = formData.startDate;
      const dueDate = isLongTask ? formData.dueDate : formData.startDate;

      // בדיקה אם צריך לפצל - משימה ארוכה עם מספר ימים
      if (isLongTask && startDate && dueDate && startDate !== dueDate && !isEditing) {
        // חישוב מספר הימים
        const start = new Date(startDate);
        const end = new Date(dueDate);
        const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        
        // חישוב זמן יומי (מקסימום 45 דקות למקטע)
        const dailyDuration = Math.ceil(duration / daysDiff);
        const maxChunkSize = 45; // מקסימום 45 דקות למקטע
        
        // אם הזמן היומי קטן מ-45 דקות, ניצור משימה אחת ליום
        // אם גדול יותר, ניצור מספר משימות ליום
        let remainingDuration = duration;
        let currentDate = new Date(start);
        let taskIndex = 1;
        const totalChunks = Math.ceil(duration / maxChunkSize);

        while (remainingDuration > 0 && currentDate <= end) {
          // כמה זמן להקצות ליום הזה
          const daysLeft = Math.ceil((end - currentDate) / (1000 * 60 * 60 * 24)) + 1;
          let todayDuration = Math.ceil(remainingDuration / daysLeft);
          
          // אם יותר מ-45 דקות, נפצל למקטעים
          while (todayDuration > 0 && remainingDuration > 0) {
            const chunkDuration = Math.min(todayDuration, maxChunkSize, remainingDuration);
            
            const dateISO = currentDate.toISOString().split('T')[0];
            
            await addTask({
              title: totalChunks > 1 
                ? `${formData.title.trim()} (${taskIndex}/${totalChunks})`
                : formData.title.trim(),
              description: formData.description.trim() || null,
              taskType: formData.taskType,
              estimatedDuration: chunkDuration,
              startDate: dateISO,
              dueDate: dateISO,
              dueTime: formData.dueTime || null,
              priority: formData.priority || 'normal',
              quadrant: 1
            });

            remainingDuration -= chunkDuration;
            todayDuration -= chunkDuration;
            taskIndex++;
          }
          
          // מעבר ליום הבא
          currentDate.setDate(currentDate.getDate() + 1);
        }

        toast.success(`המשימה פוצלה ל-${taskIndex - 1} חלקים על פני ${daysDiff} ימים`);
      } else {
        // משימה רגילה או עריכה
        const taskData = {
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          taskType: formData.taskType,
          estimatedDuration: duration,
          startDate: startDate || null,
          dueDate: dueDate || null,
          dueTime: formData.dueTime || null,
          priority: formData.priority || 'normal',
          quadrant: 1
        };

        if (isEditing) {
          await editTask(task.id, taskData);
          toast.success('המשימה עודכנה');
        } else {
          await addTask(taskData);
          toast.success('המשימה נוספה');
        }
      }

      onClose();
    } catch (err) {
      console.error('שגיאה:', err);
      toast.error(err.message || 'שגיאה בשמירת המשימה');
    } finally {
      setLoading(false);
    }
  };

  const selectedType = taskTypes[formData.taskType];

  // טיפול בדחיית משימות חופפות
  const handleDeferConflicts = async (tasksToDefer) => {
    try {
      for (const t of tasksToDefer) {
        const newDueDate = calculateNewDueDate(t, tasks);
        await editTask(t.id, { 
          dueDate: newDueDate,
          startDate: newDueDate
        });
      }
      toast.success(`${tasksToDefer.length} משימות נדחו למחר`);
      setShowConflictAlert(false);
      setConflictChecked(true);
      handleSubmit({ preventDefault: () => {} });
    } catch (err) {
      console.error('שגיאה בדחיית משימות:', err);
      toast.error('שגיאה בדחיית משימות');
    }
  };

  // שינוי שעה לשעה פנויה
  const handleChangeTime = (newTime, isTomorrow) => {
    if (isTomorrow) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setFormData(prev => ({
        ...prev,
        startDate: tomorrow.toISOString().split('T')[0],
        dueTime: newTime
      }));
    } else {
      setFormData(prev => ({ ...prev, dueTime: newTime }));
    }
    setShowConflictAlert(false);
    toast.success(`השעה שונתה ל-${newTime}${isTomorrow ? ' מחר' : ''}`);
  };

  // התעלמות מהתראה והמשך
  const handleIgnoreConflict = () => {
    setShowConflictAlert(false);
    setConflictChecked(true);
    handleSubmit({ preventDefault: () => {} });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* התראת חפיפות */}
      {showConflictAlert && conflictInfo && (
        <ScheduleConflictAlert
          newTask={{
            dueDate: formData.startDate,
            dueTime: formData.dueTime,
            estimatedDuration: parseInt(formData.estimatedDuration) || 30,
            priority: formData.priority
          }}
          existingTasks={tasks}
          onDefer={handleDeferConflicts}
          onChangeTime={handleChangeTime}
          onIgnore={handleIgnoreConflict}
          onCancel={() => setShowConflictAlert(false)}
        />
      )}

      {/* שם המשימה */}
      <Input
        label="שם המשימה *"
        name="title"
        value={formData.title}
        onChange={handleChange}
        placeholder="מה צריך לעשות?"
        autoFocus
      />

      {/* דחיפות */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          🚦 דחיפות
        </label>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, priority: 'urgent' }))}
            className={`
              flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all
              ${formData.priority === 'urgent'
                ? 'border-red-500 bg-red-50 dark:bg-red-900/30'
                : 'border-gray-200 dark:border-gray-700 hover:border-red-300'
              }
            `}
          >
            <span className="text-2xl">🔴</span>
            <span className="text-sm font-medium">דחוף</span>
          </button>
          <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, priority: 'high' }))}
            className={`
              flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all
              ${formData.priority === 'high'
                ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/30'
                : 'border-gray-200 dark:border-gray-700 hover:border-yellow-300'
              }
            `}
          >
            <span className="text-2xl">🟡</span>
            <span className="text-sm font-medium">בינוני</span>
          </button>
          <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, priority: 'normal' }))}
            className={`
              flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all
              ${formData.priority === 'normal'
                ? 'border-green-500 bg-green-50 dark:bg-green-900/30'
                : 'border-gray-200 dark:border-gray-700 hover:border-green-300'
              }
            `}
          >
            <span className="text-2xl">🟢</span>
            <span className="text-sm font-medium">לא דחוף</span>
          </button>
        </div>
      </div>

      {/* סוג משימה */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          סוג משימה *
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.values(taskTypes).map(type => (
            <button
              key={type.id}
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, taskType: type.id }))}
              className={`
                p-3 rounded-lg border-2 text-center transition-all
                ${formData.taskType === type.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }
              `}
            >
              <span className="text-xl block mb-1">{type.icon}</span>
              <span className="text-sm">{type.name}</span>
            </button>
          ))}
        </div>
        
        {/* הצגת נתוני למידה אם יש */}
        {learningData && learningData.total_tasks > 0 && (
          <div className="mt-2 p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-sm text-purple-700 dark:text-purple-300">
            <span className="font-medium">🧠 המערכת למדה: </span>
            עשית {learningData.total_tasks} משימות מסוג זה. 
            {learningData.average_ratio > 1.1 && (
              <span> את נוטה להעריך פחות מדי (פי {learningData.average_ratio.toFixed(1)}).</span>
            )}
            {learningData.average_ratio < 0.9 && (
              <span> את נוטה להעריך יותר מדי.</span>
            )}
          </div>
        )}
      </div>

      {/* זמן משוער */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            זמן משוער (דקות) *
          </label>
          {suggestedTime && suggestedTime !== parseInt(formData.estimatedDuration) && (
            <button
              type="button"
              onClick={handleAcceptSuggestion}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              🎯 המלצה: {suggestedTime} דקות
            </button>
          )}
        </div>
        <Input
          type="number"
          name="estimatedDuration"
          value={formData.estimatedDuration}
          onChange={handleChange}
          placeholder="כמה דקות לדעתך?"
          min="1"
        />
        
        {/* הסבר על ההמלצה */}
        {suggestedTime && !formData.estimatedDuration && (
          <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <strong>💡 למה {suggestedTime} דקות?</strong>
              <div className="text-xs mt-1 text-blue-600 dark:text-blue-300">
                {learningData && learningData.total_tasks > 0 ? (
                  <>
                    לפי {learningData.total_tasks} משימות קודמות מסוג "{selectedType?.name}",
                    זה הזמן הממוצע שלקח לך בפועל.
                  </>
                ) : (
                  <>
                    זו הערכה ראשונית. אחרי שתסיימי כמה משימות מסוג זה, המערכת תלמד את הקצב שלך.
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* תאריכים */}
      <div className="space-y-3">
        {/* בחירת סוג משימה */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIsLongTask(false)}
            className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all ${
              !isLongTask
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700'
                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
            }`}
          >
            📋 משימה פשוטה
          </button>
          <button
            type="button"
            onClick={() => setIsLongTask(true)}
            className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all ${
              isLongTask
                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700'
                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
            }`}
          >
            📅 משימה ארוכה (עם דדליין)
          </button>
        </div>

        {!isLongTask ? (
          /* משימה פשוטה - תאריך אחד + שעה */
          <>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="תאריך"
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
              />
              <Input
                label="שעה (אופציונלי)"
                type="time"
                name="dueTime"
                value={formData.dueTime}
                onChange={handleChange}
              />
            </div>
            
            {/* הצעות לזמנים פנויים - מוצג כשיש משך זמן אבל עדיין לא בחרו שעה */}
            {slotSuggestions?.hasSuggestions && !formData.dueTime && (
              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                <div className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                  💡 הצעות לזמנים פנויים:
                </div>
                <div className="flex flex-wrap gap-2">
                  {slotSuggestions.suggestions.slice(0, 4).map((slot, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          startDate: slot.date,
                          dueTime: slot.time
                        }));
                        toast.success(`נבחר: ${slot.displayText}`);
                      }}
                      className={`
                        px-3 py-2 rounded-lg text-sm font-medium transition-all
                        ${idx === 0 
                          ? 'bg-blue-500 text-white hover:bg-blue-600' 
                          : 'bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                        }
                      `}
                    >
                      <div>{slot.dateLabel}</div>
                      <div className="text-xs opacity-80">{slot.time}</div>
                    </button>
                  ))}
                </div>
                {slotSuggestions.suggestions.length > 0 && (
                  <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                    {slotSuggestions.suggestions[0].loadPercent}% מהיום תפוס • נשארו {slotSuggestions.suggestions[0].remainingMinutes} דק׳
                  </div>
                )}
              </div>
            )}
            
            {/* אינדיקציה לחפיפות בזמן אמת */}
            {conflictInfo && !showConflictAlert && (
              <div className="mt-2 p-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-orange-700 dark:text-orange-300">
                  <span>⚠️</span>
                  <span>
                    {conflictInfo.overlappingTasks.length > 0 
                      ? `חופף ל-${conflictInfo.overlappingTasks.length} משימות קיימות`
                      : `היום עמוס (חסרות ${conflictInfo.overloadAmount} דק׳)`
                    }
                  </span>
                </div>
              </div>
            )}
          </>
        ) : (
          /* משימה ארוכה - תאריך התחלה + דדליין */
          <div className="space-y-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="📅 תאריך התחלה"
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
              />
              <Input
                label="🎯 דדליין לסיום"
                type="date"
                name="dueDate"
                value={formData.dueDate}
                onChange={handleChange}
                min={formData.startDate}
              />
            </div>
            
            {/* תצוגה מקדימה של הפיצול */}
            {formData.startDate && formData.dueDate && formData.estimatedDuration && (
              <SplitPreview 
                startDate={formData.startDate}
                dueDate={formData.dueDate}
                duration={parseInt(formData.estimatedDuration)}
              />
            )}
          </div>
        )}
      </div>

      {/* תיאור */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          הערות (אופציונלי)
        </label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                     focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="פרטים נוספים..."
        />
      </div>

      {/* כפתורים */}
      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={loading} className="flex-1">
          {isEditing ? 'שמור שינויים' : 'הוסף משימה'}
        </Button>
        <Button type="button" variant="secondary" onClick={onClose}>
          ביטול
        </Button>
      </div>
    </form>
  );
}

/**
 * תצוגה מקדימה של פיצול משימה
 */
function SplitPreview({ startDate, dueDate, duration }) {
  const start = new Date(startDate);
  const end = new Date(dueDate);
  const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
  const maxChunkSize = 45;
  const totalChunks = Math.ceil(duration / maxChunkSize);
  
  // חישוב פיזור על פני ימים
  const dailyBreakdown = [];
  let remaining = duration;
  let currentDate = new Date(start);
  
  while (remaining > 0 && currentDate <= end) {
    const daysLeft = Math.ceil((end - currentDate) / (1000 * 60 * 60 * 24)) + 1;
    let todayTotal = Math.ceil(remaining / daysLeft);
    const todayChunks = Math.ceil(todayTotal / maxChunkSize);
    
    const chunks = [];
    let todayRemaining = Math.min(todayTotal, remaining);
    for (let i = 0; i < todayChunks && todayRemaining > 0; i++) {
      const chunk = Math.min(maxChunkSize, todayRemaining);
      chunks.push(chunk);
      todayRemaining -= chunk;
      remaining -= chunk;
    }
    
    if (chunks.length > 0) {
      dailyBreakdown.push({
        date: new Date(currentDate),
        chunks
      });
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }

  const days = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
  
  return (
    <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-purple-300 dark:border-purple-700">
      <div className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-2">
        ✂️ המשימה תפוצל אוטומטית:
      </div>
      <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
        {duration} דקות ÷ {daysDiff} ימים = {totalChunks} מקטעים של עד 45 דק'
      </div>
      <div className="space-y-1.5">
        {dailyBreakdown.map((day, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-16 text-gray-500">
              יום {days[day.date.getDay()]} {day.date.getDate()}/{day.date.getMonth() + 1}
            </span>
            <div className="flex gap-1 flex-1">
              {day.chunks.map((chunk, j) => (
                <span 
                  key={j}
                  className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded"
                >
                  {chunk} דק'
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SimpleTaskForm;

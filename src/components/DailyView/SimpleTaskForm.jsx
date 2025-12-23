import { useState, useEffect } from 'react';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../hooks/useAuth';
import { getTaskTypeLearning } from '../../services/supabase';
import { findOverlappingTasks, findNextFreeSlot, timeToMinutes, minutesToTime, formatMinutes } from '../../utils/timeOverlap';
import toast from 'react-hot-toast';
import Input from '../UI/Input';
import Button from '../UI/Button';

/**
 * טופס משימה פשוט - מותאם לניהול זמן
 */
function SimpleTaskForm({ task, onClose, taskTypes, defaultDate, existingTasks = [] }) {
  const { addTask, editTask } = useTasks();
  const { user } = useAuth();
  const isEditing = !!task;

  // סטייט הטופס
  const [formData, setFormData] = useState({
    title: '',
    taskType: 'other',
    estimatedDuration: '',
    dueDate: defaultDate || new Date().toISOString().split('T')[0],
    dueTime: '',
    description: '',
    priority: 'normal' // normal, high, urgent, low
  });

  const [loading, setLoading] = useState(false);
  const [learningData, setLearningData] = useState(null);
  const [suggestedTime, setSuggestedTime] = useState(null);
  const [overlapWarning, setOverlapWarning] = useState(null); // {overlappingTasks, suggestedTime}

  // מילוי נתונים בעריכה
  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || '',
        taskType: task.task_type || 'other',
        estimatedDuration: task.estimated_duration || '',
        dueDate: task.due_date || defaultDate || new Date().toISOString().split('T')[0],
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
  const handleSubmit = async (e, forceSubmit = false) => {
    e?.preventDefault();

    // וידוא
    if (!formData.title.trim()) {
      toast.error('נא להזין שם משימה');
      return;
    }

    if (!formData.estimatedDuration || parseInt(formData.estimatedDuration) <= 0) {
      toast.error('נא להזין זמן משוער');
      return;
    }

    // בדיקת חפיפות (רק אם יש תאריך ושעה, ולא מדלגים על הבדיקה)
    if (!forceSubmit && formData.dueDate && formData.dueTime) {
      const newTaskData = {
        id: task?.id,
        dueDate: formData.dueDate,
        dueTime: formData.dueTime,
        estimatedDuration: parseInt(formData.estimatedDuration)
      };

      const overlapping = findOverlappingTasks(newTaskData, existingTasks);
      
      if (overlapping.length > 0) {
        // מציאת זמן פנוי חלופי
        const nextFree = findNextFreeSlot(
          formData.dueDate,
          parseInt(formData.estimatedDuration),
          existingTasks
        );

        setOverlapWarning({
          overlappingTasks: overlapping,
          suggestedTime: nextFree
        });
        return; // לא שולחים - מחכים להחלטה
      }
    }

    // ניקוי אזהרה
    setOverlapWarning(null);
    setLoading(true);

    try {
      const taskData = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        taskType: formData.taskType,
        estimatedDuration: parseInt(formData.estimatedDuration),
        dueDate: formData.dueDate || null,
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

      onClose();
    } catch (err) {
      console.error('שגיאה:', err);
      toast.error(err.message || 'שגיאה בשמירת המשימה');
    } finally {
      setLoading(false);
    }
  };

  // קבלת הזמן המוצע מאזהרת החפיפה
  const handleAcceptAlternativeTime = () => {
    if (overlapWarning?.suggestedTime) {
      setFormData(prev => ({ ...prev, dueTime: overlapWarning.suggestedTime }));
      setOverlapWarning(null);
      toast.success(`השעה שונתה ל-${overlapWarning.suggestedTime}`);
    }
  };

  // שמירה למרות החפיפה
  const handleForceSubmit = () => {
    setOverlapWarning(null);
    handleSubmit(null, true);
  };

  const selectedType = taskTypes[formData.taskType];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* שם המשימה */}
      <Input
        label="שם המשימה *"
        name="title"
        value={formData.title}
        onChange={handleChange}
        placeholder="מה צריך לעשות?"
        autoFocus
      />

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
                  ? type.color + ' border-current ring-2 ring-offset-2 ring-current'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
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

      {/* תאריך ושעה */}
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="תאריך"
          type="date"
          name="dueDate"
          value={formData.dueDate}
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

      {/* עדיפות */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          עדיפות
        </label>
        <div className="flex gap-2">
          {[
            { id: 'low', name: 'נמוכה', icon: '⚪', color: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400' },
            { id: 'normal', name: 'רגילה', icon: '🔵', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
            { id: 'high', name: 'גבוהה', icon: '🟠', color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' },
            { id: 'urgent', name: 'דחוף!', icon: '🔴', color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' }
          ].map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, priority: p.id }))}
              className={`
                flex-1 py-2 rounded-lg border-2 font-medium transition-all text-sm
                ${formData.priority === p.id
                  ? `${p.color} border-current ring-2 ring-offset-1`
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 bg-white dark:bg-gray-800'
                }
              `}
            >
              {p.icon} {p.name}
            </button>
          ))}
        </div>
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

      {/* אזהרת חפיפה */}
      {overlapWarning && (
        <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-300 dark:border-orange-700 rounded-lg">
          <div className="flex items-start gap-2 mb-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h4 className="font-bold text-orange-800 dark:text-orange-200">
                יש חפיפה בזמנים!
              </h4>
              <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                המשימה חופפת עם:
              </p>
            </div>
          </div>
          
          <div className="space-y-2 mb-4">
            {overlapWarning.overlappingTasks.map(t => {
              const taskType = taskTypes[t.task_type] || taskTypes.other;
              const endTime = timeToMinutes(t.due_time) + (t.estimated_duration || 30);
              return (
                <div key={t.id} className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded">
                  <span>{taskType?.icon}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{t.title}</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400 mr-auto">
                    {t.due_time} - {minutesToTime(endTime)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-2">
            {overlapWarning.suggestedTime && (
              <button
                type="button"
                onClick={handleAcceptAlternativeTime}
                className="w-full py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors"
              >
                ✅ העבר ל-{overlapWarning.suggestedTime} (זמן פנוי)
              </button>
            )}
            <button
              type="button"
              onClick={handleForceSubmit}
              className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
            >
              ⚡ שמור בכל זאת (חפיפה)
            </button>
            <button
              type="button"
              onClick={() => setOverlapWarning(null)}
              className="w-full py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              ← חזרה לעריכה
            </button>
          </div>
        </div>
      )}

      {/* כפתורים */}
      {!overlapWarning && (
      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={loading} className="flex-1">
          {isEditing ? 'שמור שינויים' : 'הוסף משימה'}
        </Button>
        <Button type="button" variant="secondary" onClick={onClose}>
          ביטול
        </Button>
      </div>
      )}
    </form>
  );
}

export default SimpleTaskForm;

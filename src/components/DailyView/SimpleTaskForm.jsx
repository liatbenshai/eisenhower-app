import { useState, useEffect } from 'react';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../hooks/useAuth';
import { getTaskTypeLearning } from '../../services/supabase';
import toast from 'react-hot-toast';
import Input from '../UI/Input';
import Button from '../UI/Button';

/**
 * טופס משימה פשוט - מותאם לניהול זמן
 */
function SimpleTaskForm({ task, onClose, taskTypes, defaultDate }) {
  const { addTask, editTask } = useTasks();
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

    setLoading(true);

    try {
      const taskData = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        taskType: formData.taskType,
        estimatedDuration: parseInt(formData.estimatedDuration),
        startDate: formData.startDate || null,
        dueDate: isLongTask ? formData.dueDate : formData.startDate, // אם לא משימה ארוכה, dueDate = startDate
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
            {formData.startDate && formData.dueDate && (
              <div className="text-sm text-purple-600 dark:text-purple-400">
                ⏱️ {Math.ceil((new Date(formData.dueDate) - new Date(formData.startDate)) / (1000 * 60 * 60 * 24))} ימים לביצוע
              </div>
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

export default SimpleTaskForm;

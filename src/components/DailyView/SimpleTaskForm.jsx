import { useState, useEffect, useMemo } from 'react';
import { useTasks } from '../../hooks/useTasks';
import { 
  TASK_TYPES, 
  TASK_CATEGORIES,
  getTaskType, 
  getTaskTypesByCategory,
  calculateWorkTime,
  getInputLabel,
  getInputPlaceholder 
} from '../../config/taskTypes';
import toast from 'react-hot-toast';
import Input from '../UI/Input';
import Button from '../UI/Button';

/**
 * טופס משימה חכם - עם חישוב זמן אוטומטי
 */
function SimpleTaskForm({ task, onClose, taskTypes, defaultDate }) {
  const { addTask, editTask } = useTasks();
  const isEditing = !!task;

  // סטייט הטופס
  const [formData, setFormData] = useState({
    title: '',
    taskType: 'transcription',
    inputValue: '', // משך הקלטה / עמודים / דקות ישירות
    dueDate: '',
    dueTime: '',
    description: '',
    priority: 'normal'
  });

  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('work');

  // קבלת סוג המשימה הנוכחי
  const currentTaskType = getTaskType(formData.taskType);

  // חישוב זמן עבודה אוטומטי
  const calculatedDuration = useMemo(() => {
    const inputVal = parseFloat(formData.inputValue);
    if (!inputVal || inputVal <= 0) return null;
    return calculateWorkTime(formData.taskType, inputVal);
  }, [formData.taskType, formData.inputValue]);

  // חישוב כמות בלוקים של 45 דקות
  const blocksCount = useMemo(() => {
    if (!calculatedDuration) return 0;
    return Math.ceil(calculatedDuration / 45);
  }, [calculatedDuration]);

  // מילוי נתונים בעריכה
  useEffect(() => {
    if (task) {
      // מציאת הקטגוריה לפי סוג המשימה
      const taskType = getTaskType(task.task_type);
      setSelectedCategory(taskType.category || 'work');
      
      setFormData({
        title: task.title || '',
        taskType: task.task_type || 'transcription',
        inputValue: task.recording_duration || task.page_count || task.estimated_duration || '',
        dueDate: task.due_date || '',
        dueTime: task.due_time || '',
        description: task.description || '',
        priority: task.priority || 'normal'
      });
    }
  }, [task]);

  // עדכון סוג משימה כשמשתנה קטגוריה
  useEffect(() => {
    const typesInCategory = getTaskTypesByCategory(selectedCategory);
    if (typesInCategory.length > 0 && !typesInCategory.find(t => t.id === formData.taskType)) {
      setFormData(prev => ({ ...prev, taskType: typesInCategory[0].id }));
    }
  }, [selectedCategory]);

  // טיפול בשינוי שדה
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // שליחת הטופס
  const handleSubmit = async (e) => {
    e.preventDefault();

    // וידוא
    if (!formData.title.trim()) {
      toast.error('נא להזין שם משימה');
      return;
    }

    if (!formData.inputValue || parseFloat(formData.inputValue) <= 0) {
      toast.error('נא להזין ערך תקין');
      return;
    }

    if (!calculatedDuration) {
      toast.error('שגיאה בחישוב זמן');
      return;
    }

    setLoading(true);

    try {
      const taskData = {
        title: formData.title.trim(),
        task_type: formData.taskType,
        estimated_duration: calculatedDuration,
        due_date: formData.dueDate || null,
        due_time: formData.dueTime || null,
        description: formData.description || null,
        priority: formData.priority,
        // שמירת הקלט המקורי ללמידה עתידית
        recording_duration: currentTaskType.inputType === 'recording' ? parseFloat(formData.inputValue) : null,
        page_count: currentTaskType.inputType === 'pages' ? parseFloat(formData.inputValue) : null
      };

      if (isEditing) {
        await editTask(task.id, taskData);
        toast.success('המשימה עודכנה');
      } else {
        await addTask(taskData);
        toast.success(`נוספה משימה: ${blocksCount} בלוקים של 45 דק'`);
      }

      onClose();
    } catch (error) {
      console.error('שגיאה בשמירת משימה:', error);
      toast.error('שגיאה בשמירת המשימה');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" dir="rtl">
      
      {/* בחירת קטגוריה */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          קטגוריה
        </label>
        <div className="flex gap-2">
          {Object.values(TASK_CATEGORIES).map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`
                flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all
                ${selectedCategory === cat.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                }
              `}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* בחירת סוג משימה */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          סוג משימה
        </label>
        <div className="grid grid-cols-2 gap-2">
          {getTaskTypesByCategory(selectedCategory).map(type => (
            <button
              key={type.id}
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, taskType: type.id }))}
              className={`
                py-2 px-3 rounded-lg text-sm font-medium transition-all text-right
                ${formData.taskType === type.id
                  ? `${type.bgLight} ${type.text} ${type.border} border-2`
                  : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-100'
                }
              `}
            >
              {type.icon} {type.name}
            </button>
          ))}
        </div>
      </div>

      {/* שם המשימה */}
      <Input
        label="שם המשימה"
        name="title"
        value={formData.title}
        onChange={handleChange}
        placeholder="לדוגמה: תמלול דורון אריאל"
        required
      />

      {/* שדה קלט דינמי לפי סוג */}
      <div>
        <Input
          label={getInputLabel(formData.taskType)}
          type="number"
          name="inputValue"
          value={formData.inputValue}
          onChange={handleChange}
          placeholder={getInputPlaceholder(formData.taskType)}
          min="1"
          required
        />
        
        {/* תצוגת חישוב */}
        {calculatedDuration && (
          <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
            <div className="flex items-center justify-between">
              <span className="text-sm text-green-700 dark:text-green-300">
                ⏱️ זמן עבודה משוער:
              </span>
              <span className="font-bold text-green-800 dark:text-green-200">
                {calculatedDuration} דקות
              </span>
            </div>
            <div className="mt-1 text-xs text-green-600 dark:text-green-400">
              יחולק ל-{blocksCount} בלוקים של 45 דקות (+ הפסקות של 5 דק')
            </div>
          </div>
        )}
      </div>

      {/* עדיפות */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          עדיפות
        </label>
        <div className="flex gap-2">
          {[
            { id: 'urgent', label: '🔴 דחוף', color: 'red' },
            { id: 'high', label: '🟠 גבוה', color: 'orange' },
            { id: 'normal', label: '🟢 רגיל', color: 'green' }
          ].map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, priority: p.id }))}
              className={`
                flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all
                ${formData.priority === p.id
                  ? `bg-${p.color}-100 text-${p.color}-700 border-2 border-${p.color}-500`
                  : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200'
                }
              `}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* דדליין */}
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="דדליין (אופציונלי)"
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

      {/* הערות */}
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

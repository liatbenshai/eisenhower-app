import { useState, useEffect } from 'react';
import { useTasks } from '../../hooks/useTasks';
import { validateTaskForm } from '../../utils/validators';
import { QUADRANT_NAMES, QUADRANT_ICONS } from '../../utils/taskHelpers';
import { getTodayISO } from '../../utils/dateHelpers';
import toast from 'react-hot-toast';
import Input from '../UI/Input';
import Button from '../UI/Button';

/**
 * טופס הוספה/עריכת משימה
 */
function TaskForm({ task, defaultQuadrant = 1, onClose }) {
  const { addTask, editTask } = useTasks();
  const isEditing = !!task;

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    quadrant: defaultQuadrant,
    dueDate: '',
    dueTime: '',
    reminderMinutes: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  // מילוי נתונים בעריכה
  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || '',
        description: task.description || '',
        quadrant: task.quadrant || 1,
        dueDate: task.due_date || '',
        dueTime: task.due_time || '',
        reminderMinutes: task.reminder_minutes || ''
      });
    }
  }, [task]);

  // טיפול בשינוי שדה
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // שליחת הטופס
  const handleSubmit = async (e) => {
    e.preventDefault();

    // אימות
    const validation = validateTaskForm(formData);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setLoading(true);
    try {
      if (isEditing) {
        await editTask(task.id, formData);
        toast.success('המשימה עודכנה');
      } else {
        await addTask(formData);
        toast.success('המשימה נוספה');
      }
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // אפשרויות תזכורת
  const reminderOptions = [
    { value: '', label: 'ללא תזכורת' },
    { value: '15', label: '15 דקות לפני' },
    { value: '30', label: '30 דקות לפני' },
    { value: '60', label: 'שעה לפני' },
    { value: '1440', label: 'יום לפני' }
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* כותרת */}
      <Input
        label="כותרת המשימה"
        name="title"
        value={formData.title}
        onChange={handleChange}
        error={errors.title}
        placeholder="הזן את כותרת המשימה"
        required
        autoFocus
      />

      {/* תיאור */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          תיאור (אופציונלי)
        </label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows={3}
          className="input-field resize-none"
          placeholder="הוסף פרטים נוספים..."
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-500">{errors.description}</p>
        )}
      </div>

      {/* בחירת רבע */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          רבע במטריצה
        </label>
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map(q => (
            <button
              key={q}
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, quadrant: q }))}
              className={`
                flex items-center gap-2 p-3 rounded-lg border-2 transition-all
                ${formData.quadrant === q
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }
              `}
            >
              <span className="text-lg">{QUADRANT_ICONS[q]}</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {QUADRANT_NAMES[q]}
              </span>
            </button>
          ))}
        </div>
        {errors.quadrant && (
          <p className="mt-1 text-sm text-red-500">{errors.quadrant}</p>
        )}
      </div>

      {/* תאריך ושעה */}
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="תאריך יעד"
          type="date"
          name="dueDate"
          value={formData.dueDate}
          onChange={handleChange}
          error={errors.dueDate}
          min={getTodayISO()}
        />
        <Input
          label="שעה"
          type="time"
          name="dueTime"
          value={formData.dueTime}
          onChange={handleChange}
          error={errors.dueTime}
        />
      </div>

      {/* תזכורת */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          תזכורת
        </label>
        <select
          name="reminderMinutes"
          value={formData.reminderMinutes}
          onChange={handleChange}
          className="input-field"
        >
          {reminderOptions.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* כפתורים */}
      <div className="flex gap-3 pt-4">
        <Button type="submit" loading={loading} fullWidth>
          {isEditing ? 'שמור שינויים' : 'הוסף משימה'}
        </Button>
        <Button type="button" variant="secondary" onClick={onClose}>
          ביטול
        </Button>
      </div>
    </form>
  );
}

export default TaskForm;


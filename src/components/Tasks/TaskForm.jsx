import { useState, useEffect, useMemo } from 'react';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../hooks/useAuth';
import { validateTaskForm } from '../../utils/validators';
import { QUADRANT_NAMES, QUADRANT_ICONS } from '../../utils/taskHelpers';
import { getTodayISO } from '../../utils/dateHelpers';
import { createTaskTemplate } from '../../services/supabase';
import { suggestEstimatedTime } from '../../utils/timeEstimation';
import toast from 'react-hot-toast';
import Input from '../UI/Input';
import Button from '../UI/Button';

/**
 * טופס הוספה/עריכת משימה
 */
function TaskForm({ task, defaultQuadrant = 1, onClose }) {
  const { addTask, editTask, tasks } = useTasks();
  const { user } = useAuth();
  const isEditing = !!task;

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    quadrant: defaultQuadrant,
    dueDate: '',
    dueTime: '',
    reminderMinutes: '',
    estimatedDuration: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState(null);

  // חישוב הצעת זמן משוער
  const timeSuggestion = useMemo(() => {
    if (!formData.title || formData.title.length < 3) return null;
    
    const currentTask = {
      title: formData.title,
      quadrant: formData.quadrant,
      estimated_duration: formData.estimatedDuration ? parseInt(formData.estimatedDuration) : null
    };
    
    return suggestEstimatedTime(tasks || [], currentTask);
  }, [formData.title, formData.quadrant, formData.estimatedDuration, tasks]);

  // מילוי נתונים בעריכה
  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || '',
        description: task.description || '',
        quadrant: task.quadrant || 1,
        dueDate: task.due_date || '',
        dueTime: task.due_time || '',
        reminderMinutes: task.reminder_minutes || '',
        estimatedDuration: task.estimated_duration || ''
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
        console.log('שולח משימה חדשה:', formData);
        await addTask(formData);
        toast.success('המשימה נוספה');
      }
      onClose();
    } catch (err) {
      console.error('שגיאה בשליחת טופס:', err);
      toast.error(err.message || 'שגיאה בשמירת המשימה');
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

      {/* זמן ביצוע משוער עם הצעה אוטומטית */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            זמן ביצוע משוער (דקות)
          </label>
          {timeSuggestion && (
            <button
              type="button"
              onClick={() => {
                setFormData(prev => ({ ...prev, estimatedDuration: timeSuggestion.suggestedTime.toString() }));
                toast.success(`הוגדר ${timeSuggestion.suggestedTime} דקות (${timeSuggestion.reason})`);
              }}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              💡 השתמש בהצעה: {timeSuggestion.suggestedTime} דקות
            </button>
          )}
        </div>
        <Input
          type="number"
          name="estimatedDuration"
          value={formData.estimatedDuration}
          onChange={handleChange}
          error={errors.estimatedDuration}
          min="1"
          placeholder="הזן זמן משוער"
        />
        {timeSuggestion && (
          <div className={`mt-1 text-xs p-2 rounded ${
            timeSuggestion.confidence === 'high' 
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
              : timeSuggestion.confidence === 'medium'
              ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300'
              : 'bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400'
          }`}>
            <div className="font-medium">💡 הצעה אוטומטית: {timeSuggestion.suggestedTime} דקות</div>
            <div className="text-xs mt-1">{timeSuggestion.reason}</div>
            <div className="text-xs mt-1">
              רמת ביטחון: {
                timeSuggestion.confidence === 'high' ? 'גבוהה' :
                timeSuggestion.confidence === 'medium' ? 'בינונית' :
                timeSuggestion.confidence === 'low' ? 'נמוכה' : 'נמוכה מאוד'
              }
            </div>
          </div>
        )}
      </div>

      {/* כפתורים */}
      <div className="space-y-3 pt-4">
        <div className="flex gap-3">
          <Button type="submit" loading={loading} fullWidth>
            {isEditing ? 'שמור שינויים' : 'הוסף משימה'}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            ביטול
          </Button>
        </div>
        {!isEditing && (
          <Button
            type="button"
            variant="secondary"
            onClick={async () => {
              if (!user?.id) {
                toast.error('יש להתחבר כדי לשמור תבנית');
                return;
              }
              try {
                await createTaskTemplate({
                  user_id: user.id,
                  title: formData.title,
                  description: formData.description || null,
                  quadrant: formData.quadrant,
                  due_time: formData.dueTime || null,
                  reminder_minutes: formData.reminderMinutes ? parseInt(formData.reminderMinutes) : null,
                  estimated_duration: formData.estimatedDuration ? parseInt(formData.estimatedDuration) : null,
                  is_project: false
                });
                toast.success('תבנית נשמרה!');
              } catch (err) {
                console.error('שגיאה בשמירת תבנית:', err);
                toast.error('שגיאה בשמירת תבנית');
              }
            }}
            className="w-full"
          >
            💾 שמור כתבנית
          </Button>
        )}
      </div>
    </form>
  );
}

export default TaskForm;


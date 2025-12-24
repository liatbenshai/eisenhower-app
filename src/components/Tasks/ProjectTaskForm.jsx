import { useState, useEffect } from 'react';
import { useTasks } from '../../hooks/useTasks';
import { validateTaskForm } from '../../utils/validators';
import { 
  generateSubtaskPlan, 
  suggestNumSubtasks, 
  suggestTotalDuration 
} from '../../utils/projectPlanner';
import { QUADRANT_NAMES, QUADRANT_ICONS, determineQuadrant, getQuadrantExplanation } from '../../utils/taskHelpers';
import { getTodayISO } from '../../utils/dateHelpers';
import toast from 'react-hot-toast';
import Input from '../UI/Input';
import Button from '../UI/Button';

/**
 * טופס יצירת משימה עם שלבים (פרויקט)
 */
function ProjectTaskForm({ defaultQuadrant = 1, onClose }) {
  const { addProjectTask, tasks } = useTasks();
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    quadrant: defaultQuadrant,
    startDate: '',
    dueDate: '',
    dueTime: '',
    totalDuration: '', // בדקות
    numSubtasks: 3,
    reminderMinutes: ''
  });

  const [subtasks, setSubtasks] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [autoSuggest, setAutoSuggest] = useState(true);
  const [autoQuadrant, setAutoQuadrant] = useState(true);
  const [quadrantExplanation, setQuadrantExplanation] = useState(null);

  // חישוב הצעות אוטומטיות
  useEffect(() => {
    if (autoSuggest && formData.startDate && formData.dueDate && formData.totalDuration) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.dueDate);
      
      if (end > start) {
        // הצעה למספר שלבים
        const suggestedNum = suggestNumSubtasks(start, end, parseInt(formData.totalDuration) || 0);
        setFormData(prev => ({ ...prev, numSubtasks: suggestedNum }));
        
        // יצירת תוכנית שלבים
        const plan = generateSubtaskPlan({
          startDate: start,
          endDate: end,
          totalDuration: parseInt(formData.totalDuration) || 0,
          numSubtasks: suggestedNum
        });
        setSubtasks(plan);
      }
    }
  }, [formData.startDate, formData.dueDate, formData.totalDuration, autoSuggest]);

  // קביעת הרביע אוטומטית
  useEffect(() => {
    if (autoQuadrant && (formData.title || formData.dueDate)) {
      const taskData = {
        title: formData.title,
        description: formData.description,
        dueDate: formData.dueDate,
        dueTime: formData.dueTime
      };
      
      const explanation = getQuadrantExplanation(taskData, tasks || []);
      setFormData(prev => ({ ...prev, quadrant: explanation.quadrant }));
      setQuadrantExplanation(explanation);
    }
  }, [formData.title, formData.description, formData.dueDate, formData.dueTime, autoQuadrant, tasks]);

  // עדכון מספר שלבים
  useEffect(() => {
    if (formData.startDate && formData.dueDate && formData.totalDuration) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.dueDate);
      
      if (end > start) {
        const plan = generateSubtaskPlan({
          startDate: start,
          endDate: end,
          totalDuration: parseInt(formData.totalDuration) || 0,
          numSubtasks: formData.numSubtasks
        });
        setSubtasks(plan);
      }
    }
  }, [formData.numSubtasks]);

  // טיפול בשינוי שדה
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // עדכון שלב
  const updateSubtask = (index, field, value) => {
    setSubtasks(prev => prev.map((st, i) => 
      i === index ? { ...st, [field]: value } : st
    ));
  };

  // הוספת שלב
  const addSubtask = () => {
    const lastDate = subtasks.length > 0 
      ? subtasks[subtasks.length - 1].dueDate 
      : formData.dueDate;
    
    setSubtasks(prev => [...prev, {
      title: `שלב ${prev.length + 1}`,
      description: '',
      dueDate: lastDate,
      dueTime: null,
      estimatedDuration: 0,
      orderIndex: prev.length
    }]);
  };

  // מחיקת שלב
  const removeSubtask = (index) => {
    setSubtasks(prev => prev.filter((_, i) => i !== index).map((st, i) => ({
      ...st,
      orderIndex: i
    })));
  };

  // הצעה אוטומטית לזמן כולל
  const suggestDuration = () => {
    if (formData.startDate && formData.dueDate && formData.numSubtasks) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.dueDate);
      const suggested = suggestTotalDuration(formData.numSubtasks, start, end);
      setFormData(prev => ({ ...prev, totalDuration: suggested.toString() }));
    }
  };

  // שליחת הטופס
  const handleSubmit = async (e) => {
    e.preventDefault();

    // אימות בסיסי
    if (!formData.title.trim()) {
      setErrors({ title: 'כותרת המשימה חובה' });
      return;
    }

    if (!formData.startDate || !formData.dueDate) {
      setErrors({ dueDate: 'תאריכי התחלה ויעד חובה' });
      return;
    }

    if (new Date(formData.dueDate) <= new Date(formData.startDate)) {
      setErrors({ dueDate: 'תאריך היעד חייב להיות אחרי תאריך ההתחלה' });
      return;
    }

    if (subtasks.length === 0) {
      toast.error('יש להוסיף לפחות שלב אחד');
      return;
    }

    setLoading(true);
    try {
      console.log('יוצר פרויקט עם שלבים:', { formData, subtasks });
      await addProjectTask({
        ...formData,
        subtasks
      });
      toast.success(`הפרויקט נוצר בהצלחה עם ${subtasks.length} שלבים`);
      onClose();
    } catch (err) {
      console.error('שגיאה ביצירת פרויקט:', err);
      toast.error(err.message || 'שגיאה ביצירת הפרויקט');
    } finally {
      setLoading(false);
    }
  };

  const reminderOptions = [
    { value: '', label: 'ללא תזכורת' },
    { value: '15', label: '15 דקות לפני' },
    { value: '30', label: '30 דקות לפני' },
    { value: '60', label: 'שעה לפני' },
    { value: '1440', label: 'יום לפני' }
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-h-[90vh] overflow-y-auto">
      {/* כותרת */}
      <Input
        label="כותרת הפרויקט"
        name="title"
        value={formData.title}
        onChange={handleChange}
        error={errors.title}
        placeholder="הזן את כותרת הפרויקט"
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
          placeholder="הוסף פרטים נוספים על הפרויקט..."
        />
      </div>

      {/* בחירת רבע */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            רבע במטריצה
          </label>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="autoQuadrantProject"
              checked={autoQuadrant}
              onChange={(e) => {
                setAutoQuadrant(e.target.checked);
                if (e.target.checked) {
                  const taskData = {
                    title: formData.title,
                    description: formData.description,
                    dueDate: formData.dueDate,
                    dueTime: formData.dueTime
                  };
                  const explanation = getQuadrantExplanation(taskData, tasks || []);
                  setFormData(prev => ({ ...prev, quadrant: explanation.quadrant }));
                  setQuadrantExplanation(explanation);
                }
              }}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="autoQuadrantProject" className="text-xs text-gray-600 dark:text-gray-400">
              קביעה אוטומטית
            </label>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map(q => (
            <button
              key={q}
              type="button"
              onClick={() => {
                setFormData(prev => ({ ...prev, quadrant: q }));
                setAutoQuadrant(false);
              }}
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
        {quadrantExplanation && autoQuadrant && (
          <p className="mt-2 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-2 rounded">
            💡 נקבע אוטומטית: {quadrantExplanation.reason}
          </p>
        )}
      </div>

      {/* תאריכים ושעה */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="תאריך התחלה"
            type="date"
            name="startDate"
            value={formData.startDate}
            onChange={handleChange}
            error={errors.startDate}
            min={getTodayISO()}
            required
          />
          <Input
            label="תאריך יעד"
            type="date"
            name="dueDate"
            value={formData.dueDate}
            onChange={handleChange}
            error={errors.dueDate}
            min={formData.startDate || getTodayISO()}
            required
          />
        </div>
        <Input
          label="שעה (אופציונלי)"
          type="time"
          name="dueTime"
          value={formData.dueTime}
          onChange={handleChange}
          error={errors.dueTime}
        />
      </div>

      {/* זמן כולל ומספר שלבים */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              זמן כולל משוער (דקות)
            </label>
            <button
              type="button"
              onClick={suggestDuration}
              className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              הצע אוטומטי
            </button>
          </div>
          <input
            type="number"
            name="totalDuration"
            value={formData.totalDuration}
            onChange={handleChange}
            min="1"
            className="input-field"
            placeholder="לדוגמה: 480 (8 שעות)"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            מספר שלבים
          </label>
          <input
            type="number"
            name="numSubtasks"
            value={formData.numSubtasks}
            onChange={handleChange}
            min="1"
            max="10"
            className="input-field"
          />
        </div>
      </div>

      {/* הצעה אוטומטית */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="autoSuggest"
          checked={autoSuggest}
          onChange={(e) => setAutoSuggest(e.target.checked)}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="autoSuggest" className="text-sm text-gray-700 dark:text-gray-300">
          הצע חלוקה אוטומטית לשלבים
        </label>
      </div>

      {/* שלבים */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            שלבי הפרויקט ({subtasks.length})
          </label>
          <Button
            type="button"
            variant="secondary"
            onClick={addSubtask}
            className="text-sm"
          >
            + הוסף שלב
          </Button>
        </div>

        <div className="space-y-3 max-h-96 overflow-y-auto">
          {subtasks.map((subtask, index) => (
            <div
              key={index}
              className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50"
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  שלב {index + 1}
                </span>
                {subtasks.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSubtask(index)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    מחק
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <input
                  type="text"
                  value={subtask.title}
                  onChange={(e) => updateSubtask(index, 'title', e.target.value)}
                  className="input-field text-sm"
                  placeholder="כותרת השלב"
                  required
                />

                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={subtask.dueDate}
                      onChange={(e) => updateSubtask(index, 'dueDate', e.target.value)}
                      className="input-field text-sm"
                      min={formData.startDate}
                      max={formData.dueDate}
                      required
                    />
                    <input
                      type="time"
                      value={subtask.dueTime || ''}
                      onChange={(e) => updateSubtask(index, 'dueTime', e.target.value)}
                      className="input-field text-sm"
                      placeholder="שעה"
                    />
                  </div>
                  <input
                    type="number"
                    value={subtask.estimatedDuration}
                    onChange={(e) => updateSubtask(index, 'estimatedDuration', parseInt(e.target.value) || 0)}
                    className="input-field text-sm"
                    placeholder="זמן משוער (דקות)"
                    min="0"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {subtasks.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
            לחץ על "הצע חלוקה אוטומטית" או "הוסף שלב" כדי להתחיל
          </p>
        )}
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
      <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button type="submit" loading={loading} fullWidth>
          צור פרויקט
        </Button>
        <Button type="button" variant="secondary" onClick={onClose}>
          ביטול
        </Button>
      </div>
    </form>
  );
}

export default ProjectTaskForm;


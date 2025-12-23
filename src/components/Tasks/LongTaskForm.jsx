import { useState, useEffect, useMemo } from 'react';
import { useTasks } from '../../hooks/useTasks';
import { 
  scheduleLongTask, 
  getScheduleSummary,
  checkScheduleFeasibility,
  findAllFreeSlots
} from '../../utils/autoScheduler';
import { TASK_TYPES } from '../DailyView/DailyView';
import { getTodayISO } from '../../utils/dateHelpers';
import toast from 'react-hot-toast';
import Input from '../UI/Input';
import Button from '../UI/Button';

/**
 * טופס משימה ארוכה עם שיבוץ אוטומטי
 */
function LongTaskForm({ onClose }) {
  const { tasks, addTask, loadTasks } = useTasks();
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    taskType: 'transcription',
    totalHours: '',
    totalMinutes: '',
    startDate: getTodayISO(),
    endDate: '',
    maxSessionMinutes: 90
  });

  const [preview, setPreview] = useState(null);
  const [feasibility, setFeasibility] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // חישוב זמן כולל בדקות
  const totalDuration = useMemo(() => {
    const hours = parseInt(formData.totalHours) || 0;
    const minutes = parseInt(formData.totalMinutes) || 0;
    return hours * 60 + minutes;
  }, [formData.totalHours, formData.totalMinutes]);

  // בדיקת התכנות כשמשתנים הנתונים
  useEffect(() => {
    if (totalDuration > 0 && formData.startDate && formData.endDate) {
      const check = checkScheduleFeasibility(
        totalDuration,
        formData.startDate,
        formData.endDate,
        tasks
      );
      setFeasibility(check);
    } else {
      setFeasibility(null);
    }
  }, [totalDuration, formData.startDate, formData.endDate, tasks]);

  // תצוגה מקדימה של השיבוץ
  useEffect(() => {
    if (totalDuration > 0 && formData.startDate && formData.endDate && formData.title) {
      const result = scheduleLongTask({
        title: formData.title,
        totalDuration,
        startDate: formData.startDate,
        endDate: formData.endDate,
        maxSessionMinutes: parseInt(formData.maxSessionMinutes) || 90,
        taskType: formData.taskType
      }, tasks);
      
      setPreview(result);
    } else {
      setPreview(null);
    }
  }, [totalDuration, formData.startDate, formData.endDate, formData.title, formData.maxSessionMinutes, formData.taskType, tasks]);

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
    if (!formData.title.trim()) {
      setErrors({ title: 'נא להזין כותרת' });
      return;
    }

    if (totalDuration < 30) {
      setErrors({ totalHours: 'משימה חייבת להיות לפחות 30 דקות' });
      return;
    }

    if (!formData.startDate || !formData.endDate) {
      setErrors({ endDate: 'נא לבחור תאריכי התחלה ויעד' });
      return;
    }

    if (new Date(formData.endDate) <= new Date(formData.startDate)) {
      setErrors({ endDate: 'תאריך היעד חייב להיות אחרי ההתחלה' });
      return;
    }

    if (!preview?.success) {
      toast.error(preview?.error || 'לא ניתן לשבץ את המשימה');
      return;
    }

    setLoading(true);
    try {
      // יצירת כל החלקים כמשימות נפרדות
      for (const session of preview.sessions) {
        await addTask({
          title: session.title,
          description: session.description || formData.description,
          quadrant: 1, // דחוף וחשוב
          dueDate: session.dueDate,
          dueTime: session.dueTime,
          estimatedDuration: session.estimatedDuration,
          taskType: formData.taskType,
          parentTaskTitle: formData.title // לקישור בין החלקים
        });
      }

      await loadTasks();
      toast.success(`נוצרו ${preview.sessions.length} משימות בהצלחה!`);
      onClose();
    } catch (err) {
      console.error('שגיאה ביצירת משימות:', err);
      toast.error('שגיאה ביצירת המשימות');
    } finally {
      setLoading(false);
    }
  };

  // פורמט זמן פנוי
  const formatFreeTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} דקות`;
    if (mins === 0) return `${hours} שעות`;
    return `${hours} שעות ו-${mins} דקות`;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* כותרת */}
      <Input
        label="שם המשימה"
        name="title"
        value={formData.title}
        onChange={handleChange}
        error={errors.title}
        placeholder="לדוגמה: תמלול ישיבת הנהלה"
        required
        autoFocus
      />

      {/* סוג משימה */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          סוג המשימה
        </label>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(TASK_TYPES).slice(0, 6).map(([key, type]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, taskType: key }))}
              className={`
                p-2 rounded-lg border text-sm transition-all
                ${formData.taskType === key
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }
              `}
            >
              <span className="text-lg">{type.icon}</span>
              <div className="text-xs mt-1">{type.name}</div>
            </button>
          ))}
        </div>
      </div>

      {/* זמן כולל */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          זמן עבודה כולל
        </label>
        <div className="flex gap-3">
          <div className="flex-1">
            <div className="relative">
              <input
                type="number"
                name="totalHours"
                value={formData.totalHours}
                onChange={handleChange}
                min="0"
                max="100"
                className="input-field pl-16"
                placeholder="0"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                שעות
              </span>
            </div>
          </div>
          <div className="flex-1">
            <div className="relative">
              <input
                type="number"
                name="totalMinutes"
                value={formData.totalMinutes}
                onChange={handleChange}
                min="0"
                max="59"
                className="input-field pl-16"
                placeholder="0"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                דקות
              </span>
            </div>
          </div>
        </div>
        {errors.totalHours && (
          <p className="text-red-500 text-sm mt-1">{errors.totalHours}</p>
        )}
        {totalDuration > 0 && (
          <p className="text-sm text-gray-500 mt-1">
            סה"כ: {formatFreeTime(totalDuration)}
          </p>
        )}
      </div>

      {/* תאריכים */}
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="תאריך התחלה"
          type="date"
          name="startDate"
          value={formData.startDate}
          onChange={handleChange}
          min={getTodayISO()}
          required
        />
        <Input
          label="דדליין"
          type="date"
          name="endDate"
          value={formData.endDate}
          onChange={handleChange}
          error={errors.endDate}
          min={formData.startDate || getTodayISO()}
          required
        />
      </div>

      {/* הגדרות מתקדמות */}
      <details className="text-sm">
        <summary className="cursor-pointer text-gray-600 dark:text-gray-400 hover:text-gray-800">
          הגדרות מתקדמות
        </summary>
        <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              אורך מקסימלי לחלון עבודה (דקות)
            </label>
            <select
              name="maxSessionMinutes"
              value={formData.maxSessionMinutes}
              onChange={handleChange}
              className="input-field"
            >
              <option value="45">45 דקות</option>
              <option value="60">שעה</option>
              <option value="90">שעה וחצי</option>
              <option value="120">שעתיים</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              המערכת תחלק את המשימה לחלקים בגודל הזה
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              תיאור (אופציונלי)
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={2}
              className="input-field resize-none"
              placeholder="פרטים נוספים..."
            />
          </div>
        </div>
      </details>

      {/* בדיקת התכנות */}
      {feasibility && (
        <div className={`p-3 rounded-lg border ${
          feasibility.feasible 
            ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
            : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-xl">{feasibility.feasible ? '✅' : '⚠️'}</span>
            <span className={`text-sm font-medium ${
              feasibility.feasible ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
            }`}>
              {feasibility.message}
            </span>
          </div>
          {feasibility.feasible && (
            <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
              ניצולת: {feasibility.utilizationPercent}% מהזמן הפנוי
            </div>
          )}
        </div>
      )}

      {/* תצוגה מקדימה */}
      {preview?.success && preview.sessions.length > 0 && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-800 px-3 py-2 border-b border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              📅 תצוגה מקדימה - {preview.totalSessions} חלקים
            </h4>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {preview.sessions.map((session, index) => {
              const taskType = TASK_TYPES[formData.taskType] || TASK_TYPES.other;
              return (
                <div 
                  key={index}
                  className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0 flex items-center gap-3"
                >
                  <span className={`px-2 py-1 rounded text-xs ${taskType.color}`}>
                    {taskType.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {session.title}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(session.dueDate).toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short' })}
                      {' • '}
                      {session.dueTime}
                      {' • '}
                      {session.estimatedDuration} דקות
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* כפתורים */}
      <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button 
          type="submit" 
          loading={loading} 
          disabled={!preview?.success}
          fullWidth
        >
          {preview?.success 
            ? `צור ${preview.totalSessions} משימות` 
            : 'שבץ אוטומטית'}
        </Button>
        <Button type="button" variant="secondary" onClick={onClose}>
          ביטול
        </Button>
      </div>
    </form>
  );
}

export default LongTaskForm;

import { useState, useEffect, useMemo } from 'react';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../hooks/useAuth';
import { validateTaskForm } from '../../utils/validators';
import { QUADRANT_NAMES, QUADRANT_ICONS, determineQuadrant, getQuadrantExplanation } from '../../utils/taskHelpers';
import { getTodayISO } from '../../utils/dateHelpers';
import { createTaskTemplate } from '../../services/supabase';
import { suggestEstimatedTime } from '../../utils/timeEstimation';
import { TASK_CATEGORIES, detectTaskCategory } from '../../utils/taskCategories';
import { predictTaskDuration } from '../../utils/taskTypeLearning';
import { getSuggestedTimeWithCorrection, markRuleAsApplied } from '../../utils/timeCorrectionRules';
import toast from 'react-hot-toast';
import Input from '../UI/Input';
import Button from '../UI/Button';

/**
 * טופס הוספה/עריכת משימה
 */
function TaskForm({ task, defaultQuadrant = 1, defaultDate = null, defaultTime = null, onClose }) {
  const { addTask, editTask, tasks } = useTasks();
  const { user } = useAuth();
  const isEditing = !!task;

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    quadrant: defaultQuadrant || 1, // ברירת מחדל אבל לא חובה
    startDate: defaultDate || '',
    dueDate: defaultDate || '',
    dueTime: defaultTime || '',
    reminderMinutes: '',
    estimatedDuration: '',
    taskType: 'other' // ברירת מחדל חשובה!
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [autoQuadrant, setAutoQuadrant] = useState(true); // האם להשתמש בקביעה אוטומטית
  const [quadrantExplanation, setQuadrantExplanation] = useState(null);
  const [detectedCategory, setDetectedCategory] = useState(null);
  const [aiPrediction, setAiPrediction] = useState(null);
  const [correctionSuggestion, setCorrectionSuggestion] = useState(null);

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

  // קביעת הרביע אוטומטית
  useEffect(() => {
    if (autoQuadrant && !isEditing && (formData.title || formData.dueDate)) {
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
  }, [formData.title, formData.description, formData.dueDate, formData.dueTime, autoQuadrant, isEditing, tasks]);

  // מילוי נתונים בעריכה
  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || '',
        description: task.description || '',
        quadrant: task.quadrant || 1,
        startDate: task.start_date || '',
        dueDate: task.due_date || '',
        dueTime: task.due_time || '',
        reminderMinutes: task.reminder_minutes || '',
        estimatedDuration: task.estimated_duration || '',
        taskType: task.task_type || 'other'
      });
    }
  }, [task]);

  // זיהוי אוטומטי של סוג משימה ושליפת חיזוי
  useEffect(() => {
    if (!isEditing && formData.title && formData.title.length >= 3) {
      // זיהוי קטגוריה
      const detection = detectTaskCategory({
        title: formData.title,
        description: formData.description
      });
      
      setDetectedCategory(detection);
      
      // אם יש זיהוי טוב והמשתמש לא שינה ידנית, עדכן אוטומטית
      if (detection.confidence > 50 && formData.taskType === 'other') {
        setFormData(prev => ({ ...prev, taskType: detection.category.id }));
      }
      
      // שליפת חיזוי AI אם יש משתמש מחובר
      if (user?.id) {
        predictTaskDuration(user.id, detection.category.id, {
          quadrant: formData.quadrant,
          title: formData.title,
          description: formData.description
        }).then(prediction => {
          setAiPrediction(prediction);
          
          // אם אין זמן משוער עדיין, הצע את החיזוי
          if (!formData.estimatedDuration) {
            setFormData(prev => ({ 
              ...prev, 
              estimatedDuration: prediction.predictedTime.toString() 
            }));
          }
        }).catch(err => {
          console.error('שגיאה בחיזוי:', err);
        });
      }
    }
  }, [formData.title, formData.description, isEditing, user?.id]);

  // טיפול בכללי תיקון זמן
  useEffect(() => {
    if (!isEditing && user?.id && formData.taskType && formData.estimatedDuration) {
      const estimatedMinutes = parseInt(formData.estimatedDuration);
      if (estimatedMinutes > 0) {
        getSuggestedTimeWithCorrection(user.id, formData.taskType, estimatedMinutes)
          .then(suggestion => {
            if (suggestion.hasCorrection) {
              setCorrectionSuggestion(suggestion);
            } else {
              setCorrectionSuggestion(null);
            }
          })
          .catch(err => {
            console.error('שגיאה בקבלת כלל תיקון:', err);
            setCorrectionSuggestion(null);
          });
      } else {
        setCorrectionSuggestion(null);
      }
    } else {
      setCorrectionSuggestion(null);
    }
  }, [formData.taskType, formData.estimatedDuration, isEditing, user?.id]);

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
    
    console.log('🟢 handleSubmit נקרא');
    console.log('📋 formData:', formData);

    // אימות
    const validation = validateTaskForm(formData);
    console.log('🔍 תוצאת אימות:', validation);
    console.log('📝 formData שנשלח לאימות:', {
      title: formData.title,
      quadrant: formData.quadrant,
      dueDate: formData.dueDate,
      dueTime: formData.dueTime
    });
    
    if (!validation.valid) {
      console.error('❌ האימות נכשל:', validation.errors);
      console.error('📋 שגיאות מפורטות:', JSON.stringify(validation.errors, null, 2));
      setErrors(validation.errors);
      toast.error(`יש שגיאות בטופס: ${Object.keys(validation.errors).join(', ')}`);
      return;
    }

    setLoading(true);
    setErrors({}); // ניקוי שגיאות קודמות
    
    try {
      if (isEditing) {
        // בדיקה אם זו subtask (לא ניתן לערוך subtasks ישירות)
        if (task.is_subtask || task.id?.startsWith('subtask-')) {
          toast.error('לא ניתן לערוך שלבים ישירות. יש לערוך דרך הפרויקט הראשי.');
          setLoading(false);
          return;
        }
        
        console.log('✏️ עורך משימה קיימת:', task.id);
        const result = await editTask(task.id, formData);
        console.log('✅ תוצאת עריכה:', result);
        toast.success('המשימה עודכנה');
      } else {
        console.log('➕ מוסיף משימה חדשה:', formData);
        console.log('👤 User:', user?.id);
        const result = await addTask(formData);
        console.log('✅ תוצאת הוספה:', result);
        toast.success('✅ המשימה נוספה בהצלחה!');
      }
      
      console.log('✨ הכל עבר בהצלחה, סוגר טופס');
      
      // סגירת הטופס תמיד צריכה לקרות - גם אם יש שגיאה
      setLoading(false); // וידוא שהספינר נעלם לפני סגירה
      
      // המתנה קצרה כדי שהמשתמש יראה את ההודעה
      setTimeout(() => {
        if (typeof onClose === 'function') {
          console.log('🔒 קורא ל-onClose');
          onClose();
        } else {
          console.error('⚠️ onClose is not a function!', typeof onClose);
        }
      }, 100);
    } catch (err) {
      console.error('💥 שגיאה בשליחת טופס:', err);
      console.error('📋 פרטי שגיאה:', {
        message: err.message,
        stack: err.stack,
        formData: formData,
        user: user?.id
      });
      
      const errorMessage = err.message || 'שגיאה בשמירת המשימה';
      toast.error(errorMessage, {
        duration: 5000
      });
      
      setLoading(false); // וידוא שהספינר נעלם גם בשגיאה
      
      // לא סוגרים את הטופס בשגיאה - נותנים למשתמש לתקן
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

      {/* בחירת סוג משימה */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          סוג משימה {detectedCategory && detectedCategory.confidence > 50 && (
            <span className="text-xs text-blue-600 dark:text-blue-400 mr-2">
              (זוהה אוטומטית: {detectedCategory.category.name})
            </span>
          )}
        </label>
        <div className="grid grid-cols-2 gap-2">
          {Object.values(TASK_CATEGORIES).map(category => (
            <button
              key={category.id}
              type="button"
              onClick={() => {
                setFormData(prev => ({ ...prev, taskType: category.id }));
                // עדכון חיזוי לפי הסוג החדש
                if (user?.id) {
                  predictTaskDuration(user.id, category.id, {
                    quadrant: formData.quadrant,
                    title: formData.title
                  }).then(prediction => {
                    setAiPrediction(prediction);
                  });
                }
              }}
              className={`
                flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-right
                ${formData.taskType === category.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 shadow-md'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }
                ${detectedCategory?.category.id === category.id && formData.taskType !== category.id
                  ? 'border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10'
                  : ''
                }
              `}
            >
              <span className="text-xl">{category.icon}</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {category.name}
              </span>
            </button>
          ))}
        </div>
        {detectedCategory && detectedCategory.confidence > 30 && (
          <p className="mt-2 text-xs text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
            💡 זוהה אוטומטית: {detectedCategory.category.name} 
            ({Math.round(detectedCategory.confidence)}% ביטחון)
            {detectedCategory.detectedKeywords.length > 0 && (
              <span> - מילות מפתח: {detectedCategory.detectedKeywords.join(', ')}</span>
            )}
          </p>
        )}
      </div>

      {/* בחירת רבע - אופציונלי */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center justify-between">
            <span>רבע במטריצה (אופציונלי)</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 group-open:hidden">לחיצה להצגה</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 hidden group-open:inline">לחיצה להסתרה</span>
          </summary>
          <div className="mt-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoQuadrant"
                  checked={autoQuadrant}
                  onChange={(e) => {
                    setAutoQuadrant(e.target.checked);
                    if (e.target.checked) {
                      // עדכון אוטומטי
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
                <label htmlFor="autoQuadrant" className="text-xs text-gray-600 dark:text-gray-400">
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
                    setAutoQuadrant(false); // ביטול אוטומטי כשמשנים ידנית
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
            {errors.quadrant && (
              <p className="mt-1 text-sm text-red-500">{errors.quadrant}</p>
            )}
          </div>
        </details>
      </div>

      {/* תאריכים וזמנים - חשוב לתכנון */}
      <div className="space-y-3">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          📅 תאריכים וזמנים
        </div>
        <Input
          label="תאריך התחלה (מתי מתחילים)"
          type="date"
          name="startDate"
          value={formData.startDate}
          onChange={handleChange}
          error={errors.startDate}
          min={getTodayISO()}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="תאריך יעד (מתי לסיים)"
            type="date"
            name="dueDate"
            value={formData.dueDate}
            onChange={handleChange}
            error={errors.dueDate}
            min={formData.startDate || getTodayISO()}
          />
          <Input
            label="שעה משוערת"
            type="time"
            name="dueTime"
            value={formData.dueTime}
            onChange={handleChange}
            error={errors.dueTime}
          />
        </div>
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

      {/* זמן ביצוע משוער עם הצעה חכמה */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            ⏱️ זמן ביצוע משוער (דקות)
          </label>
          {aiPrediction && aiPrediction.predictedTime && (
            <button
              type="button"
              onClick={() => {
                setFormData(prev => ({ ...prev, estimatedDuration: aiPrediction.predictedTime.toString() }));
                toast.success(`הוגדר ${aiPrediction.predictedTime} דקות`);
              }}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              🤖 השתמש בחיזוי: {aiPrediction.predictedTime} דקות
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
        {aiPrediction && (
          <div className={`mt-2 text-xs p-3 rounded-lg border ${
            aiPrediction.confidence === 'high' 
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800'
              : aiPrediction.confidence === 'medium'
              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
              : 'bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'
          }`}>
            <div className="font-bold mb-1">
              🤖 חיזוי חכם: {aiPrediction.predictedTime} דקות
            </div>
            <div className="text-xs mb-1">{aiPrediction.reason}</div>
            {aiPrediction.stats && (
              <div className="text-xs mt-2 pt-2 border-t border-current/20">
                <div className="grid grid-cols-2 gap-1">
                  <div>• משימות קודמות: {aiPrediction.stats.totalTasks}</div>
                  <div>• דיוק ממוצע: {aiPrediction.stats.accuracy}%</div>
                  <div>• זמן ממוצע: {aiPrediction.stats.averageTime} דק'</div>
                  <div>• טווח: {aiPrediction.stats.minTime}-{aiPrediction.stats.maxTime} דק'</div>
                </div>
              </div>
            )}
            <div className="text-xs mt-2 font-medium">
              רמת ביטחון: {
                aiPrediction.confidence === 'high' ? '🟢 גבוהה' :
                aiPrediction.confidence === 'medium' ? '🟡 בינונית' :
                '🟠 נמוכה (עדיין לא מספיק נתונים)'
              }
            </div>
          </div>
        )}
        
        {/* הצעה לתיקון זמן לפי כללי למידה */}
        {correctionSuggestion && correctionSuggestion.hasCorrection && (
          <div className="mt-2 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="text-sm font-bold text-purple-800 dark:text-purple-200 mb-1">
                  🎯 המערכת למדה אותך!
                </div>
                <div className="text-xs text-purple-700 dark:text-purple-300 mb-2">
                  {correctionSuggestion.explanation}
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <div className="text-gray-600 dark:text-gray-400">
                    הערכה שלך: <span className="font-medium line-through">{correctionSuggestion.original} דקות</span>
                  </div>
                  <div className="text-purple-700 dark:text-purple-300 font-bold">
                    → המערכת ממליצה: <span className="text-lg">{correctionSuggestion.corrected} דקות</span>
                  </div>
                </div>
                {correctionSuggestion.rule.notes && (
                  <div className="text-xs text-purple-600 dark:text-purple-400 mt-1 italic">
                    📝 {correctionSuggestion.rule.notes}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={async () => {
                  setFormData(prev => ({ ...prev, estimatedDuration: correctionSuggestion.corrected.toString() }));
                  if (user?.id) {
                    await markRuleAsApplied(user.id, formData.taskType, true);
                  }
                  toast.success(`עודכן ל-${correctionSuggestion.corrected} דקות`);
                }}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
              >
                קבל המלצה
              </button>
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


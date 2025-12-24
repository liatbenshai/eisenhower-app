import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../hooks/useAuth';
import { TASK_TYPES } from '../DailyView/DailyView';
import { getTaskTypeLearning, getAllTaskTypeLearning } from '../../services/supabase';
import {
  analyzeCapacity,
  splitAndScheduleWork,
  findMovableTasks,
  proposeTaskMoves,
  formatMinutes,
  getDateISO,
  getDayName,
  getAdjustedDuration,
  PRIORITY_ORDER,
  MIN_BLOCK_SIZE,
  MAX_BLOCK_SIZE
} from '../../utils/smartScheduling';
import toast from 'react-hot-toast';
import Input from '../UI/Input';
import Button from '../UI/Button';

/**
 * מערכת קליטת עבודה חכמה - משופרת
 * 
 * יכולות:
 * - פירוק עבודה לבלוקים ושיבוץ אוטומטי
 * - למידה מהיסטוריה להתאמת זמנים
 * - הזזת משימות פחות חשובות במידת הצורך
 * - תמיכה בתאריך התחלה ודדליין
 */
function SmartWorkIntake({ onClose, onCreated }) {
  const { tasks, addTask, editTask, loadTasks } = useTasks();
  const { user } = useAuth();
  
  // שלב בתהליך
  const [step, setStep] = useState(1); // 1: פרטים, 2: ניתוח ושיבוץ
  
  // פרטי העבודה
  const [formData, setFormData] = useState({
    title: '',
    taskType: 'transcription',
    totalHours: '',
    startDate: getDateISO(new Date()), // ברירת מחדל: היום
    deadline: '',
    blockSize: 45,
    priority: 'normal',
    description: ''
  });

  // נתוני למידה
  const [learningData, setLearningData] = useState(null);
  const [allLearningData, setAllLearningData] = useState({});

  // תוצאות הניתוח
  const [analysis, setAnalysis] = useState(null);
  const [proposedBlocks, setProposedBlocks] = useState([]);
  const [tasksToMove, setTasksToMove] = useState([]);
  const [selectedToMove, setSelectedToMove] = useState([]);
  const [proposedMoves, setProposedMoves] = useState([]);
  
  const [loading, setLoading] = useState(false);

  // טעינת נתוני למידה
  useEffect(() => {
    if (user?.id) {
      // טעינת כל נתוני הלמידה
      getAllTaskTypeLearning(user.id)
        .then(data => {
          const byType = {};
          data.forEach(d => { byType[d.task_type] = d; });
          setAllLearningData(byType);
        })
        .catch(console.error);
    }
  }, [user?.id]);

  // טעינת נתוני למידה לסוג הנבחר
  useEffect(() => {
    if (user?.id && formData.taskType) {
      const data = allLearningData[formData.taskType];
      setLearningData(data || null);
    }
  }, [user?.id, formData.taskType, allLearningData]);

  // עדכון שדה
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // ניתוח קיבולת
  const capacityDays = useMemo(() => {
    const startDate = formData.startDate ? new Date(formData.startDate) : new Date();
    const endDate = formData.deadline ? new Date(formData.deadline) : null;
    return analyzeCapacity(tasks, startDate, endDate, 30);
  }, [tasks, formData.startDate, formData.deadline]);

  // סוג המשימה הנבחר
  const selectedType = TASK_TYPES[formData.taskType] || TASK_TYPES.other;

  // חישוב זמן מותאם
  const adjustedHours = useMemo(() => {
    if (!formData.totalHours || !learningData) return null;
    const baseMinutes = parseFloat(formData.totalHours) * 60;
    const adjusted = getAdjustedDuration(baseMinutes, learningData);
    if (adjusted === baseMinutes) return null;
    return adjusted / 60;
  }, [formData.totalHours, learningData]);

  // ניתוח והצעת שיבוץ
  const analyzeAndPropose = () => {
    if (!formData.title.trim()) {
      toast.error('נא להזין שם עבודה');
      return;
    }
    
    if (!formData.totalHours || parseFloat(formData.totalHours) <= 0) {
      toast.error('נא להזין מספר שעות');
      return;
    }

    const totalMinutes = parseFloat(formData.totalHours) * 60;
    
    // שימוש בלוגיקה החדשה
    const { blocks, analysis: scheduleAnalysis } = splitAndScheduleWork(
      {
        title: formData.title,
        totalMinutes,
        taskType: formData.taskType,
        priority: formData.priority,
        startDate: formData.startDate,
        deadline: formData.deadline,
        preferredBlockSize: parseInt(formData.blockSize),
        description: formData.description
      },
      capacityDays,
      learningData
    );

    setAnalysis(scheduleAnalysis);
    setProposedBlocks(blocks);

    // אם לא הצלחנו לשבץ הכל - מצא משימות להזזה
    if (!scheduleAnalysis.hasEnoughTime) {
      const allDayTasks = capacityDays.flatMap(d => d.tasks);
      const { tasks: movable } = findMovableTasks(
        allDayTasks,
        scheduleAnalysis.remainingMinutes,
        formData.priority
      );
      
      // הוסף מידע על היום
      const movableWithDays = movable.map(task => {
        const day = capacityDays.find(d => d.dateISO === task.due_date);
        return {
          ...task,
          dayName: day?.dayName || ''
        };
      });
      
      setTasksToMove(movableWithDays);
    } else {
      setTasksToMove([]);
    }

    setStep(2);
  };

  // בחירת משימה להזזה
  const toggleTaskToMove = (taskId) => {
    setSelectedToMove(prev => 
      prev.includes(taskId) 
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  // חישוב מחדש עם הזזת משימות
  const recalculateWithMoves = () => {
    if (selectedToMove.length === 0) return;

    // סנן משימות שייעזו
    const tasksToMoveObjs = tasksToMove.filter(t => selectedToMove.includes(t.id));
    
    // חשב קיבולת חדשה בלי המשימות שיוזזו
    const filteredTasks = tasks.filter(t => !selectedToMove.includes(t.id));
    const startDate = formData.startDate ? new Date(formData.startDate) : new Date();
    const endDate = formData.deadline ? new Date(formData.deadline) : null;
    const newCapacity = analyzeCapacity(filteredTasks, startDate, endDate, 30);

    // שבץ מחדש
    const totalMinutes = parseFloat(formData.totalHours) * 60;
    const { blocks, analysis: newAnalysis } = splitAndScheduleWork(
      {
        title: formData.title,
        totalMinutes,
        taskType: formData.taskType,
        priority: formData.priority,
        startDate: formData.startDate,
        deadline: formData.deadline,
        preferredBlockSize: parseInt(formData.blockSize),
        description: formData.description
      },
      newCapacity,
      learningData
    );

    // הצע לאן להזיז את המשימות
    const deadlineDate = formData.deadline ? new Date(formData.deadline) : new Date();
    const moves = proposeTaskMoves(tasksToMoveObjs, newCapacity, deadlineDate);

    setAnalysis(newAnalysis);
    setProposedBlocks(blocks);
    setProposedMoves(moves);

    toast.success(`חושב מחדש - ${moves.length} משימות יוזזו`);
  };

  // ביצוע השיבוץ
  const executeSchedule = async () => {
    if (proposedBlocks.length === 0) {
      toast.error('אין שיבוץ לביצוע');
      return;
    }
    
    setLoading(true);
    
    try {
      // הזזת משימות קודם
      for (const move of proposedMoves) {
        await editTask(move.task.id, {
          dueDate: move.newDate,
          dueTime: move.newTime
        });
      }

      // יצירת הבלוקים כמשימות
      for (const block of proposedBlocks) {
        await addTask({
          title: block.title,
          description: formData.description || null,
          taskType: block.taskType,
          estimatedDuration: block.duration,
          dueDate: block.dateISO,
          dueTime: block.startTime,
          priority: block.priority,
          parentJob: block.parentJob,
          blockIndex: block.blockIndex,
          totalBlocks: block.totalBlocks
        });
      }
      
      await loadTasks();
      
      const message = proposedMoves.length > 0
        ? `נוצרו ${proposedBlocks.length} בלוקים, ${proposedMoves.length} משימות הוזזו`
        : `נוצרו ${proposedBlocks.length} בלוקים של "${formData.title}"`;
      
      toast.success(message);
      
      if (onCreated) onCreated();
      if (onClose) onClose();
    } catch (err) {
      console.error('שגיאה:', err);
      toast.error('שגיאה ביצירת המשימות');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* שלב 1: הזנת פרטים */}
      {step === 1 && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-4"
        >
          {/* שם העבודה */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              שם העבודה *
            </label>
            <Input
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="לדוגמה: תמלול ישיבת דירקטוריון"
              autoFocus
            />
          </div>

          {/* סוג משימה */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              סוג עבודה
            </label>
            <div className="grid grid-cols-3 gap-2">
              {Object.values(TASK_TYPES).map(type => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, taskType: type.id }))}
                  className={`
                    p-2 rounded-lg border-2 text-center transition-all
                    ${formData.taskType === type.id
                      ? `${type.color} border-current ring-2 ring-offset-1`
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <span className="text-xl block mb-1">{type.icon}</span>
                  <span className="text-xs">{type.name}</span>
                </button>
              ))}
            </div>
            {learningData && learningData.total_tasks >= 2 && (
              <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-xs text-yellow-700 dark:text-yellow-300">
                📈 יש נתוני למידה: ממוצע {Math.round(learningData.average_ratio * 100)}% מההערכה ({learningData.total_tasks} משימות)
              </div>
            )}
          </div>

          {/* שעות עבודה */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              סה"כ שעות עבודה *
            </label>
            <Input
              name="totalHours"
              type="number"
              step="0.5"
              min="0.5"
              value={formData.totalHours}
              onChange={handleChange}
              placeholder="לדוגמה: 3"
            />
            {adjustedHours && (
              <div className="mt-1 text-xs text-yellow-600 dark:text-yellow-400">
                📈 לפי ההיסטוריה שלך, כנראה ייקח {adjustedHours.toFixed(1)} שעות
              </div>
            )}
          </div>

          {/* תאריכים */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                תאריך התחלה
              </label>
              <Input
                name="startDate"
                type="date"
                value={formData.startDate}
                onChange={handleChange}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                דדליין (אופציונלי)
              </label>
              <Input
                name="deadline"
                type="date"
                value={formData.deadline}
                onChange={handleChange}
                min={formData.startDate}
              />
            </div>
          </div>

          {/* גודל בלוק */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              גודל בלוק (דקות)
            </label>
            <div className="flex gap-2">
              {[30, 45, 60, 90].map(size => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, blockSize: size }))}
                  className={`
                    flex-1 py-2 rounded-lg font-medium transition-all
                    ${formData.blockSize === size
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }
                  `}
                >
                  {size} דק'
                </button>
              ))}
            </div>
          </div>

          {/* עדיפות */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              עדיפות
            </label>
            <div className="flex gap-2">
              {[
                { id: 'low', name: 'נמוכה', color: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400', icon: '⚪' },
                { id: 'normal', name: 'רגילה', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300', icon: '🔵' },
                { id: 'high', name: 'גבוהה', color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300', icon: '🟠' },
                { id: 'urgent', name: 'דחופה!', color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300', icon: '🔴' }
              ].map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, priority: p.id }))}
                  className={`
                    flex-1 py-2 rounded-lg border-2 font-medium transition-all text-sm
                    ${formData.priority === p.id
                      ? `${p.color} border-current ring-2 ring-offset-1`
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  {p.icon} {p.name}
                </button>
              ))}
            </div>
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
                         bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder="פרטים נוספים..."
            />
          </div>

          {/* תצוגה מקדימה של קיבולת */}
          {capacityDays.length > 0 && (
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                📊 קיבולת זמינה:
              </h4>
              <div className="flex gap-1 overflow-x-auto pb-2">
                {capacityDays.slice(0, 10).map(day => {
                  const pct = Math.round((day.occupiedMinutes / day.totalMinutes) * 100);
                  const isFull = pct >= 80;
                  return (
                    <div 
                      key={day.dateISO}
                      className={`
                        flex-shrink-0 w-14 p-2 rounded text-center text-xs
                        ${day.isToday ? 'ring-2 ring-blue-500' : ''}
                        ${isFull ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'}
                      `}
                    >
                      <div className="font-medium">{day.dayName}</div>
                      <div className={`text-lg ${isFull ? 'text-red-600' : 'text-green-600'}`}>
                        {Math.round(day.freeMinutes / 60)}h
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <Button onClick={analyzeAndPropose} className="w-full py-3">
            📊 נתח ושבץ אוטומטית
          </Button>
        </motion.div>
      )}

      {/* שלב 2: ניתוח ושיבוץ */}
      {step === 2 && analysis && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-4"
        >
          {/* סיכום */}
          <div className={`p-4 rounded-lg ${analysis.hasEnoughTime 
            ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800' 
            : 'bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-200 dark:border-orange-800'
          }`}>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">{analysis.hasEnoughTime ? '✅' : '⚠️'}</span>
              <div>
                <h3 className="font-bold text-lg">
                  {analysis.hasEnoughTime ? 'אפשר לעמוד בזמן!' : 'צריך לפנות זמן'}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {formData.title} • {proposedBlocks.length} בלוקים
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-2 text-center mt-3">
              <div className="p-2 bg-white dark:bg-gray-800 rounded">
                <div className="text-xl font-bold text-blue-600">
                  {formatMinutes(analysis.adjustedMinutes)}
                </div>
                <div className="text-xs text-gray-500">
                  נדרש
                  {analysis.wasAdjusted && <span className="text-yellow-600"> (מותאם)</span>}
                </div>
              </div>
              <div className="p-2 bg-white dark:bg-gray-800 rounded">
                <div className="text-xl font-bold text-green-600">{formatMinutes(analysis.totalFreeTime)}</div>
                <div className="text-xs text-gray-500">פנוי</div>
              </div>
              <div className="p-2 bg-white dark:bg-gray-800 rounded">
                <div className={`text-xl font-bold ${analysis.remainingMinutes > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {analysis.remainingMinutes > 0 ? `-${formatMinutes(analysis.remainingMinutes)}` : '✓'}
                </div>
                <div className="text-xs text-gray-500">{analysis.remainingMinutes > 0 ? 'חסר' : 'מספיק'}</div>
              </div>
            </div>
          </div>

          {/* שיבוץ מוצע */}
          {proposedBlocks.length > 0 && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="p-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <h4 className="font-medium flex items-center gap-2">
                  <span className={`${selectedType.color} px-2 py-0.5 rounded`}>
                    {selectedType.icon}
                  </span>
                  שיבוץ מוצע - {proposedBlocks.length} בלוקים
                </h4>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {proposedBlocks.map((block, index) => (
                  <div 
                    key={index}
                    className="p-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-sm font-bold text-blue-600">
                        {block.blockIndex}
                      </span>
                      <div>
                        <div className="font-medium">{block.dayName}</div>
                        <div className="text-sm text-gray-500">
                          {new Date(block.date).toLocaleDateString('he-IL')}
                        </div>
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="font-medium">{block.startTime} - {block.endTime}</div>
                      <div className="text-sm text-gray-500">{formatMinutes(block.duration)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* משימות שאפשר להזיז */}
          {!analysis.hasEnoughTime && tasksToMove.length > 0 && (
            <div className="border border-orange-200 dark:border-orange-800 rounded-lg overflow-hidden">
              <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border-b border-orange-200 dark:border-orange-800">
                <h4 className="font-medium text-orange-800 dark:text-orange-200">
                  🔀 משימות שאפשר להזיז (בחרי כדי לפנות זמן):
                </h4>
              </div>
              <div className="max-h-40 overflow-y-auto">
                {tasksToMove.map(task => {
                  const taskType = TASK_TYPES[task.task_type] || TASK_TYPES.other;
                  const isSelected = selectedToMove.includes(task.id);
                  return (
                    <label 
                      key={task.id}
                      className={`
                        p-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3 cursor-pointer
                        ${isSelected ? 'bg-orange-50 dark:bg-orange-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}
                      `}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleTaskToMove(task.id)}
                        className="w-5 h-5 rounded"
                      />
                      <span className={`px-2 py-0.5 rounded ${taskType.color}`}>
                        {taskType.icon}
                      </span>
                      <div className="flex-1">
                        <div className="font-medium">{task.title}</div>
                        <div className="text-sm text-gray-500">
                          {task.dayName} {task.due_time} • {formatMinutes(task.estimated_duration || 30)}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
              {selectedToMove.length > 0 && (
                <div className="p-3 bg-gray-50 dark:bg-gray-800">
                  <Button onClick={recalculateWithMoves} variant="secondary" className="w-full">
                    🔄 חשב מחדש עם הזזת {selectedToMove.length} משימות
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* הזזות מוצעות */}
          {proposedMoves.length > 0 && (
            <div className="border border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
                <h4 className="font-medium text-blue-800 dark:text-blue-200">
                  📅 משימות שיוזזו:
                </h4>
              </div>
              <div className="max-h-32 overflow-y-auto">
                {proposedMoves.map((move, index) => {
                  const taskType = TASK_TYPES[move.task.task_type] || TASK_TYPES.other;
                  return (
                    <div key={index} className="p-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2 text-sm">
                      <span className={`px-1.5 py-0.5 rounded ${taskType.color}`}>
                        {taskType.icon}
                      </span>
                      <span className="font-medium">{move.task.title}</span>
                      <span className="text-gray-400">→</span>
                      <span className="text-blue-600 dark:text-blue-400">
                        {move.newDayName} {move.newTime}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* כפתורים */}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => {
              setStep(1);
              setAnalysis(null);
              setProposedBlocks([]);
              setTasksToMove([]);
              setSelectedToMove([]);
              setProposedMoves([]);
            }} className="flex-1">
              ← חזרה
            </Button>
            <Button 
              onClick={executeSchedule} 
              loading={loading}
              disabled={proposedBlocks.length === 0}
              className="flex-1"
            >
              ✅ צור {proposedBlocks.length} בלוקים
              {proposedMoves.length > 0 && ` + הזז ${proposedMoves.length}`}
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default SmartWorkIntake;

import { useState, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../../hooks/useTasks';
import TaskTimerWithInterruptions from '../Tasks/TaskTimerWithInterruptions';
import toast from 'react-hot-toast';
import { TASK_TYPES, getTaskType } from '../../config/taskTypes';

const WORK_HOURS = { start: 8, end: 17 };

/**
 * פורמט דקות
 */
function formatMinutes(minutes) {
  if (!minutes) return '0 דק\'';
  if (minutes < 60) return `${minutes} דק'`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}:${mins.toString().padStart(2, '0')}` : `${hours} שעות`;
}

/**
 * המרת שעה לדקות
 */
function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + (m || 0);
}

/**
 * המרת דקות לשעה
 */
function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * האם זה היום?
 */
function isToday(date) {
  const today = new Date();
  const d = date instanceof Date ? date : new Date(date);
  return d.toDateString() === today.toDateString();
}

/**
 * תצוגת יומן יומי עם גרירה והערות
 */
function DiaryView({ date, tasks, onEditTask, onAddTask, onUpdate }) {
  const { toggleComplete, removeTask, editTask } = useTasks();
  const [expandedTask, setExpandedTask] = useState(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [editingNotes, setEditingNotes] = useState(null);
  const [notesText, setNotesText] = useState('');
  
  // מצב גרירה
  const [draggedTask, setDraggedTask] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const dragCounter = useRef(0);

  // סינון משימות ליום זה
  const dayTasks = useMemo(() => {
    const dateISO = date instanceof Date ? date.toISOString().split('T')[0] : date;
    return tasks.filter(t => t.due_date === dateISO);
  }, [tasks, date]);

  // משימות פעילות (ממוינות לפי שעה)
  const activeTasks = useMemo(() => {
    return dayTasks
      .filter(t => !t.is_completed)
      .sort((a, b) => {
        if (!a.due_time && !b.due_time) return 0;
        if (!a.due_time) return 1;
        if (!b.due_time) return -1;
        return timeToMinutes(a.due_time) - timeToMinutes(b.due_time);
      });
  }, [dayTasks]);

  // משימות שהושלמו
  const completedTasks = useMemo(() => {
    return dayTasks.filter(t => t.is_completed);
  }, [dayTasks]);

  // שעות היום
  const hourSlots = useMemo(() => {
    const slots = [];
    for (let hour = WORK_HOURS.start; hour <= WORK_HOURS.end; hour++) {
      slots.push(hour);
    }
    return slots;
  }, []);

  // מיפוי משימות לשעות - כולל המשכים
  const tasksByHour = useMemo(() => {
    const map = {};
    activeTasks.forEach(task => {
      if (task.due_time) {
        const [startHour, startMin] = task.due_time.split(':').map(Number);
        const startMinutes = startHour * 60 + (startMin || 0);
        const duration = task.estimated_duration || 30;
        const endMinutes = startMinutes + duration;
        
        const startSlotHour = startHour;
        const endSlotHour = Math.floor((endMinutes - 1) / 60);
        
        for (let hour = startSlotHour; hour <= endSlotHour && hour <= WORK_HOURS.end; hour++) {
          if (!map[hour]) map[hour] = [];
          if (hour === startSlotHour) {
            map[hour].push({ ...task, isMainSlot: true });
          } else {
            map[hour].push({ ...task, isMainSlot: false, continuesFrom: startSlotHour });
          }
        }
      }
    });
    return map;
  }, [activeTasks]);

  // משימות ללא שעה
  const unscheduledTasks = useMemo(() => {
    return activeTasks.filter(t => !t.due_time);
  }, [activeTasks]);

  // חישובים לסטטיסטיקות
  const stats = useMemo(() => {
    const totalPlanned = activeTasks.reduce((sum, t) => sum + (t.estimated_duration || 30), 0);
    const totalCompleted = completedTasks.reduce((sum, t) => sum + (t.time_spent || t.estimated_duration || 30), 0);
    return { totalPlanned, totalCompleted, active: activeTasks.length, done: completedTasks.length };
  }, [activeTasks, completedTasks]);

  // שעה נוכחית בדקות
  const now = useMemo(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }, []);

  const isTodayView = isToday(date);

  // פעולות
  const handleComplete = useCallback(async (task, e) => {
    if (e) e.stopPropagation();
    try {
      await toggleComplete(task.id);
      toast.success('✅ הושלם!');
      if (onUpdate) onUpdate();
    } catch {
      toast.error('שגיאה');
    }
  }, [toggleComplete, onUpdate]);

  const handleDelete = useCallback(async (task, e) => {
    if (e) e.stopPropagation();
    if (!confirm('למחוק את המשימה?')) return;
    try {
      await removeTask(task.id);
      toast.success('נמחק');
    } catch {
      toast.error('שגיאה');
    }
  }, [removeTask]);

  // שמירת הערות
  const handleSaveNotes = useCallback(async (taskId) => {
    try {
      await editTask(taskId, { notes: notesText });
      toast.success('הערות נשמרו');
      setEditingNotes(null);
      if (onUpdate) onUpdate();
    } catch {
      toast.error('שגיאה בשמירה');
    }
  }, [editTask, notesText, onUpdate]);

  // פתיחת עריכת הערות
  const openNotesEditor = useCallback((task, e) => {
    if (e) e.stopPropagation();
    setNotesText(task.notes || '');
    setEditingNotes(task.id);
  }, []);

  // === גרירה ושחרור ===
  const handleDragStart = useCallback((e, task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);
    setTimeout(() => {
      e.target.style.opacity = '0.5';
    }, 0);
  }, []);

  const handleDragEnd = useCallback((e) => {
    e.target.style.opacity = '1';
    setDraggedTask(null);
    setDropTarget(null);
    dragCounter.current = 0;
  }, []);

  const handleDragEnter = useCallback((e, hour) => {
    e.preventDefault();
    dragCounter.current++;
    setDropTarget(hour);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDropTarget(null);
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(async (e, targetHour) => {
    e.preventDefault();
    setDropTarget(null);
    dragCounter.current = 0;

    if (!draggedTask) return;

    const newTime = `${targetHour.toString().padStart(2, '0')}:00`;
    
    if (draggedTask.due_time?.startsWith(targetHour.toString().padStart(2, '0'))) {
      setDraggedTask(null);
      return;
    }

    try {
      await editTask(draggedTask.id, {
        ...draggedTask,
        dueTime: newTime,
        dueDate: draggedTask.due_date,
        title: draggedTask.title,
        estimatedDuration: draggedTask.estimated_duration,
        taskType: draggedTask.task_type
      });
      toast.success(`הועבר ל-${newTime}`);
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Drop error:', err);
      toast.error('שגיאה בהעברה');
    }
    
    setDraggedTask(null);
  }, [draggedTask, editTask, onUpdate]);

  const handleDropToUnscheduled = useCallback(async (e) => {
    e.preventDefault();
    setDropTarget(null);
    
    if (!draggedTask) return;

    try {
      await editTask(draggedTask.id, {
        ...draggedTask,
        dueTime: null,
        dueDate: draggedTask.due_date,
        title: draggedTask.title,
        estimatedDuration: draggedTask.estimated_duration,
        taskType: draggedTask.task_type
      });
      toast.success('הועבר ללא שעה');
      if (onUpdate) onUpdate();
    } catch {
      toast.error('שגיאה');
    }
    
    setDraggedTask(null);
  }, [draggedTask, editTask, onUpdate]);

  // רכיב משימה בודדת
  const TaskCard = ({ task }) => {
    const taskType = TASK_TYPES[task.task_type] || TASK_TYPES.other;
    const isExpanded = expandedTask === task.id;
    const duration = task.estimated_duration || 30;
    const spent = task.time_spent || 0;
    const progress = Math.min(100, Math.round((spent / duration) * 100));
    
    const taskStart = task.due_time ? timeToMinutes(task.due_time) : null;
    const taskEnd = taskStart ? taskStart + duration : null;
    const isNow = isTodayView && taskStart && now >= taskStart && now < taskEnd;
    const isPast = isTodayView && taskEnd && now >= taskEnd;
    
    const endTime = task.due_time ? minutesToTime(timeToMinutes(task.due_time) + duration) : null;
    const hasNotes = task.notes && task.notes.trim().length > 0;
    const isEditingThisNote = editingNotes === task.id;

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        draggable
        onDragStart={(e) => handleDragStart(e, task)}
        onDragEnd={handleDragEnd}
        className={`
          relative bg-white dark:bg-gray-800 rounded-xl overflow-hidden
          border-r-4 transition-all duration-200 cursor-grab active:cursor-grabbing
          ${isNow 
            ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-100 dark:shadow-blue-900/30' 
            : isPast 
              ? 'opacity-50' 
              : 'shadow-sm hover:shadow-md'
          }
          ${draggedTask?.id === task.id ? 'opacity-50 scale-95' : ''}
        `}
        style={{ borderRightColor: taskType.borderColor || '#6b7280' }}
        onClick={() => setExpandedTask(isExpanded ? null : task.id)}
      >
        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* אינדיקטור גרירה */}
            <div className="mt-2 text-gray-300 dark:text-gray-600 cursor-grab select-none">
              ⋮⋮
            </div>
            
            {/* כפתור סימון */}
            <button
              onClick={(e) => handleComplete(task, e)}
              className="mt-1 w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600 
                         hover:border-green-500 hover:bg-green-500 flex-shrink-0 transition-all
                         flex items-center justify-center group"
            >
              <span className="text-white text-xs opacity-0 group-hover:opacity-100">✓</span>
            </button>
            
            {/* אייקון */}
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white text-lg flex-shrink-0 ${taskType.bg}`}>
              {taskType.icon}
            </div>
            
            {/* תוכן */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className={`font-medium text-gray-900 dark:text-white truncate ${isPast ? 'line-through' : ''}`}>
                  {task.title}
                </h3>
                {isNow && (
                  <span className="px-2 py-0.5 bg-blue-500 text-white text-xs font-bold rounded-full animate-pulse flex-shrink-0">
                    עכשיו
                  </span>
                )}
                {hasNotes && !isExpanded && (
                  <span className="text-amber-500 text-sm" title="יש הערות">📝</span>
                )}
              </div>
              
              <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400" dir="ltr">
                {task.due_time && (
                  <span className="flex items-center gap-1 font-mono">
                    {task.due_time.substring(0, 5)} → {endTime}
                  </span>
                )}
                <span className="text-gray-400">•</span>
                {spent > 0 ? (
                  spent >= duration ? (
                    <span className="text-red-600 dark:text-red-400 font-medium">
                      חריגה: +{formatMinutes(spent - duration)}
                    </span>
                  ) : (
                    <span className="text-blue-600 dark:text-blue-400 font-medium">
                      נותרו {formatMinutes(duration - spent)}
                    </span>
                  )
                ) : (
                  <span>{formatMinutes(duration)}</span>
                )}
              </div>
              
              {progress > 0 && (
                <div className="mt-2 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${progress >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </div>
            
            {/* כפתורי פעולות */}
            <div className="flex gap-1 flex-shrink-0">
              <button
                onClick={(e) => openNotesEditor(task, e)}
                className={`p-1.5 rounded-lg transition-colors ${hasNotes ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                title="הערות"
              >
                📝
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onEditTask(task); }}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                title="ערוך"
              >
                ✏️
              </button>
              <button
                onClick={(e) => handleDelete(task, e)}
                className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                title="מחק"
              >
                🗑️
              </button>
            </div>
          </div>

          {/* תוכן מורחב - הערות וטיימר */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                {/* הערות */}
                <div className="pt-3 mt-3 border-t border-gray-100 dark:border-gray-700">
                  {isEditingThisNote ? (
                    <div className="space-y-2">
                      <textarea
                        value={notesText}
                        onChange={(e) => setNotesText(e.target.value)}
                        placeholder="הוסף הערות למשימה..."
                        className="w-full p-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg 
                                   bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                                   focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        rows={3}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingNotes(null); }}
                          className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        >
                          ביטול
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSaveNotes(task.id); }}
                          className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                          שמור
                        </button>
                      </div>
                    </div>
                  ) : hasNotes ? (
                    <div 
                      onClick={(e) => openNotesEditor(task, e)}
                      className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-sm text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30"
                    >
                      <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs font-medium mb-1">
                        <span>📝</span>
                        <span>הערות</span>
                      </div>
                      <p className="whitespace-pre-wrap">{task.notes}</p>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => openNotesEditor(task, e)}
                      className="w-full p-2 text-sm text-gray-400 dark:text-gray-500 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-colors"
                    >
                      + הוסף הערות
                    </button>
                  )}
                </div>
                
                {/* טיימר עם הפרעות */}
                <div className="pt-3 mt-3 border-t border-gray-100 dark:border-gray-700">
                  <TaskTimerWithInterruptions
                    task={task}
                    onUpdate={onUpdate}
                    onComplete={() => handleComplete(task)}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    );
  };

  // כרטיס המשך משימה
  const ContinuationCard = ({ task }) => {
    const taskType = TASK_TYPES[task.task_type] || TASK_TYPES.other;
    const endTime = minutesToTime(timeToMinutes(task.due_time) + (task.estimated_duration || 30));

    return (
      <div
        onClick={() => onEditTask(task)}
        className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg 
                   border-r-4 border-dashed opacity-70 cursor-pointer hover:opacity-100 transition-opacity"
        style={{ borderRightColor: taskType.borderColor || '#6b7280' }}
      >
        <span className="text-lg">{taskType.icon}</span>
        <span className="text-sm text-gray-600 dark:text-gray-300 truncate flex-1">
          {task.title}
        </span>
        <span className="text-xs text-gray-400" dir="ltr">
          עד {endTime}
        </span>
      </div>
    );
  };

  return (
    <div className="diary-view space-y-4">
      {/* סטטיסטיקות */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-l from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.active}</div>
            <div className="text-xs text-gray-500">משימות</div>
          </div>
          <div className="w-px h-8 bg-blue-200 dark:bg-blue-700" />
          <div className="text-center">
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{formatMinutes(stats.totalPlanned)}</div>
            <div className="text-xs text-gray-500">זמן מתוכנן</div>
          </div>
          {stats.done > 0 && (
            <>
              <div className="w-px h-8 bg-blue-200 dark:bg-blue-700" />
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.done}</div>
                <div className="text-xs text-gray-500">הושלמו ✓</div>
              </div>
            </>
          )}
        </div>
        
        <button
          onClick={() => onAddTask()}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <span>+</span>
          <span>משימה</span>
        </button>
      </div>

      {/* הוראות גרירה */}
      {activeTasks.length > 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
          💡 גררי משימות בין השעות לשינוי מהיר
        </p>
      )}

      {/* משימות ללא שעה */}
      {(unscheduledTasks.length > 0 || draggedTask) && (
        <div 
          className={`p-3 rounded-xl border-2 border-dashed transition-colors ${
            dropTarget === 'unscheduled' 
              ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20' 
              : 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10'
          }`}
          onDragEnter={(e) => handleDragEnter(e, 'unscheduled')}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDropToUnscheduled}
        >
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm font-medium mb-2">
            <span>📌</span>
            <span>ללא שעה קבועה ({unscheduledTasks.length})</span>
          </div>
          <div className="space-y-2">
            {unscheduledTasks.map(task => (
              <TaskCard key={task.id} task={task} />
            ))}
            {unscheduledTasks.length === 0 && draggedTask && (
              <div className="p-4 text-center text-amber-600 dark:text-amber-400 text-sm">
                שחרר כאן להסרת השעה
              </div>
            )}
          </div>
        </div>
      )}

      {/* רשת שעות */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {hourSlots.map(hour => {
          const hourTasks = tasksByHour[hour] || [];
          const mainTasks = hourTasks.filter(t => t.isMainSlot);
          const continuations = hourTasks.filter(t => !t.isMainSlot);
          const nowHour = new Date().getHours();
          const isCurrentHour = isTodayView && hour === nowHour;
          const isPastHour = isTodayView && hour < nowHour;
          const isDropHere = dropTarget === hour;

          return (
            <div 
              key={hour}
              className={`flex border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-colors ${
                isCurrentHour ? 'bg-blue-50 dark:bg-blue-900/20' : 
                isPastHour ? 'bg-gray-50 dark:bg-gray-900/30' : ''
              } ${isDropHere ? 'bg-blue-100 dark:bg-blue-900/40' : ''}`}
              onDragEnter={(e) => handleDragEnter(e, hour)}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, hour)}
            >
              {/* עמודת שעה */}
              <div className={`w-16 flex-shrink-0 p-3 border-l border-gray-100 dark:border-gray-700 ${
                isCurrentHour ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-gray-50 dark:bg-gray-900/30'
              }`}>
                <div className={`text-sm font-mono font-bold ${
                  isCurrentHour ? 'text-blue-600 dark:text-blue-400' : 
                  isPastHour ? 'text-gray-400' : 'text-gray-600 dark:text-gray-300'
                }`}>
                  {hour.toString().padStart(2, '0')}:00
                </div>
                {isCurrentHour && (
                  <div className="text-xs text-blue-500 mt-0.5">עכשיו</div>
                )}
              </div>

              {/* עמודת משימות */}
              <div className="flex-1 p-2 min-h-[70px]">
                {hourTasks.length > 0 ? (
                  <div className="space-y-2">
                    {mainTasks.map(task => (
                      <TaskCard key={`main-${task.id}`} task={task} />
                    ))}
                    {continuations.map(task => (
                      <ContinuationCard key={`cont-${task.id}`} task={task} />
                    ))}
                  </div>
                ) : (
                  <div 
                    className={`h-full min-h-[54px] border-2 border-dashed rounded-lg flex items-center justify-center transition-all ${
                      isDropHere 
                        ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-500' 
                        : 'border-gray-200 dark:border-gray-700 text-gray-400 hover:border-gray-300 hover:text-gray-500 cursor-pointer'
                    }`}
                    onClick={() => onAddTask(hour)}
                  >
                    <span className="text-sm">
                      {isDropHere ? 'שחרר כאן' : `+ הוסף משימה ל-${hour}:00`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* משימות שהושלמו */}
      {completedTasks.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            <span className={`transform transition-transform ${showCompleted ? 'rotate-90' : ''}`}>▶</span>
            <span>✅ הושלמו היום ({completedTasks.length})</span>
            <span className="text-xs text-gray-400">{formatMinutes(stats.totalCompleted)}</span>
          </button>

          <AnimatePresence>
            {showCompleted && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-3 space-y-2">
                  {completedTasks.map(task => {
                    const taskType = TASK_TYPES[task.task_type] || TASK_TYPES.other;
                    return (
                      <div 
                        key={task.id}
                        className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg opacity-60"
                      >
                        <span className="text-green-500 text-lg">✓</span>
                        <span className={`${taskType.bg} text-white w-7 h-7 rounded flex items-center justify-center text-sm`}>
                          {taskType.icon}
                        </span>
                        <span className="line-through text-gray-500 dark:text-gray-400 flex-1 truncate">
                          {task.title}
                        </span>
                        {task.notes && (
                          <span className="text-amber-500 text-sm" title={task.notes}>📝</span>
                        )}
                        <span className="text-xs text-gray-400">
                          {formatMinutes(task.time_spent || task.estimated_duration)}
                        </span>
                        <button
                          onClick={() => toggleComplete(task.id)}
                          className="text-xs text-blue-500 hover:text-blue-700 px-2 py-1 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                        >
                          החזר
                        </button>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

export default DiaryView;

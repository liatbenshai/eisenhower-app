import { useState } from 'react';
import { useTasks } from '../../hooks/useTasks';
import { supabase } from '../../services/supabase';
import { updateTaskTimeByName } from '../../utils/updateTaskTime';
import Button from '../UI/Button';
import toast from 'react-hot-toast';

/**
 * עדכון זמן ידני למשימה
 */
function ManualTimeUpdate({ onUpdated }) {
  const { tasks, loadTasks } = useTasks();
  const [taskTitle, setTaskTitle] = useState('');
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    if (!taskTitle.trim()) {
      toast.error('יש להזין שם משימה');
      return;
    }

    const totalMinutes = hours * 60 + minutes;
    if (totalMinutes === 0) {
      toast.error('יש להזין זמן שבוצע');
      return;
    }

    setLoading(true);
    try {
      await updateTaskTimeByName(taskTitle.trim(), totalMinutes, supabase);
      toast.success(`✅ זמן עודכן בהצלחה: ${hours > 0 ? `${hours} שעות ` : ''}${minutes > 0 ? `${minutes} דקות` : ''}`);
      setTaskTitle('');
      setHours(0);
      setMinutes(0);
      await loadTasks();
      if (onUpdated) onUpdated();
    } catch (err) {
      console.error('שגיאה בעדכון זמן:', err);
      toast.error(err.message || 'שגיאה בעדכון זמן');
    } finally {
      setLoading(false);
    }
  };

  // הצעה של משימות לפי השם שהוזן
  const suggestedTasks = taskTitle.trim()
    ? tasks.filter(t => 
        t.title.toLowerCase().includes(taskTitle.toLowerCase()) &&
        !t.is_project &&
        !t.parent_task_id
      ).slice(0, 5)
    : [];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
        עדכון זמן ידני
      </h3>
      
      <div className="space-y-4">
        {/* שם משימה */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            שם המשימה:
          </label>
          <input
            type="text"
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            placeholder="לדוגמה: בית חולים יוספטל"
            className="w-full input-field"
            list="task-suggestions"
          />
          {suggestedTasks.length > 0 && (
            <datalist id="task-suggestions">
              {suggestedTasks.map(task => (
                <option key={task.id} value={task.title} />
              ))}
            </datalist>
          )}
        </div>

        {/* זמן */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              שעות:
            </label>
            <input
              type="number"
              value={hours}
              onChange={(e) => setHours(parseInt(e.target.value) || 0)}
              min="0"
              max="24"
              className="w-full input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              דקות:
            </label>
            <input
              type="number"
              value={minutes}
              onChange={(e) => setMinutes(parseInt(e.target.value) || 0)}
              min="0"
              max="59"
              className="w-full input-field"
            />
          </div>
        </div>

        {/* סה"כ */}
        {hours > 0 || minutes > 0 && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              סה"כ: <span className="font-bold">{hours * 60 + minutes} דקות</span> ({hours > 0 ? `${hours} שעות ` : ''}{minutes > 0 ? `${minutes} דקות` : ''})
            </p>
          </div>
        )}

        {/* כפתור */}
        <Button
          onClick={handleUpdate}
          loading={loading}
          className="w-full"
        >
          עדכן זמן
        </Button>
      </div>
    </div>
  );
}

export default ManualTimeUpdate;


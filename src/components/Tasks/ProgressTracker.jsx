import { useState } from 'react';
import { useTasks } from '../../hooks/useTasks';
import { addTimeToSubtask } from '../../services/supabase';
import toast from 'react-hot-toast';
import Button from '../UI/Button';

/**
 * מעקב התקדמות בשלב
 */
function ProgressTracker({ subtask, onUpdate }) {
  const [timeToAdd, setTimeToAdd] = useState(15);
  const [loading, setLoading] = useState(false);
  
  const timeSpent = subtask.time_spent || 0;
  const estimated = subtask.estimated_duration || 0;
  const progress = estimated > 0 
    ? Math.min(100, Math.round((timeSpent / estimated) * 100))
    : 0;
  
  const handleAddTime = async () => {
    if (timeToAdd <= 0) {
      toast.error('יש להזין זמן חיובי');
      return;
    }
    
    setLoading(true);
    try {
      await addTimeToSubtask(subtask.id, timeToAdd);
      toast.success(`נוסף ${timeToAdd} דקות`);
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('שגיאה בעדכון התקדמות:', err);
      toast.error('שגיאה בעדכון התקדמות');
    } finally {
      setLoading(false);
    }
  };
  
  const quickTimeOptions = [15, 30, 60, 120];
  
  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {subtask.title}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {progress}%
        </span>
      </div>
      
      {/* פס התקדמות */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
          <span>{timeSpent} / {estimated} דקות</span>
          <span>{progress}% הושלם</span>
        </div>
        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      
      {/* הוספת זמן */}
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={timeToAdd}
          onChange={(e) => setTimeToAdd(parseInt(e.target.value) || 0)}
          min="1"
          className="flex-1 input-field text-sm"
          placeholder="דקות"
        />
        <Button
          onClick={handleAddTime}
          loading={loading}
          className="text-sm px-3"
        >
          הוסף
        </Button>
      </div>
      
      {/* כפתורים מהירים */}
      <div className="flex gap-1 mt-2">
        {quickTimeOptions.map(minutes => (
          <button
            key={minutes}
            onClick={() => {
              setTimeToAdd(minutes);
              handleAddTime();
            }}
            className="flex-1 text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
          >
            +{minutes}ד'
          </button>
        ))}
      </div>
    </div>
  );
}

export default ProgressTracker;


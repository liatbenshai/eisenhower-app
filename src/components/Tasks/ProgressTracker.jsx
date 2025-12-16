import { useState } from 'react';
import { useTasks } from '../../hooks/useTasks';
import { addTimeToSubtask, updateSubtaskProgress } from '../../services/supabase';
import toast from 'react-hot-toast';
import Button from '../UI/Button';

/**
 * מעקב התקדמות בשלב
 */
function ProgressTracker({ subtask, onUpdate }) {
  const [timeToAdd, setTimeToAdd] = useState(15);
  const [timeSpent, setTimeSpent] = useState(subtask.time_spent || 0);
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const estimated = subtask.estimated_duration || 0;
  const progress = estimated > 0 
    ? Math.min(100, Math.round((timeSpent / estimated) * 100))
    : 0;
  
  // הוספת זמן
  const handleAddTime = async () => {
    if (timeToAdd <= 0) {
      toast.error('יש להזין זמן חיובי');
      return;
    }
    
    const newTimeSpent = timeSpent + timeToAdd;
    setLoading(true);
    try {
      await updateSubtaskProgress(subtask.id, newTimeSpent);
      setTimeSpent(newTimeSpent);
      toast.success(`נוסף ${timeToAdd} דקות`);
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('שגיאה בעדכון התקדמות:', err);
      toast.error('שגיאה בעדכון התקדמות');
    } finally {
      setLoading(false);
    }
  };
  
  // עדכון זמן שבוצע ישירות
  const handleUpdateTimeSpent = async (newTime) => {
    if (newTime < 0) {
      toast.error('זמן לא יכול להיות שלילי');
      return;
    }
    
    if (newTime > estimated && estimated > 0) {
      toast.error(`זמן שבוצע לא יכול להיות יותר מ-${estimated} דקות`);
      return;
    }
    
    setLoading(true);
    try {
      await updateSubtaskProgress(subtask.id, newTime);
      setTimeSpent(newTime);
      toast.success('התקדמות עודכנה');
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('שגיאה בעדכון התקדמות:', err);
      toast.error('שגיאה בעדכון התקדמות');
    } finally {
      setLoading(false);
      setIsEditingTime(false);
    }
  };
  
  const quickTimeOptions = [15, 30, 60, 120];
  
  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {subtask.title}
        </span>
        <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
          {progress}%
        </span>
      </div>
      
      {/* פס התקדמות */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-2">
          <span>זמן שבוצע: {timeSpent} / {estimated} דקות</span>
          <span className="font-medium">{progress}% הושלם</span>
        </div>
        <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              progress >= 100 
                ? 'bg-green-500' 
                : progress >= 75 
                ? 'bg-blue-500' 
                : progress >= 50 
                ? 'bg-yellow-500' 
                : 'bg-orange-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      
      {/* עדכון זמן שבוצע ישירות */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-2">
          <label className="text-xs text-gray-600 dark:text-gray-400">
            עדכן זמן שבוצע:
          </label>
          {!isEditingTime ? (
            <button
              onClick={() => setIsEditingTime(true)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              {timeSpent} דקות
            </button>
          ) : (
            <div className="flex items-center gap-2 flex-1">
              <input
                type="number"
                value={timeSpent}
                onChange={(e) => setTimeSpent(parseInt(e.target.value) || 0)}
                min="0"
                max={estimated || undefined}
                className="flex-1 input-field text-sm"
                placeholder="דקות"
                autoFocus
              />
              <button
                onClick={() => handleUpdateTimeSpent(timeSpent)}
                disabled={loading}
                className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              >
                שמור
              </button>
              <button
                onClick={() => {
                  setIsEditingTime(false);
                  setTimeSpent(subtask.time_spent || 0);
                }}
                className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                ביטול
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* הוספת זמן */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
        <label className="text-xs text-gray-600 dark:text-gray-400 mb-2 block">
          הוסף זמן:
        </label>
        <div className="flex items-center gap-2 mb-2">
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
        <div className="flex gap-1">
          {quickTimeOptions.map(minutes => (
            <button
              key={minutes}
              onClick={() => {
                setTimeToAdd(minutes);
                handleAddTime();
              }}
              disabled={loading}
              className="flex-1 text-xs px-2 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50"
            >
              +{minutes}ד'
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ProgressTracker;


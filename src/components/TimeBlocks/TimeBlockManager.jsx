import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useTasks } from '../../hooks/useTasks';
import {
  getTimeBlocks,
  createTimeBlock,
  updateTimeBlock,
  deleteTimeBlock,
  completeTimeBlock
} from '../../services/supabase';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addDays, subDays } from 'date-fns';
import { he } from 'date-fns/locale';
import toast from 'react-hot-toast';
import Button from '../UI/Button';
import Input from '../UI/Input';
import Modal from '../UI/Modal';

/**
 * מנהל בלוקי זמן - תכנון זמן לעבודה על משימות
 */
function TimeBlockManager() {
  const { user } = useAuth();
  const { tasks } = useTasks();
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [editingBlock, setEditingBlock] = useState(null);
  const [formData, setFormData] = useState({
    task_id: '',
    title: '',
    description: '',
    start_time: '',
    end_time: ''
  });

  // חישוב ימי השבוע
  const weekDays = useMemo(() => {
    const weekStart = startOfWeek(currentWeek, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: weekStart, end: weekEnd });
  }, [currentWeek]);

  // טעינת בלוקים
  useEffect(() => {
    if (user?.id) {
      loadBlocks();
    }
  }, [user?.id, currentWeek]);

  const loadBlocks = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const weekStart = startOfWeek(currentWeek, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 0 });
      weekEnd.setHours(23, 59, 59);
      
      const data = await getTimeBlocks(
        user.id,
        weekStart,
        weekEnd
      );
      setBlocks(data || []);
    } catch (err) {
      console.error('שגיאה בטעינת בלוקים:', err);
      toast.error('שגיאה בטעינת בלוקים');
    } finally {
      setLoading(false);
    }
  };

  // קבלת בלוקים ליום מסוים
  const getBlocksForDay = (day) => {
    return blocks.filter(block => {
      const blockDate = new Date(block.start_time);
      return isSameDay(blockDate, day);
    }).sort((a, b) => 
      new Date(a.start_time) - new Date(b.start_time)
    );
  };

  // פתיחת טופס יצירה/עריכה
  const openForm = (day = null, block = null) => {
    if (block) {
      setEditingBlock(block);
      setFormData({
        task_id: block.task_id || '',
        title: block.title || '',
        description: block.description || '',
        start_time: format(new Date(block.start_time), "yyyy-MM-dd'T'HH:mm"),
        end_time: format(new Date(block.end_time), "yyyy-MM-dd'T'HH:mm")
      });
    } else {
      setEditingBlock(null);
      const defaultDate = day || new Date();
      const defaultStart = new Date(defaultDate);
      defaultStart.setHours(9, 0, 0);
      const defaultEnd = new Date(defaultDate);
      defaultEnd.setHours(10, 0, 0);
      
      setFormData({
        task_id: '',
        title: '',
        description: '',
        start_time: format(defaultStart, "yyyy-MM-dd'T'HH:mm"),
        end_time: format(defaultEnd, "yyyy-MM-dd'T'HH:mm")
      });
    }
    setShowForm(true);
  };

  // שמירת בלוק
  const handleSave = async (e) => {
    e.preventDefault();
    if (!user?.id) return;

    try {
      if (editingBlock) {
        await updateTimeBlock(editingBlock.id, {
          task_id: formData.task_id || null,
          title: formData.title,
          description: formData.description || null,
          start_time: new Date(formData.start_time).toISOString(),
          end_time: new Date(formData.end_time).toISOString()
        });
        toast.success('בלוק עודכן');
      } else {
        await createTimeBlock({
          user_id: user.id,
          task_id: formData.task_id || null,
          title: formData.title,
          description: formData.description || null,
          start_time: new Date(formData.start_time).toISOString(),
          end_time: new Date(formData.end_time).toISOString()
        });
        toast.success('בלוק נוצר');
      }
      setShowForm(false);
      loadBlocks();
    } catch (err) {
      console.error('שגיאה בשמירת בלוק:', err);
      toast.error('שגיאה בשמירת בלוק');
    }
  };

  // מחיקת בלוק
  const handleDelete = async (blockId) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק את הבלוק?')) return;

    try {
      await deleteTimeBlock(blockId);
      toast.success('בלוק נמחק');
      loadBlocks();
    } catch (err) {
      console.error('שגיאה במחיקת בלוק:', err);
      toast.error('שגיאה במחיקת בלוק');
    }
  };

  // סימון כהושלם
  const handleComplete = async (block) => {
    try {
      await completeTimeBlock(block.id);
      toast.success('בלוק סומן כהושלם');
      loadBlocks();
    } catch (err) {
      console.error('שגיאה בסימון בלוק:', err);
      toast.error('שגיאה בסימון בלוק');
    }
  };

  // פורמט זמן
  const formatTime = (date) => {
    return format(new Date(date), 'HH:mm', { locale: he });
  };

  // חישוב משך זמן
  const getDuration = (start, end) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const minutes = Math.round((endDate - startDate) / (1000 * 60));
    if (minutes < 60) return `${minutes} דקות`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours} שעות ${mins} דקות` : `${hours} שעות`;
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent mx-auto"></div>
        <p className="mt-2 text-gray-500 dark:text-gray-400">טוען בלוקים...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* כותרת וניווט */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            תכנון זמן
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {format(weekDays[0], 'dd MMMM', { locale: he })} - {format(weekDays[6], 'dd MMMM yyyy', { locale: he })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setCurrentWeek(subDays(currentWeek, 7))}
            variant="secondary"
            size="sm"
          >
            ← שבוע קודם
          </Button>
          <Button
            onClick={() => setCurrentWeek(new Date())}
            variant="secondary"
            size="sm"
          >
            היום
          </Button>
          <Button
            onClick={() => setCurrentWeek(addDays(currentWeek, 7))}
            variant="secondary"
            size="sm"
          >
            שבוע הבא →
          </Button>
        </div>
      </div>

      {/* ימי השבוע */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {weekDays.map((day, index) => {
          const dayBlocks = getBlocksForDay(day);
          const isToday = isSameDay(day, new Date());

          return (
            <div
              key={index}
              className={`
                bg-white dark:bg-gray-800 rounded-lg border-2 p-3 min-h-[400px]
                ${isToday 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                  : 'border-gray-200 dark:border-gray-700'
                }
              `}
            >
              {/* כותרת יום */}
              <div className="mb-3">
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  {format(day, 'EEEE', { locale: he })}
                </div>
                <div className={`text-lg font-bold ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                  {format(day, 'd', { locale: he })}
                </div>
              </div>

              {/* בלוקים */}
              <div className="space-y-2 mb-3">
                {dayBlocks.map(block => (
                  <div
                    key={block.id}
                    className={`
                      p-2 rounded border text-xs
                      ${block.is_completed
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                        : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
                      }
                    `}
                  >
                    <div className="font-medium text-gray-900 dark:text-white mb-1">
                      {block.title}
                    </div>
                    <div className="text-gray-600 dark:text-gray-400 mb-1">
                      {formatTime(block.start_time)} - {formatTime(block.end_time)}
                    </div>
                    <div className="text-gray-500 dark:text-gray-500 text-xs">
                      {getDuration(block.start_time, block.end_time)}
                    </div>
                    {block.tasks && (
                      <div className="mt-1 text-blue-600 dark:text-blue-400 text-xs">
                        📋 {block.tasks.title}
                      </div>
                    )}
                    <div className="flex gap-1 mt-2">
                      {!block.is_completed && (
                        <button
                          onClick={() => handleComplete(block)}
                          className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900/50"
                        >
                          ✓
                        </button>
                      )}
                      <button
                        onClick={() => openForm(null, block)}
                        className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50"
                      >
                        ערוך
                      </button>
                      <button
                        onClick={() => handleDelete(block.id)}
                        className="text-xs px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-900/50"
                      >
                        מחק
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* כפתור הוספה */}
              <Button
                onClick={() => openForm(day)}
                size="sm"
                variant="secondary"
                className="w-full"
              >
                + בלוק חדש
              </Button>
            </div>
          );
        })}
      </div>

      {/* מודל טופס */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editingBlock ? 'עריכת בלוק זמן' : 'בלוק זמן חדש'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              משימה (אופציונלי)
            </label>
            <select
              value={formData.task_id}
              onChange={(e) => setFormData(prev => ({ ...prev, task_id: e.target.value }))}
              className="input-field"
            >
              <option value="">ללא משימה</option>
              {tasks.filter(t => !t.is_completed).map(task => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="כותרת"
            name="title"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            required
            autoFocus
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              תיאור (אופציונלי)
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="input-field resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="זמן התחלה"
              type="datetime-local"
              name="start_time"
              value={formData.start_time}
              onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
              required
            />
            <Input
              label="זמן סיום"
              type="datetime-local"
              name="end_time"
              value={formData.end_time}
              onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
              required
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" fullWidth>
              {editingBlock ? 'שמור שינויים' : 'צור בלוק'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
              ביטול
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default TimeBlockManager;


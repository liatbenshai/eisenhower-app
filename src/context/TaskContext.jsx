import { createContext, useState, useEffect, useCallback } from 'react';
import { 
  getTasks, 
  createTask, 
  updateTask, 
  deleteTask, 
  moveTask, 
  toggleTaskComplete 
} from '../services/supabase';
import { useAuth } from '../hooks/useAuth';

// יצירת קונטקסט
export const TaskContext = createContext(null);

/**
 * ספק משימות
 */
export function TaskProvider({ children }) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // סינון ומיון
  const [filter, setFilter] = useState('all'); // all, active, completed
  const [sortBy, setSortBy] = useState('created_at'); // created_at, due_date, title

  // טעינת משימות
  const loadTasks = useCallback(async () => {
    if (!user?.id) {
      setTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await getTasks(user.id);
      setTasks(data || []);
      setError(null);
    } catch (err) {
      console.error('שגיאה בטעינת משימות:', err);
      setError('שגיאה בטעינת משימות');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // טעינה ראשונית
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // הוספת משימה
  const addTask = async (taskData) => {
    try {
      const newTask = await createTask({
        user_id: user.id,
        title: taskData.title,
        description: taskData.description || null,
        quadrant: taskData.quadrant,
        due_date: taskData.dueDate || null,
        due_time: taskData.dueTime || null,
        reminder_minutes: taskData.reminderMinutes || null,
        is_completed: false
      });
      
      setTasks(prev => [newTask, ...prev]);
      return newTask;
    } catch (err) {
      console.error('שגיאה בהוספת משימה:', err);
      throw new Error('שגיאה בהוספת משימה');
    }
  };

  // עדכון משימה
  const editTask = async (taskId, updates) => {
    try {
      const updatedTask = await updateTask(taskId, {
        title: updates.title,
        description: updates.description || null,
        quadrant: updates.quadrant,
        due_date: updates.dueDate || null,
        due_time: updates.dueTime || null,
        reminder_minutes: updates.reminderMinutes || null
      });
      
      setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
      return updatedTask;
    } catch (err) {
      console.error('שגיאה בעדכון משימה:', err);
      throw new Error('שגיאה בעדכון משימה');
    }
  };

  // מחיקת משימה
  const removeTask = async (taskId) => {
    try {
      await deleteTask(taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (err) {
      console.error('שגיאה במחיקת משימה:', err);
      throw new Error('שגיאה במחיקת משימה');
    }
  };

  // העברת משימה לרבע אחר
  const changeQuadrant = async (taskId, newQuadrant) => {
    try {
      const updatedTask = await moveTask(taskId, newQuadrant);
      setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
      return updatedTask;
    } catch (err) {
      console.error('שגיאה בהעברת משימה:', err);
      throw new Error('שגיאה בהעברת משימה');
    }
  };

  // סימון כהושלם/לא הושלם
  const toggleComplete = async (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    try {
      const updatedTask = await toggleTaskComplete(taskId, !task.is_completed);
      setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
      return updatedTask;
    } catch (err) {
      console.error('שגיאה בעדכון סטטוס:', err);
      throw new Error('שגיאה בעדכון סטטוס');
    }
  };

  // קבלת משימות לפי רבע
  const getTasksByQuadrant = (quadrant) => {
    return getFilteredTasks().filter(t => t.quadrant === quadrant);
  };

  // קבלת משימות מסוננות וממוינות
  const getFilteredTasks = () => {
    let filtered = [...tasks];

    // סינון
    switch (filter) {
      case 'active':
        filtered = filtered.filter(t => !t.is_completed);
        break;
      case 'completed':
        filtered = filtered.filter(t => t.is_completed);
        break;
      default:
        break;
    }

    // מיון
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title, 'he');
        case 'due_date':
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date) - new Date(b.due_date);
        case 'created_at':
        default:
          return new Date(b.created_at) - new Date(a.created_at);
      }
    });

    return filtered;
  };

  // סטטיסטיקות
  const getStats = () => {
    return {
      total: tasks.length,
      completed: tasks.filter(t => t.is_completed).length,
      active: tasks.filter(t => !t.is_completed).length,
      byQuadrant: {
        1: tasks.filter(t => t.quadrant === 1).length,
        2: tasks.filter(t => t.quadrant === 2).length,
        3: tasks.filter(t => t.quadrant === 3).length,
        4: tasks.filter(t => t.quadrant === 4).length
      }
    };
  };

  const value = {
    tasks,
    loading,
    error,
    filter,
    sortBy,
    setFilter,
    setSortBy,
    loadTasks,
    addTask,
    editTask,
    removeTask,
    changeQuadrant,
    toggleComplete,
    getTasksByQuadrant,
    getFilteredTasks,
    getStats
  };

  return (
    <TaskContext.Provider value={value}>
      {children}
    </TaskContext.Provider>
  );
}

export default TaskContext;


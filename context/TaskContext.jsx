import { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { 
  getTasks, 
  createTask, 
  createProjectTask,
  updateTask, 
  deleteTask, 
  moveTask, 
  toggleTaskComplete,
  supabase
} from '../services/supabase';
import { useAuth } from '../hooks/useAuth';

// יצירת קונטקסט
export const TaskContext = createContext(null);

/**
 * ספק משימות
 */
export function TaskProvider({ children }) {
  console.log('📋 TaskProvider rendering...');
  const { user, loading: authLoading } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // סינון ומיון
  const [filter, setFilter] = useState('all'); // all, active, completed
  const [sortBy, setSortBy] = useState('created_at'); // created_at, due_date, title
  
  // מניעת race conditions - שמירת עדכונים בתהליך
  // במקום Set פשוט, נשתמש ב-Map עם Promise לכל משימה
  const updatingTasksRef = useRef(new Map()); // Map<taskId, Promise>

  // מניעת טעינות כפולות
  const loadingRef = useRef(false);
  
  // טעינת משימות - פשוט וישיר
  const loadTasks = useCallback(async () => {
    if (authLoading || !user?.id || loadingRef.current) {
      return;
    }
    
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    
    try {
      const data = await getTasks(user.id);
      console.log('📥 טעינת משימות מה-DB:', { count: data?.length, sample: data?.[0] });
      const safeData = (data || []).map(task => {
        const taskWithTime = {
          ...task,
          time_spent: task.time_spent || 0,
          estimated_duration: task.estimated_duration || null
        };
        if (task.time_spent > 0) {
          console.log('⏱️ משימה עם זמן:', { id: task.id, title: task.title, time_spent: task.time_spent });
        }
        return taskWithTime;
      });
      console.log('✅ משימות נטענו:', { count: safeData.length, tasksWithTime: safeData.filter(t => (t.time_spent || 0) > 0).length });
      setTasks(safeData);
    } catch (err) {
      console.error('שגיאה בטעינת משימות:', err);
      setError(err.message || 'שגיאה בטעינת משימות');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [user?.id, authLoading]);

  // טעינה ראשונית - רק אחרי שהאותנטיקציה נטענה
  useEffect(() => {
    if (!authLoading && user?.id) {
      loadTasks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading]); // לא loadTasks כדי למנוע לולאה

  // הוספת משימה
  // חשוב: אין הגבלה על הוספת משימות - ניתן להוסיף משימות חדשות תמיד,
  // גם אם יש משימות פעילות, לא הושלמו, או טיימרים פועלים
  const addTask = async (taskData) => {
    console.log('🟢 TaskContext.addTask נקרא עם:', taskData);
    console.log('🔑 User ID:', user?.id);
    console.log('🔑 Auth Loading:', authLoading);
    
    // בדיקה מפורטת יותר של משתמש
    if (authLoading) {
      const error = new Error('⏳ ממתין לאימות משתמש...');
      console.error(error);
      throw error;
    }
    
    if (!user?.id) {
      // ננסה לטעון את המשתמש מחדש לפני שנזרוק שגיאה
      console.warn('⚠️ אין משתמש, מנסה לטעון מחדש...');
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        console.log('✅ נמצא סשן, ממשיך...');
        // נמשיך עם session.user.id במקום user.id
        taskData.user_id = session.user.id;
      } else {
        const error = new Error('❌ אין משתמש מחובר! אנא התחברי מחדש.');
        console.error(error);
        throw error;
      }
    }
    
    try {
      const taskToCreate = {
        user_id: user?.id || taskData.user_id,
        title: taskData.title?.trim(),
        description: taskData.description?.trim() || null,
        quadrant: taskData.quadrant || 1,
        start_date: taskData.startDate || null,
        due_date: taskData.dueDate || null,
        due_time: taskData.dueTime || null,
        reminder_minutes: taskData.reminderMinutes ? parseInt(taskData.reminderMinutes) : null,
        estimated_duration: taskData.estimatedDuration ? parseInt(taskData.estimatedDuration) : null,
        task_type: taskData.taskType || 'other', // תמיד יש ערך
        task_parameter: taskData.taskParameter ? parseInt(taskData.taskParameter) : null,
        is_project: false,
        parent_task_id: null,
        is_completed: false
      };
      
      // בדיקה אחרונה לפני שליחה
      if (!taskToCreate.user_id) {
        throw new Error('❌ חסר user_id! לא ניתן לשמור משימה.');
      }
      
      if (!taskToCreate.title || taskToCreate.title.length === 0) {
        throw new Error('❌ חסרה כותרת משימה!');
      }
      
      console.log('📤 שולח ל-createTask:', taskToCreate);
      
      const newTask = await createTask(taskToCreate);
      
      if (!newTask || !newTask.id) {
        throw new Error('❌ המשימה לא נוצרה - אין תגובה מהשרת');
      }
      
      console.log('✅ משימה נוצרה:', newTask);
      
      // טעינה מחדש כדי לוודא שהכל מעודכן
      console.log('🔄 טוען משימות מחדש...');
      await loadTasks();
      
      console.log('✨ הכל הצליח!');
      return newTask;
      
    } catch (err) {
      console.error('❌ שגיאה בהוספת משימה:', err);
      console.error('📋 פרטי שגיאה מלאים:', {
        message: err.message,
        code: err.code,
        details: err.details,
        hint: err.hint,
        taskData
      });
      
      // הודעת שגיאה ידידותית יותר
      let errorMessage = err.message || 'שגיאה בהוספת משימה';
      if (err.code === '42501') {
        errorMessage = '❌ אין הרשאות לשמירה. אנא התחברי מחדש.';
      } else if (err.code === 'PGRST301' || err.message?.includes('JWT')) {
        errorMessage = '❌ סשן פג. אנא התחברי מחדש.';
      } else if (err.message?.includes('user_id')) {
        errorMessage = '❌ בעיית התחברות. אנא רענני את הדף והתחברי מחדש.';
      }
      
      throw new Error(errorMessage);
    }
  };

  // הוספת פרויקט עם שלבים
  const addProjectTask = async (projectData) => {
    try {
      const newProject = await createProjectTask({
        user_id: user.id,
        title: projectData.title,
        description: projectData.description || null,
        quadrant: projectData.quadrant,
        dueDate: projectData.dueDate || null,
        dueTime: projectData.dueTime || null,
        reminderMinutes: projectData.reminderMinutes || null,
        totalDuration: projectData.totalDuration || null,
        subtasks: projectData.subtasks || []
      });
      
      // טעינה מחדש של כל המשימות כדי לכלול את השלבים שנוצרו
      await loadTasks();
      return newProject;
    } catch (err) {
      console.error('שגיאה ביצירת פרויקט:', err);
      throw new Error('שגיאה ביצירת פרויקט');
    }
  };

  // עדכון משימה
  const editTask = async (taskId, updates) => {
    try {
      const updatedTask = await updateTask(taskId, {
        title: updates.title,
        description: updates.description || null,
        estimated_duration: updates.estimatedDuration ? parseInt(updates.estimatedDuration) : null,
        quadrant: updates.quadrant,
        start_date: updates.startDate || null,
        due_date: updates.dueDate || null,
        due_time: updates.dueTime || null,
        reminder_minutes: updates.reminderMinutes ? parseInt(updates.reminderMinutes) : null,
        task_type: updates.taskType || null,
        task_parameter: updates.taskParameter ? parseInt(updates.taskParameter) : null
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

  // עדכון זמן שבוצע למשימה (מ-TaskTimer) - שומר גם ב-DB וגם ב-state
  const updateTaskTime = useCallback(async (taskId, timeSpent) => {
    const timeSpentInt = parseInt(timeSpent) || 0;
    
    console.log('🔄 updateTaskTime נקרא:', { taskId, timeSpent, timeSpentInt });
    
    try {
      // עדכון ב-DB דרך updateTaskTimeSpent
      const { updateTaskTimeSpent } = await import('../services/supabase');
      console.log('📤 שומר זמן ב-DB...');
      const updatedTask = await updateTaskTimeSpent(taskId, timeSpentInt);
      console.log('✅ זמן נשמר ב-DB:', updatedTask);
      
      // עדכון ב-state
      setTasks(prev => {
        const updated = prev.map(t => 
          t.id === taskId 
            ? { ...t, time_spent: timeSpentInt }
            : t
        );
        console.log('✅ State עודכן:', { taskId, timeSpent: timeSpentInt, updatedTask: updated.find(t => t.id === taskId) });
        return updated;
      });
      
      console.log('✅ זמן עודכן בהצלחה ב-DB וב-state:', { taskId, timeSpent: timeSpentInt });
      return updatedTask || { id: taskId, time_spent: timeSpentInt };
    } catch (err) {
      console.error('❌ שגיאה בעדכון זמן:', err);
      console.error('❌ פרטי שגיאה:', {
        message: err.message,
        stack: err.stack,
        taskId,
        timeSpentInt
      });
      // עדכון מקומי גם אם השמירה ב-DB נכשלה
      setTasks(prev => prev.map(t => 
        t.id === taskId 
          ? { ...t, time_spent: timeSpentInt }
          : t
      ));
      throw err;
    }
  }, []);

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

  // קבלת משימות לפי רבע (ללא משימות שהושלמו)
  const getTasksByQuadrant = (quadrant) => {
    return tasks
      .filter(t => t.quadrant === quadrant && !t.is_completed)
      .sort((a, b) => {
        // מיון לפי תאריך יצירה (חדשות יותר למעלה)
        return new Date(b.created_at) - new Date(a.created_at);
      });
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

  // קבלת משימות שהושלמו
  const getCompletedTasks = () => {
    return tasks
      .filter(t => t.is_completed)
      .sort((a, b) => {
        // מיון לפי תאריך השלמה (החדשות ביותר ראשונות)
        if (!a.completed_at) return 1;
        if (!b.completed_at) return -1;
        return new Date(b.completed_at) - new Date(a.completed_at);
      });
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
    addProjectTask,
    editTask,
    removeTask,
    changeQuadrant,
    updateTaskTime,
    toggleComplete,
    getTasksByQuadrant,
    getCompletedTasks,
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


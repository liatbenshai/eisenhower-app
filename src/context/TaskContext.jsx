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

  // טעינת משימות
  const loadTasks = useCallback(async () => {
    // אם האותנטיקציה עדיין נטענת, נחכה
    if (authLoading) {
      console.log('⏳ ממתין לאימות משתמש...');
      return;
    }

    // אם אין משתמש אחרי שהאותנטיקציה נטענה, ננקה את המשימות
    if (!user?.id) {
      console.log('ℹ️ אין משתמש מחובר - מנקה משימות');
      setTasks([]);
      setLoading(false);
      setError(null);
      return;
    }
    
    console.log('📥 טוען משימות עבור משתמש:', user.id);

    setLoading(true);
    setError(null);
    try {
      const data = await getTasks(user.id);
      // וידוא שכל המשימות יש להן את השדות הנדרשים
      const safeData = (data || []).map(task => ({
        ...task,
        time_spent: task.time_spent || 0,
        estimated_duration: task.estimated_duration || null
      }));
      setTasks(safeData);
    } catch (err) {
      console.error('שגיאה בטעינת משימות:', err);
      setError(err.message || 'שגיאה בטעינת משימות');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, authLoading]);

  // טעינה ראשונית - רק אחרי שהאותנטיקציה נטענה
  useEffect(() => {
    if (!authLoading) {
      loadTasks();
    }
  }, [loadTasks, authLoading]);

  // הוספת משימה
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
        due_date: taskData.dueDate || null,
        due_time: taskData.dueTime || null,
        reminder_minutes: taskData.reminderMinutes ? parseInt(taskData.reminderMinutes) : null,
        estimated_duration: taskData.estimatedDuration ? parseInt(taskData.estimatedDuration) : null,
        task_type: taskData.taskType || 'other', // תמיד יש ערך
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
        due_date: updates.dueDate || null,
        due_time: updates.dueTime || null,
        reminder_minutes: updates.reminderMinutes ? parseInt(updates.reminderMinutes) : null,
        task_type: updates.taskType || null
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

  // עדכון זמן שבוצע למשימה (מ-TaskTimer) - עם מניעת race conditions
  const updateTaskTime = useCallback(async (taskId, timeSpent) => {
    // אם יש עדכון בתהליך, נמתין לו במקום להתחיל חדש
    const existingUpdate = updatingTasksRef.current.get(taskId);
    if (existingUpdate) {
      console.log('⏳ עדכון כבר בתהליך למשימה:', taskId, '- ממתין לעדכון קודם...');
      try {
        // נמתין לעדכון הקודם להסתיים
        await existingUpdate;
        console.log('✅ עדכון קודם הסתיים, ממשיך...');
      } catch (err) {
        console.warn('⚠️ עדכון קודם נכשל, ממשיך עם עדכון חדש:', err);
        // אם העדכון הקודם נכשל, נמשיך עם עדכון חדש
      }
    }
    
    // יצירת Promise חדש לעדכון
    const updatePromise = (async () => {
      const timeSpentInt = parseInt(timeSpent) || 0;
      console.log('⏱️ TaskContext.updateTaskTime:', taskId, timeSpentInt);
      
      try {
        // עדכון ב-DB
        const updatedTask = await updateTask(taskId, { time_spent: timeSpentInt });
        
        if (!updatedTask) {
          throw new Error('המשימה לא עודכנה - אין data מהשרת');
        }
        
        console.log('✅ משימה עודכנה ב-DB:', updatedTask);
        console.log('📊 time_spent מהשרת:', updatedTask.time_spent);
        
        // עדכון ב-state עם הנתונים מהשרת
        setTasks(prev => {
          const taskExists = prev.find(t => t.id === taskId);
          if (!taskExists) {
            console.warn('⚠️ משימה לא נמצאה ב-state, טוען מחדש...');
            loadTasks();
            return prev;
          }
          
          const updated = prev.map(t => {
            if (t.id === taskId) {
              // עדכון עם כל הנתונים מהשרת - וידוא ש-time_spent הוא מספר
              const newTask = {
                ...t,
                ...updatedTask,
                time_spent: parseInt(updatedTask.time_spent) || timeSpentInt
              };
              console.log('🔄 מעדכן משימה ב-state:', {
                id: newTask.id,
                time_spent_old: t.time_spent,
                time_spent_new: newTask.time_spent
              });
              return newTask;
            }
            return t;
          });
          
          // וידוא שהעדכון קרה
          const updatedTaskInState = updated.find(t => t.id === taskId);
          if (updatedTaskInState && updatedTaskInState.time_spent !== timeSpentInt) {
            console.warn('⚠️ time_spent לא עודכן נכון ב-state!', {
              expected: timeSpentInt,
              actual: updatedTaskInState.time_spent
            });
          }
          
          return updated;
        });
        
        console.log('✅ TaskContext: משימה עודכנה ב-state ו-DB:', updatedTask);
        return updatedTask;
      } catch (err) {
        console.error('❌ שגיאה בעדכון זמן משימה:', err);
        // במקרה של שגיאה, ננסה לטעון מחדש את המשימות
        try {
          await loadTasks();
        } catch (loadErr) {
          console.error('❌ שגיאה בטעינת משימות אחרי שגיאה:', loadErr);
        }
        throw err;
      }
    })();
    
    // שמירת ה-Promise ב-Map
    updatingTasksRef.current.set(taskId, updatePromise);
    
    // timeout אוטומטי למניעת תקיעות - אם העדכון לא הסתיים תוך 30 שניות, נסיר אותו
    const stuckTimeout = setTimeout(() => {
      if (updatingTasksRef.current.get(taskId) === updatePromise) {
        console.warn('⚠️ עדכון לוקח יותר מ-30 שניות, מסיר מהרשימה');
        updatingTasksRef.current.delete(taskId);
      }
    }, 30000); // הגדלתי ל-30 שניות
    
    try {
      // הוספת timeout ל-Promise עצמו - עם retry
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('⏱️ עדכון לוקח יותר מדי זמן - בדוק את החיבור לאינטרנט'));
        }, 30000); // 30 שניות timeout
      });
      
      const result = await Promise.race([updatePromise, timeoutPromise]);
      return result;
    } catch (err) {
      console.error('❌ שגיאה ב-updateTaskTime:', err);
      // ניקוי מהרשימה גם בשגיאה
      if (updatingTasksRef.current.get(taskId) === updatePromise) {
        updatingTasksRef.current.delete(taskId);
      }
      throw err;
    } finally {
      // ניקוי רק אם זה עדיין ה-Promise הנוכחי
      if (updatingTasksRef.current.get(taskId) === updatePromise) {
        updatingTasksRef.current.delete(taskId);
      }
      clearTimeout(stuckTimeout);
    }
  }, [loadTasks]);

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


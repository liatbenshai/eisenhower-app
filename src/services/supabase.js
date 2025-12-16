import { createClient } from '@supabase/supabase-js';

// הגדרות Supabase - יש להחליף בערכים האמיתיים
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

// יצירת לקוח Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// === פונקציות אותנטיקציה ===

/**
 * הרשמת משתמש חדש
 */
export async function signUp(email, password, fullName) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName
      }
    }
  });
  
  if (error) throw error;
  return data;
}

/**
 * התחברות
 */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  if (error) throw error;
  
  // עדכון זמן התחברות אחרון
  if (data.user) {
    await supabase.from('users').update({
      last_login: new Date().toISOString()
    }).eq('id', data.user.id);
  }
  
  return data;
}

/**
 * התנתקות
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * שליחת קישור לאיפוס סיסמה
 */
export async function resetPassword(email) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`
  });
  
  if (error) throw error;
  return data;
}

/**
 * עדכון סיסמה
 */
export async function updatePassword(newPassword) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword
  });
  
  if (error) throw error;
  return data;
}

/**
 * קבלת פרטי משתמש נוכחי
 */
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  
  if (!user) return null;
  
  // קבלת פרטים נוספים מטבלת users
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();
  
  return { ...user, profile };
}

// === פונקציות משימות ===

/**
 * קבלת כל המשימות של המשתמש (כולל שלבים שמופיעים כמשימות נפרדות)
 */
export async function getTasks(userId) {
  const { data, error } = await supabase
    .from('tasks')
    .select(`
      *,
      subtasks (
        id,
        title,
        description,
        order_index,
        due_date,
        due_time,
        estimated_duration,
        time_spent,
        is_completed,
        completed_at
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data;
}

/**
 * יצירת משימה חדשה
 */
export async function createTask(task) {
  console.log('createTask נקרא עם:', task);
  const { data, error } = await supabase
    .from('tasks')
    .insert([{
      ...task,
      is_project: task.is_project || false,
      parent_task_id: task.parent_task_id || null,
      time_spent: task.time_spent || 0,
      estimated_duration: task.estimated_duration || null
    }])
    .select()
    .single();
  
  if (error) {
    console.error('שגיאה ב-createTask:', error);
    throw error;
  }
  console.log('משימה נוצרה בהצלחה:', data);
  return data;
}

/**
 * עדכון משימה
 */
export async function updateTask(taskId, updates) {
  const { data, error } = await supabase
    .from('tasks')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * עדכון זמן שבוצע למשימה
 */
export async function updateTaskTimeSpent(taskId, timeSpent) {
  return updateTask(taskId, { time_spent: timeSpent });
}

/**
 * מחיקת משימה
 */
export async function deleteTask(taskId) {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId);
  
  if (error) throw error;
}

/**
 * העברת משימה לרבע אחר
 */
export async function moveTask(taskId, newQuadrant) {
  return updateTask(taskId, { quadrant: newQuadrant });
}

/**
 * סימון משימה כהושלמה/לא הושלמה
 */
export async function toggleTaskComplete(taskId, isCompleted) {
  return updateTask(taskId, {
    is_completed: isCompleted,
    completed_at: isCompleted ? new Date().toISOString() : null
  });
}

// === פונקציות ניהול (Admin) ===

/**
 * קבלת כל המשתמשים (רק למנהלים)
 */
export async function getAllUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data;
}

/**
 * השהיית/הפעלת משתמש
 */
export async function toggleUserActive(userId, isActive) {
  const { data, error } = await supabase
    .from('users')
    .update({ is_active: isActive })
    .eq('id', userId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * מחיקת משתמש
 */
export async function deleteUser(userId) {
  // מחיקת משימות המשתמש
  await supabase.from('tasks').delete().eq('user_id', userId);
  
  // מחיקת המשתמש
  const { error } = await supabase.from('users').delete().eq('id', userId);
  if (error) throw error;
}

/**
 * קבלת סטטיסטיקות
 */
export async function getStats() {
  const { data: users } = await supabase.from('users').select('id, created_at');
  const { data: tasks } = await supabase.from('tasks').select('id, is_completed, quadrant');
  
  return {
    totalUsers: users?.length || 0,
    totalTasks: tasks?.length || 0,
    completedTasks: tasks?.filter(t => t.is_completed).length || 0,
    tasksByQuadrant: {
      1: tasks?.filter(t => t.quadrant === 1).length || 0,
      2: tasks?.filter(t => t.quadrant === 2).length || 0,
      3: tasks?.filter(t => t.quadrant === 3).length || 0,
      4: tasks?.filter(t => t.quadrant === 4).length || 0
    }
  };
}

// === פונקציות פרויקטים ושלבים ===

/**
 * יצירת פרויקט עם שלבים
 * כל שלב יהפוך למשימה נפרדת במטריצה
 */
export async function createProjectTask(projectData) {
  const { subtasks, ...taskData } = projectData;
  
  // יצירת המשימה הראשית (הפרויקט)
  const { data: projectTask, error: taskError } = await supabase
    .from('tasks')
    .insert([{
      user_id: taskData.user_id,
      title: taskData.title,
      description: taskData.description || null,
      quadrant: taskData.quadrant,
      due_date: taskData.dueDate || null,
      due_time: taskData.dueTime || null,
      reminder_minutes: taskData.reminderMinutes || null,
      is_project: true,
      parent_task_id: null,
      estimated_duration: taskData.totalDuration || null,
      time_spent: 0,
      is_completed: false
    }])
    .select()
    .single();
  
  if (taskError) throw taskError;
  
  // יצירת משימות נפרדות לכל שלב
  const createdTasks = [];
  if (subtasks && subtasks.length > 0) {
    // פונקציה לקביעת רביע לפי תאריך וחשיבות
    const getQuadrantByDate = (dueDate, projectQuadrant) => {
      if (!dueDate) return projectQuadrant;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const due = new Date(dueDate);
      due.setHours(0, 0, 0, 0);
      
      const daysDiff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
      
      // קביעת דחיפות
      const isUrgent = daysDiff <= 2; // דחוף אם בעוד 2 ימים או פחות
      const isImportant = projectQuadrant === 1 || projectQuadrant === 2; // חשוב אם הפרויקט ברביע 1 או 2
      
      // קביעת הרביע לפי דחיפות וחשיבות
      if (isUrgent && isImportant) {
        return 1; // דחוף וחשוב
      } else if (!isUrgent && isImportant) {
        return 2; // חשוב אך לא דחוף
      } else if (isUrgent && !isImportant) {
        return 3; // דחוף אך לא חשוב
      } else {
        return 4; // לא דחוף ולא חשוב
      }
    };
    
    // יצירת משימות לכל שלב
    for (let i = 0; i < subtasks.length; i++) {
      const st = subtasks[i];
      
      // בדיקה שיש תאריך
      if (!st.dueDate) {
        console.warn(`שלב ${i + 1} אין לו תאריך, מדלגים`);
        continue;
      }
      
      const quadrant = getQuadrantByDate(st.dueDate, taskData.quadrant);
      
      console.log(`יוצר משימה לשלב ${i + 1}:`, {
        title: `${taskData.title} - ${st.title}`,
        dueDate: st.dueDate,
        quadrant: quadrant
      });
      
      // יצירת משימה לשלב
      const { data: stageTask, error: stageError } = await supabase
        .from('tasks')
        .insert([{
          user_id: taskData.user_id,
          title: `${taskData.title} - ${st.title}`,
          description: st.description || null,
          quadrant: quadrant,
          due_date: st.dueDate || null,
          due_time: st.dueTime || null,
          reminder_minutes: taskData.reminderMinutes || null,
          is_project: false,
          parent_task_id: projectTask.id,
          estimated_duration: st.estimatedDuration || null,
          time_spent: 0,
          is_completed: false
        }])
        .select()
        .single();
      
      if (stageError) {
        console.error('שגיאה ביצירת משימה לשלב:', stageError);
        // אם יש שגיאה, נמחק את הפרויקט הראשי
        await supabase.from('tasks').delete().eq('id', projectTask.id);
        throw stageError;
      }
      
      createdTasks.push(stageTask);
      
      // יצירת רשומה ב-subtasks לקישור
      const { error: subtaskError } = await supabase
        .from('subtasks')
        .insert([{
          task_id: projectTask.id,
          title: st.title,
          description: st.description || null,
          order_index: i,
          due_date: st.dueDate || null,
          due_time: st.dueTime || null,
          estimated_duration: st.estimatedDuration || null,
          time_spent: 0,
          is_completed: false
        }]);
      
      if (subtaskError) {
        console.error('שגיאה ביצירת subtask:', subtaskError);
      }
    }
    
    console.log(`נוצרו ${createdTasks.length} משימות לשלבים`);
  }
  
  // קבלת הפרויקט עם השלבים
  const { data: fullTask, error: fetchError } = await supabase
    .from('tasks')
    .select(`
      *,
      subtasks (
        id,
        title,
        description,
        order_index,
        due_date,
        due_time,
        estimated_duration,
        is_completed,
        completed_at
      )
    `)
    .eq('id', projectTask.id)
    .single();
  
  if (fetchError) throw fetchError;
  return fullTask;
}

/**
 * קבלת שלבים של משימה
 */
export async function getSubtasks(taskId) {
  const { data, error } = await supabase
    .from('subtasks')
    .select('*')
    .eq('task_id', taskId)
    .order('order_index', { ascending: true });
  
  if (error) throw error;
  return data;
}

/**
 * עדכון התקדמות שלב (זמן שבוצע)
 */
export async function updateSubtaskProgress(subtaskId, timeSpent) {
  const { data, error } = await supabase
    .from('subtasks')
    .update({ 
      time_spent: timeSpent,
      updated_at: new Date().toISOString()
    })
    .eq('id', subtaskId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * הוספת זמן לשלב (increment)
 */
export async function addTimeToSubtask(subtaskId, minutesToAdd) {
  // קבלת השלב הנוכחי
  const { data: subtask, error: fetchError } = await supabase
    .from('subtasks')
    .select('time_spent')
    .eq('id', subtaskId)
    .single();
  
  if (fetchError) throw fetchError;
  
  const newTimeSpent = (subtask.time_spent || 0) + minutesToAdd;
  
  return updateSubtaskProgress(subtaskId, newTimeSpent);
}

/**
 * יצירת שלב חדש
 */
export async function createSubtask(taskId, subtaskData) {
  const { data, error } = await supabase
    .from('subtasks')
    .insert([{
      task_id: taskId,
      title: subtaskData.title,
      description: subtaskData.description || null,
      order_index: subtaskData.orderIndex || 0,
      due_date: subtaskData.dueDate || null,
      due_time: subtaskData.dueTime || null,
      estimated_duration: subtaskData.estimatedDuration || null,
      is_completed: false
    }])
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * עדכון שלב
 */
export async function updateSubtask(subtaskId, updates) {
  const { data, error } = await supabase
    .from('subtasks')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', subtaskId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * מחיקת שלב
 */
export async function deleteSubtask(subtaskId) {
  const { error } = await supabase
    .from('subtasks')
    .delete()
    .eq('id', subtaskId);
  
  if (error) throw error;
}

/**
 * סימון שלב כהושלם/לא הושלם
 */
export async function toggleSubtaskComplete(subtaskId, isCompleted) {
  return updateSubtask(subtaskId, {
    is_completed: isCompleted,
    completed_at: isCompleted ? new Date().toISOString() : null
  });
}

/**
 * קבלת שלבים לפי תאריך
 */
export async function getSubtasksByDate(userId, date) {
  const { data, error } = await supabase
    .from('subtasks')
    .select(`
      *,
      tasks!inner (
        id,
        title,
        user_id,
        quadrant
      )
    `)
    .eq('tasks.user_id', userId)
    .eq('due_date', date)
    .order('due_time', { ascending: true, nullsFirst: false });
  
  if (error) throw error;
  return data;
}

// === פונקציות תבניות משימות ===

/**
 * קבלת כל התבניות של המשתמש
 */
export async function getTaskTemplates(userId) {
  const { data, error } = await supabase
    .from('task_templates')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data;
}

/**
 * יצירת תבנית חדשה
 */
export async function createTaskTemplate(template) {
  const { data, error } = await supabase
    .from('task_templates')
    .insert([{
      user_id: template.user_id,
      title: template.title,
      description: template.description || null,
      quadrant: template.quadrant,
      due_time: template.due_time || null,
      reminder_minutes: template.reminder_minutes || null,
      estimated_duration: template.estimated_duration || null,
      is_project: template.is_project || false
    }])
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * עדכון תבנית
 */
export async function updateTaskTemplate(templateId, updates) {
  const { data, error } = await supabase
    .from('task_templates')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', templateId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * מחיקת תבנית
 */
export async function deleteTaskTemplate(templateId) {
  const { error } = await supabase
    .from('task_templates')
    .delete()
    .eq('id', templateId);
  
  if (error) throw error;
}

/**
 * יצירת משימה מתבנית
 */
export async function createTaskFromTemplate(templateId, userId, dueDate = null) {
  // קבלת התבנית
  const { data: template, error: templateError } = await supabase
    .from('task_templates')
    .select('*')
    .eq('id', templateId)
    .eq('user_id', userId)
    .single();
  
  if (templateError) throw templateError;
  if (!template) throw new Error('תבנית לא נמצאה');
  
  // יצירת משימה מהתבנית
  const newTask = await createTask({
    user_id: userId,
    title: template.title,
    description: template.description || null,
    quadrant: template.quadrant,
    due_date: dueDate || null,
    due_time: template.due_time || null,
    reminder_minutes: template.reminder_minutes || null,
    estimated_duration: template.estimated_duration || null,
    is_project: template.is_project || false,
    parent_task_id: null,
    time_spent: 0,
    is_completed: false
  });
  
  return newTask;
}

export default supabase;


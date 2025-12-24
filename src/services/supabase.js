import { createClient } from '@supabase/supabase-js';

// הגדרות Supabase - יש להחליף בערכים האמיתיים
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// בדיקה שההגדרות קיימות
if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === 'YOUR_SUPABASE_URL' || supabaseAnonKey === 'YOUR_SUPABASE_ANON_KEY') {
  console.error('❌ שגיאה: חסרות הגדרות Supabase!');
  console.error('אנא צור קובץ .env עם הערכים הבאים:');
  console.error('VITE_SUPABASE_URL=https://your-project.supabase.co');
  console.error('VITE_SUPABASE_ANON_KEY=your-anon-key');
}

// יצירת לקוח Supabase (אפילו עם ערכים ריקים כדי למנוע קריסה)
// טיפול מיוחד בנייד - בדיקה אם localStorage זמין
const getStorage = () => {
  if (typeof window === 'undefined') return undefined;
  
  try {
    // בדיקה אם localStorage זמין (iOS Safari לפעמים חוסם)
    const test = '__localStorage_test__';
    localStorage.setItem(test, '1');
    localStorage.removeItem(test);
    return window.localStorage;
  } catch (e) {
    console.warn('⚠️ localStorage לא זמין, משתמש ב-memory storage:', e);
    // Fallback ל-memory storage אם localStorage לא זמין
    const memoryStorage = {
      getItem: (key) => memoryStorage._data[key] || null,
      setItem: (key, value) => { memoryStorage._data[key] = value; },
      removeItem: (key) => { delete memoryStorage._data[key]; },
      clear: () => { memoryStorage._data = {}; },
      _data: {}
    };
    return memoryStorage;
  }
};

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: getStorage(),
      storageKey: 'eisenhower-auth'
    },
    // הגדרות נוספות לשיפור ביצועים
    db: {
      schema: 'public'
    },
    global: {
      headers: {
        'x-client-info': 'eisenhower-app'
      }
    },
    // timeout מוגדל ל-60 שניות
    realtime: {
      timeout: 60000
    }
  }
);

// Debug: check session on load
if (typeof window !== 'undefined') {
  supabase.auth.getSession().then(({ data, error }) => {
    console.log('🔑 Session on load:', {
      hasSession: !!data?.session,
      email: data?.session?.user?.email,
      error: error?.message
    });
  });
}

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
  try {
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();
    
    // אם יש שגיאה בטעינת הפרופיל, נחזיר את המשתמש הבסיסי
    if (profileError) {
      console.warn('שגיאה בטעינת פרופיל משתמש:', profileError);
      return { ...user, profile: null };
    }
    
    return { ...user, profile };
  } catch (err) {
    console.warn('שגיאה בטעינת פרופיל משתמש:', err);
    // אם יש שגיאה, נחזיר את המשתמש הבסיסי
    return { ...user, profile: null };
  }
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
        start_date,
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
/**
 * וידוא שמשתמש קיים בטבלת users - אם לא, יוצר אותו
 */
async function ensureUserExists(userId, email = null) {
  try {
    // בדיקה אם המשתמש קיים - עם טיפול בשגיאות RLS
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle(); // משתמש ב-maybeSingle במקום single כדי לא לזרוק שגיאה אם לא נמצא
    
    // אם יש שגיאה אבל זה לא "לא נמצא", נזרוק שגיאה
    if (checkError && checkError.code !== 'PGRST116') {
      console.error('❌ שגיאה בבדיקת משתמש:', checkError);
      // אם זה RLS error, ננסה ליצור את המשתמש בכל זאת
      if (checkError.code === '42501') {
        console.warn('⚠️ RLS error - ננסה ליצור משתמש בכל זאת');
      } else {
        throw checkError;
      }
    }
    
    if (existingUser) {
      console.log('✅ משתמש קיים בטבלת users:', userId);
      return true;
    }
    
    // אם המשתמש לא קיים, ננסה ליצור אותו
    console.warn('⚠️ משתמש לא קיים בטבלת users, יוצר אותו...', userId);
    
    // קבלת פרטי משתמש מ-auth.users
    let authUser = null;
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser(userId);
      if (authError) {
        console.error('❌ שגיאה בקבלת פרטי משתמש:', authError);
        // אם לא הצלחנו לקבל פרטים, נשתמש ב-email שסופק
        if (!email) {
          throw new Error('❌ לא ניתן לקבל פרטי משתמש ואין email');
        }
      } else {
        authUser = user;
      }
    } catch (authErr) {
      console.warn('⚠️ לא הצלחתי לקבל פרטי משתמש מ-auth, ממשיך עם email שסופק:', authErr);
    }
    
    // יצירת משתמש בטבלת users
    const userData = {
      id: userId,
      email: email || authUser?.email || '',
      full_name: authUser?.user_metadata?.full_name || authUser?.user_metadata?.full_name || '',
      role: 'user',
      is_active: true
    };
    
    console.log('📤 יוצר משתמש בטבלת users:', userData);
    
    const { error: insertError } = await supabase
      .from('users')
      .insert([userData]);
    
    if (insertError) {
      console.error('❌ שגיאה ביצירת משתמש:', insertError);
      
      // אם זה foreign key error, זה אומר שהמשתמש לא קיים ב-auth.users
      if (insertError.code === '23503' || insertError.message?.includes('foreign key')) {
        throw new Error('❌ המשתמש לא קיים במערכת האימות. אנא התחברי מחדש.');
      }
      
      // אם זה unique constraint error, המשתמש כבר קיים (race condition)
      if (insertError.code === '23505' || insertError.message?.includes('unique')) {
        console.log('✅ משתמש כבר קיים (race condition)');
        return true;
      }
      
      // שגיאות אחרות
      throw insertError;
    }
    
    console.log('✅ משתמש נוצר בהצלחה בטבלת users:', userId);
    return true;
  } catch (err) {
    console.error('❌ שגיאה ב-ensureUserExists:', err);
    throw err;
  }
}

export async function createTask(task) {
  console.log('🔵 createTask נקרא עם:', task);
  
  // בדיקת סשן אם אין user_id
  if (!task.user_id) {
    console.warn('⚠️ אין user_id, בודק סשן...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      const error = new Error('❌ שגיאה בבדיקת סשן: ' + sessionError.message);
      console.error(error);
      throw error;
    }
    if (session?.user?.id) {
      task.user_id = session.user.id;
      console.log('✅ נמצא user_id מהסשן:', task.user_id);
    } else {
      const error = new Error('❌ חסר user_id ואין סשן פעיל!');
      console.error(error);
      throw error;
    }
  }
  
  // וידוא שהמשתמש קיים בטבלת users לפני יצירת משימה
  try {
    await ensureUserExists(task.user_id, task.user_email);
  } catch (err) {
    console.error('❌ שגיאה ב-ensureUserExists:', err);
    throw new Error('❌ לא ניתן ליצור משימה - המשתמש לא קיים במערכת. אנא התחברי מחדש.');
  }
  
  // וידוא שיש כותרת
  if (!task.title || task.title.trim() === '') {
    const error = new Error('❌ חסרה כותרת משימה!');
    console.error(error);
    throw error;
  }
  
  // הכנת נתונים לשמירה - וידוא שכל השדות מועברים נכון
  const taskData = {
    user_id: task.user_id,
    title: task.title.trim(),
    description: task.description?.trim() || null,
    quadrant: task.quadrant || 1,
    start_date: task.start_date || task.startDate || null,
    due_date: task.due_date || task.dueDate || null,
    due_time: task.due_time || task.dueTime || null,
    reminder_minutes: task.reminder_minutes ? parseInt(task.reminder_minutes) : null,
    estimated_duration: task.estimated_duration ? parseInt(task.estimated_duration) : null,
    task_type: task.task_type || 'other', // תמיד יש ערך
    task_parameter: task.task_parameter ? parseInt(task.task_parameter) : null,
    is_project: task.is_project || false,
    parent_task_id: task.parent_task_id || null,
    priority: task.priority || 'normal', // עדיפות: low, normal, high, urgent
    // לא נוסיף time_spent - העמודה לא קיימת בטבלה
    is_completed: task.is_completed || false
  };
  
  console.log('💾 שומר משימה עם נתונים:', taskData);
  
  try {
    console.log('📤 שולח insert ל-Supabase...');
    console.log('📋 נתונים שנשלחים:', JSON.stringify(taskData, null, 2));
    
    // בדיקת סשן לפני insert
    const { data: { session: checkSession }, error: sessionCheckError } = await supabase.auth.getSession();
    if (sessionCheckError) {
      console.error('❌ שגיאה בבדיקת סשן לפני insert:', sessionCheckError);
      throw new Error('❌ שגיאה באימות. אנא התחברי מחדש.');
    }
    if (!checkSession?.user) {
      console.error('❌ אין סשן פעיל לפני insert!');
      console.error('📋 פרטי סשן:', { 
        hasSession: !!checkSession, 
        hasUser: !!checkSession?.user,
        sessionData: checkSession 
      });
      throw new Error('❌ אין משתמש מחובר. אנא התחברי מחדש.');
    }
    console.log('✅ סשן תקין לפני insert:', {
      userId: checkSession.user.id,
      email: checkSession.user.email,
      expiresAt: checkSession.expires_at
    });
    
    // וידוא שה-user_id תואם לסשן
    if (taskData.user_id !== checkSession.user.id) {
      console.warn('⚠️ user_id לא תואם לסשן!', {
        taskUserId: taskData.user_id,
        sessionUserId: checkSession.user.id
      });
      taskData.user_id = checkSession.user.id; // תיקון אוטומטי
      console.log('✅ תוקן user_id:', taskData.user_id);
    }
    
    const insertStartTime = Date.now();
    let data, error;
    
    try {
      console.log('⏳ ממתין לתגובה מ-Supabase...');
      
      // יצירת Promise עם timeout למניעת תקיעות
      const insertPromise = supabase
        .from('tasks')
        .insert([taskData])
        .select()
        .single();
      
      // Timeout של 30 שניות
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('⏱️ Insert לקח יותר מ-30 שניות - timeout. בדוק את החיבור לאינטרנט.'));
        }, 30000);
      });
      
      const result = await Promise.race([insertPromise, timeoutPromise]);
      
      data = result.data;
      error = result.error;
      
      const insertDuration = Date.now() - insertStartTime;
      console.log(`📥 תגובה מ-Supabase (לקח ${insertDuration}ms):`, { 
        hasData: !!data, 
        hasError: !!error,
        dataId: data?.id,
        error: error ? {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        } : null
      });
      
      if (insertDuration > 5000) {
        console.warn('⚠️ Insert לקח יותר מ-5 שניות!', insertDuration);
      }
    } catch (insertErr) {
      console.error('💥 Exception במהלך insert:', insertErr);
      console.error('📋 פרטי Exception:', {
        message: insertErr.message,
        stack: insertErr.stack,
        name: insertErr.name
      });
      error = insertErr;
    }
    
    if (error) {
      console.error('❌ שגיאה מ-Supabase:', error);
      console.error('📋 פרטי שגיאה מלאים:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        taskData: JSON.stringify(taskData, null, 2)
      });
      
      // הודעות שגיאה ידידותיות
      if (error.message?.includes('task_type')) {
        throw new Error('❌ שדה task_type לא קיים! האם הרצת את ה-migration 007?');
      }
      if (error.code === '42501') {
        throw new Error('❌ אין הרשאות! בדוק את ה-RLS policies. האם המשתמש מחובר?');
      }
      if (error.code === '23505') {
        throw new Error('❌ המשימה כבר קיימת');
      }
      if (error.code === 'PGRST301' || error.message?.includes('JWT')) {
        throw new Error('❌ סשן פג. אנא התחברי מחדש.');
      }
      
      throw error;
    }
    
    if (!data) {
      console.error('❌ לא הוחזר data מ-Supabase!', {
        taskData: JSON.stringify(taskData, null, 2),
        response: { data, error }
      });
      throw new Error('❌ המשימה לא נוצרה (אין data)');
    }
    
    console.log('✅ משימה נוצרה בהצלחה:', data);
    console.log('🆔 ID של המשימה החדשה:', data.id);
    return data;
    
  } catch (err) {
    console.error('💥 Exception ב-createTask:', err);
    console.error('📋 פרטי Exception:', {
      message: err.message,
      stack: err.stack,
      taskData
    });
    throw err;
  }
}

/**
 * עדכון משימה
 */
export async function updateTask(taskId, updates) {
  // בדיקת סשן לפני עדכון
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.user) {
    throw new Error('❌ אין משתמש מחובר. אנא התחברי מחדש.');
  }
  
  // הכנת נתונים לעדכון - רק שדות בסיסיים
  const updateData = {
    updated_at: new Date().toISOString()
  };
  
  // הוספת רק שדות שקיימים בטבלה
  if (updates.is_completed !== undefined) {
    updateData.is_completed = updates.is_completed;
  }
  if (updates.completed_at !== undefined) {
    updateData.completed_at = updates.completed_at;
  }
  if (updates.title !== undefined) {
    updateData.title = updates.title;
  }
  if (updates.description !== undefined) {
    updateData.description = updates.description;
  }
  if (updates.quadrant !== undefined) {
    updateData.quadrant = updates.quadrant;
  }
  if (updates.start_date !== undefined || updates.startDate !== undefined) {
    updateData.start_date = updates.start_date || updates.startDate || null;
  }
  if (updates.due_date !== undefined || updates.dueDate !== undefined) {
    updateData.due_date = updates.due_date || updates.dueDate || null;
  }
  if (updates.due_time !== undefined || updates.dueTime !== undefined) {
    updateData.due_time = updates.due_time || updates.dueTime || null;
  }
  if (updates.reminder_minutes !== undefined) {
    updateData.reminder_minutes = updates.reminder_minutes ? parseInt(updates.reminder_minutes) : null;
  }
  if (updates.estimated_duration !== undefined) {
    updateData.estimated_duration = updates.estimated_duration ? parseInt(updates.estimated_duration) : null;
  }
  if (updates.task_type !== undefined) {
    updateData.task_type = updates.task_type;
  }
  if (updates.is_project !== undefined) {
    updateData.is_project = updates.is_project;
  }
  if (updates.parent_task_id !== undefined) {
    updateData.parent_task_id = updates.parent_task_id;
  }
  if (updates.time_spent !== undefined) {
    updateData.time_spent = updates.time_spent ? parseInt(updates.time_spent) : 0;
  }
  if (updates.priority !== undefined) {
    updateData.priority = updates.priority;
  }
  if (updates.notes !== undefined) {
    updateData.notes = updates.notes;
  }
  
  console.log('📤 מעדכן משימה:', { taskId, updateData });
  
  // עדכון עם time_spent
  const { data, error } = await supabase
    .from('tasks')
    .update(updateData)
    .eq('id', taskId)
    .select('id, title, description, notes, quadrant, start_date, due_date, due_time, reminder_minutes, estimated_duration, task_type, is_project, parent_task_id, is_completed, completed_at, created_at, updated_at, user_id, time_spent, priority')
    .single();
  
  if (error) {
    console.error('❌ שגיאה בעדכון משימה:', error);
    console.error('📋 פרטי שגיאה:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      taskId,
      updateData
    });
    throw error;
  }
  
  if (!data) {
    throw new Error('המשימה לא עודכנה - אין data');
  }
  
  return data;
}

/**
 * עדכון זמן שבוצע למשימה
 */
export async function updateTaskTimeSpent(taskId, timeSpent) {
  return updateTask(taskId, { time_spent: timeSpent });
}

/**
 * מחיקת משימה - שומר נתוני למידה לפני מחיקה
 */
export async function deleteTask(taskId) {
  // בדיקת סשן
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.user) {
    throw new Error('❌ אין משתמש מחובר. אנא התחברי מחדש.');
  }
  
  // מחיקה פשוטה - בלי שמירת היסטוריה (זה מורכב מדי)
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId);
  
  if (error) {
    console.error('❌ שגיאה במחיקת משימה:', error);
    throw error;
  }
  
  console.log('✅ משימה נמחקה');
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
  const projectTaskData = {
    user_id: taskData.user_id,
    title: taskData.title,
    description: taskData.description || null,
    quadrant: taskData.quadrant,
    start_date: taskData.startDate || null,
    due_date: taskData.dueDate || null,
    due_time: taskData.dueTime || null,
    reminder_minutes: taskData.reminderMinutes ? parseInt(taskData.reminderMinutes) : null,
    is_project: true,
    parent_task_id: null,
    estimated_duration: taskData.totalDuration ? parseInt(taskData.totalDuration) : null,
    // לא נוסיף time_spent - העמודה לא קיימת בטבלה
    is_completed: false
  };
  
  console.log('יוצר משימת פרויקט:', projectTaskData);
  
  const { data: projectTask, error: taskError } = await supabase
    .from('tasks')
    .insert([projectTaskData])
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
      const stageTaskData = {
        user_id: taskData.user_id,
        title: `${taskData.title} - ${st.title}`,
        description: st.description || null,
        quadrant: quadrant,
        start_date: st.startDate || null,
        due_date: st.dueDate || null,
        due_time: st.dueTime || null,
        reminder_minutes: taskData.reminderMinutes ? parseInt(taskData.reminderMinutes) : null,
        is_project: false,
        parent_task_id: projectTask.id,
        estimated_duration: st.estimatedDuration ? parseInt(st.estimatedDuration) : null,
        // לא נוסיף time_spent - העמודה לא קיימת בטבלה
        is_completed: false
      };
      
      const { data: stageTask, error: stageError } = await supabase
        .from('tasks')
        .insert([stageTaskData])
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
          start_date: st.startDate || null,
          due_date: st.dueDate || null,
          due_time: st.dueTime || null,
          estimated_duration: st.estimatedDuration || null,
          // לא נוסיף time_spent - העמודה לא קיימת בטבלה
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
      start_date: subtaskData.startDate || null,
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

// === פונקציות בלוקי זמן ===

/**
 * קבלת בלוקי זמן של המשתמש
 */
export async function getTimeBlocks(userId, startDate = null, endDate = null) {
  let query = supabase
    .from('time_blocks')
    .select(`
      *,
      tasks (
        id,
        title,
        quadrant
      )
    `)
    .eq('user_id', userId)
    .order('start_time', { ascending: true });

  if (startDate) {
    query = query.gte('start_time', startDate.toISOString());
  }
  if (endDate) {
    query = query.lte('start_time', endDate.toISOString());
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * יצירת בלוק זמן
 */
export async function createTimeBlock(block) {
  const { data, error } = await supabase
    .from('time_blocks')
    .insert([{
      user_id: block.user_id,
      task_id: block.task_id || null,
      title: block.title,
      description: block.description || null,
      start_time: block.start_time,
      end_time: block.end_time,
      is_completed: false
    }])
    .select(`
      *,
      tasks (
        id,
        title,
        quadrant
      )
    `)
    .single();

  if (error) throw error;
  return data;
}

/**
 * עדכון בלוק זמן
 */
export async function updateTimeBlock(blockId, updates) {
  const { data, error } = await supabase
    .from('time_blocks')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', blockId)
    .select(`
      *,
      tasks (
        id,
        title,
        quadrant
      )
    `)
    .single();

  if (error) throw error;
  return data;
}

/**
 * מחיקת בלוק זמן
 */
export async function deleteTimeBlock(blockId) {
  const { error } = await supabase
    .from('time_blocks')
    .delete()
    .eq('id', blockId);

  if (error) throw error;
}

/**
 * סימון בלוק כהושלם
 */
export async function completeTimeBlock(blockId, actualStartTime = null, actualEndTime = null) {
  const updates = {
    is_completed: true,
    actual_start_time: actualStartTime || new Date().toISOString(),
    actual_end_time: actualEndTime || new Date().toISOString()
  };

  return await updateTimeBlock(blockId, updates);
}

// === פונקציות למידת זמן ===

/**
 * קבלת נתוני למידה לסוג משימה מסוים
 */
export async function getTaskTypeLearning(userId, taskType) {
  const { data, error } = await supabase
    .from('task_type_learning')
    .select('*')
    .eq('user_id', userId)
    .eq('task_type', taskType)
    .maybeSingle();

  if (error) {
    console.error('שגיאה בטעינת נתוני למידה:', error);
    return null;
  }

  return data;
}

/**
 * קבלת כל נתוני הלמידה של משתמש
 */
export async function getAllTaskTypeLearning(userId) {
  const { data, error } = await supabase
    .from('task_type_learning')
    .select('*')
    .eq('user_id', userId)
    .order('total_tasks', { ascending: false });

  if (error) {
    console.error('שגיאה בטעינת נתוני למידה:', error);
    return [];
  }

  return data || [];
}

/**
 * חישוב זמן מוצע לפי נתוני למידה
 */
export function calculateSuggestedTime(learningData, baseEstimate) {
  if (!learningData || !learningData.average_ratio || learningData.total_tasks < 2) {
    // אין מספיק נתונים - החזר את ההערכה המקורית
    return baseEstimate;
  }

  // הכפל את ההערכה ביחס הממוצע
  return Math.round(baseEstimate * learningData.average_ratio);
}

export default supabase;


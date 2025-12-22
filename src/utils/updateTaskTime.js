/**
 * עדכון זמן שבוצע למשימה לפי שם
 * פונקציה עזרה לעדכן זמן ידנית
 */

export async function updateTaskTimeByName(taskTitle, timeSpentMinutes, supabase) {
  try {
    // קבלת המשתמש הנוכחי
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      throw new Error('אין משתמש מחובר');
    }

    // חיפוש המשימה לפי שם
    const { data: tasks, error: searchError } = await supabase
      .from('tasks')
      .select('id, title, time_spent')
      .eq('user_id', session.user.id)
      .ilike('title', `%${taskTitle}%`);

    if (searchError) {
      throw searchError;
    }

    if (!tasks || tasks.length === 0) {
      throw new Error(`לא נמצאה משימה עם השם "${taskTitle}"`);
    }

    if (tasks.length > 1) {
      console.warn(`נמצאו ${tasks.length} משימות עם השם "${taskTitle}", מעדכן את הראשונה`);
    }

    const task = tasks[0];
    console.log(`מעדכן משימה: ${task.title} (ID: ${task.id}), זמן נוכחי: ${task.time_spent || 0} דקות, זמן חדש: ${timeSpentMinutes} דקות`);

    // עדכון הזמן
    const { data: updatedTask, error: updateError } = await supabase
      .from('tasks')
      .update({ 
        time_spent: timeSpentMinutes,
        updated_at: new Date().toISOString()
      })
      .eq('id', task.id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    console.log('✅ זמן עודכן בהצלחה!', updatedTask);
    return updatedTask;
  } catch (err) {
    console.error('❌ שגיאה בעדכון זמן:', err);
    throw err;
  }
}


-- ==============================================
-- תיקון Triggers - לא ינסו לגשת ל-time_spent אם הוא לא קיים
-- ==============================================

-- ביטול כל ה-triggers הישנים שמנסים לגשת ל-time_spent
DROP TRIGGER IF EXISTS update_task_type_stats_trigger ON public.tasks;
DROP TRIGGER IF EXISTS auto_update_correction_trigger ON public.tasks;
DROP TRIGGER IF EXISTS update_task_learning_stats ON public.tasks;
DROP TRIGGER IF EXISTS auto_update_correction_multiplier ON public.tasks;
DROP TRIGGER IF EXISTS update_task_learning_stats_safe ON public.tasks;

-- ביטול הפונקציות הישנות שמנסות לגשת ל-time_spent
DROP FUNCTION IF EXISTS public.update_task_type_stats() CASCADE;
DROP FUNCTION IF EXISTS public.auto_update_correction_multiplier() CASCADE;

-- יצירת trigger חדש לעדכון סטטיסטיקות - בלי time_spent
CREATE OR REPLACE FUNCTION public.update_task_learning_stats_safe()
RETURNS TRIGGER AS $$
DECLARE
  task_accuracy INTEGER;
  new_avg_accuracy INTEGER;
BEGIN
  -- רק אם המשימה הושלמה ויש לה זמן משוער
  -- לא נבדוק time_spent כי הוא לא תמיד קיים
  IF NEW.is_completed = true AND OLD.is_completed = false 
     AND NEW.estimated_duration IS NOT NULL THEN
    
    -- הוספה להיסטוריה - בלי time_spent
    INSERT INTO public.task_completion_history (
      user_id,
      task_id,
      task_type,
      task_title,
      quadrant,
      estimated_duration,
      actual_duration,
      accuracy_percentage,
      completed_at,
      day_of_week,
      hour_of_day
    ) VALUES (
      NEW.user_id,
      NEW.id,
      COALESCE(NEW.task_type, 'other'),
      NEW.title,
      NEW.quadrant,
      NEW.estimated_duration,
      0, -- actual_duration - לא נשתמש ב-time_spent
      0, -- accuracy - לא נחשב בלי time_spent
      NOW(),
      EXTRACT(DOW FROM NOW())::INTEGER,
      EXTRACT(HOUR FROM NOW())::INTEGER
    )
    ON CONFLICT DO NOTHING;
    
    -- עדכון או יצירת סטטיסטיקות - בלי time_spent
    INSERT INTO public.task_type_stats (
      user_id,
      task_type,
      total_tasks,
      completed_tasks,
      total_time_spent,
      average_time,
      min_time,
      max_time,
      total_estimates,
      accurate_estimates,
      average_accuracy_percentage,
      last_updated
    )
    VALUES (
      NEW.user_id,
      COALESCE(NEW.task_type, 'other'),
      1,
      1,
      0, -- total_time_spent - לא נשתמש ב-time_spent
      0, -- average_time
      NULL, -- min_time
      0, -- max_time
      1,
      0, -- accurate_estimates - לא נחשב בלי time_spent
      0, -- average_accuracy_percentage
      NOW()
    )
    ON CONFLICT (user_id, task_type) DO UPDATE SET
      total_tasks = task_type_stats.total_tasks + 1,
      completed_tasks = task_type_stats.completed_tasks + 1,
      total_estimates = task_type_stats.total_estimates + 1,
      last_updated = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- יצירת trigger חדש
CREATE TRIGGER update_task_learning_stats_safe
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  WHEN (NEW.is_completed IS DISTINCT FROM OLD.is_completed)
  EXECUTE FUNCTION public.update_task_learning_stats_safe();

-- הודעת הצלחה
DO $$
BEGIN
  RAISE NOTICE '✅ Triggers תוקנו - לא ינסו לגשת ל-time_spent';
END $$;


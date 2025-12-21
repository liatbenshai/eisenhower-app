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

-- יצירת trigger חדש לעדכון סטטיסטיקות - עם תמיכה ב-time_spent אם קיים
CREATE OR REPLACE FUNCTION public.update_task_learning_stats_safe()
RETURNS TRIGGER AS $$
DECLARE
  task_accuracy INTEGER;
  actual_time INTEGER;
  has_time_spent BOOLEAN;
BEGIN
  -- רק אם המשימה הושלמה
  IF NEW.is_completed = true AND OLD.is_completed = false THEN
    
    -- בדיקה אם time_spent קיים (אם העמודה קיימת בטבלה)
    BEGIN
      -- ננסה לגשת ל-time_spent - אם זה נכשל, נדע שהעמודה לא קיימת
      actual_time := COALESCE(NEW.time_spent, 0);
      has_time_spent := (NEW.time_spent IS NOT NULL AND NEW.time_spent > 0);
    EXCEPTION WHEN OTHERS THEN
      -- אם יש שגיאה, העמודה לא קיימת
      actual_time := 0;
      has_time_spent := false;
    END;
    
    -- חישוב דיוק רק אם יש time_spent ו-estimated_duration
    IF has_time_spent AND NEW.estimated_duration IS NOT NULL AND NEW.estimated_duration > 0 THEN
      task_accuracy := GREATEST(0, 100 - ABS(actual_time - NEW.estimated_duration) * 100 / GREATEST(NEW.estimated_duration, actual_time));
    ELSE
      task_accuracy := 0;
    END IF;
    
    -- הוספה להיסטוריה
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
      actual_time,
      task_accuracy,
      NOW(),
      EXTRACT(DOW FROM NOW())::INTEGER,
      EXTRACT(HOUR FROM NOW())::INTEGER
    )
    ON CONFLICT DO NOTHING;
    
    -- עדכון או יצירת סטטיסטיקות
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
      actual_time,
      CASE WHEN has_time_spent THEN actual_time ELSE 0 END,
      CASE WHEN has_time_spent THEN actual_time ELSE NULL END,
      actual_time,
      CASE WHEN NEW.estimated_duration IS NOT NULL THEN 1 ELSE 0 END,
      CASE WHEN task_accuracy >= 80 THEN 1 ELSE 0 END,
      task_accuracy,
      NOW()
    )
    ON CONFLICT (user_id, task_type) DO UPDATE SET
      total_tasks = task_type_stats.total_tasks + 1,
      completed_tasks = task_type_stats.completed_tasks + 1,
      total_time_spent = task_type_stats.total_time_spent + actual_time,
      average_time = CASE 
        WHEN has_time_spent AND (task_type_stats.completed_tasks + 1) > 0 
        THEN (task_type_stats.total_time_spent + actual_time) / (task_type_stats.completed_tasks + 1)
        ELSE task_type_stats.average_time
      END,
      min_time = CASE 
        WHEN has_time_spent THEN 
          COALESCE(LEAST(task_type_stats.min_time, actual_time), actual_time)
        ELSE task_type_stats.min_time
      END,
      max_time = GREATEST(task_type_stats.max_time, actual_time),
      total_estimates = task_type_stats.total_estimates + CASE WHEN NEW.estimated_duration IS NOT NULL THEN 1 ELSE 0 END,
      accurate_estimates = task_type_stats.accurate_estimates + CASE WHEN task_accuracy >= 80 THEN 1 ELSE 0 END,
      average_accuracy_percentage = CASE 
        WHEN task_accuracy > 0 THEN 
          (task_type_stats.average_accuracy_percentage * task_type_stats.completed_tasks + task_accuracy) / (task_type_stats.completed_tasks + 1)
        ELSE task_type_stats.average_accuracy_percentage
      END,
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


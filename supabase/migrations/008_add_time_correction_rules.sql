-- ==============================================
-- טבלת כללי תיקון זמן
-- מאפשר למשתמשים להגדיר שמשימות מסוגים מסוימים
-- תמיד לוקחות יותר/פחות זמן ממה שהם מעריכים
-- ==============================================

CREATE TABLE IF NOT EXISTS public.time_correction_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL,
  
  -- מקדם תיקון
  time_multiplier DECIMAL(4,2) DEFAULT 1.0 NOT NULL,
  -- דוגמה: 1.5 = המשימה לוקחת פי 1.5 ממה שהמשתמש חושב
  --        0.8 = המשימה לוקחת 80% מהזמן שהמשתמש חושב
  
  -- הערות
  notes TEXT,
  
  -- האם הכלל פעיל
  is_active BOOLEAN DEFAULT true,
  
  -- סטטיסטיקות
  times_applied INTEGER DEFAULT 0, -- כמה פעמים הכלל הוצע
  times_accepted INTEGER DEFAULT 0, -- כמה פעמים המשתמש קיבל את ההצעה
  
  -- תאריכים
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  
  -- מפתח ייחודי: משתמש + סוג משימה
  UNIQUE(user_id, task_type)
);

-- אינדקסים
CREATE INDEX IF NOT EXISTS idx_time_correction_user_id 
  ON public.time_correction_rules(user_id);

CREATE INDEX IF NOT EXISTS idx_time_correction_task_type 
  ON public.time_correction_rules(task_type);

CREATE INDEX IF NOT EXISTS idx_time_correction_active 
  ON public.time_correction_rules(is_active) 
  WHERE is_active = true;

-- ==============================================
-- Row Level Security (RLS)
-- ==============================================

ALTER TABLE public.time_correction_rules ENABLE ROW LEVEL SECURITY;

-- משתמשים יכולים לראות רק את הכללים שלהם
CREATE POLICY "users_select_own_rules" ON public.time_correction_rules
  FOR SELECT USING (auth.uid() = user_id);

-- משתמשים יכולים להוסיף כללים
CREATE POLICY "users_insert_own_rules" ON public.time_correction_rules
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- משתמשים יכולים לעדכן את הכללים שלהם
CREATE POLICY "users_update_own_rules" ON public.time_correction_rules
  FOR UPDATE USING (auth.uid() = user_id);

-- משתמשים יכולים למחוק את הכללים שלהם
CREATE POLICY "users_delete_own_rules" ON public.time_correction_rules
  FOR DELETE USING (auth.uid() = user_id);

-- ==============================================
-- פונקציות עזר
-- ==============================================

-- פונקציה לחישוב זמן מתוקן
CREATE OR REPLACE FUNCTION public.get_corrected_time(
  p_user_id UUID,
  p_task_type TEXT,
  p_estimated_time INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  multiplier DECIMAL(4,2);
  corrected_time INTEGER;
BEGIN
  -- מחפשים כלל פעיל
  SELECT time_multiplier INTO multiplier
  FROM public.time_correction_rules
  WHERE user_id = p_user_id 
    AND task_type = p_task_type 
    AND is_active = true;
  
  -- אם לא נמצא כלל, מחזירים את הזמן המקורי
  IF multiplier IS NULL THEN
    RETURN p_estimated_time;
  END IF;
  
  -- חישוב הזמן המתוקן
  corrected_time := ROUND(p_estimated_time * multiplier);
  
  -- עדכון מונה השימושים
  UPDATE public.time_correction_rules
  SET times_applied = times_applied + 1,
      last_updated = NOW()
  WHERE user_id = p_user_id 
    AND task_type = p_task_type;
  
  RETURN corrected_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- פונקציה לעדכון מקדם תיקון אוטומטית לפי תוצאות בפועל
CREATE OR REPLACE FUNCTION public.auto_update_correction_multiplier()
RETURNS TRIGGER AS $$
DECLARE
  current_multiplier DECIMAL(4,2);
  avg_actual_vs_estimated DECIMAL(4,2);
  new_multiplier DECIMAL(4,2);
BEGIN
  -- רק אם המשימה הושלמה
  IF NEW.is_completed = true AND OLD.is_completed = false 
     AND NEW.estimated_duration IS NOT NULL 
     AND NEW.time_spent IS NOT NULL 
     AND NEW.time_spent > 0 
     AND NEW.task_type IS NOT NULL THEN
    
    -- בדיקה אם יש כלל פעיל לסוג המשימה
    SELECT time_multiplier INTO current_multiplier
    FROM public.time_correction_rules
    WHERE user_id = NEW.user_id 
      AND task_type = NEW.task_type
      AND is_active = true;
    
    -- אם יש כלל, נעדכן אותו
    IF current_multiplier IS NOT NULL THEN
      -- חישוב יחס ממוצע של זמן בפועל לעומת משוער
      -- מהיסטוריה של 10 המשימות האחרונות
      SELECT AVG(time_spent::DECIMAL / estimated_duration::DECIMAL) INTO avg_actual_vs_estimated
      FROM (
        SELECT time_spent, estimated_duration
        FROM public.task_completion_history
        WHERE user_id = NEW.user_id
          AND task_type = NEW.task_type
          AND estimated_duration > 0
        ORDER BY completed_at DESC
        LIMIT 10
      ) recent_tasks;
      
      -- אם יש מספיק נתונים, נעדכן את המקדם
      IF avg_actual_vs_estimated IS NOT NULL THEN
        -- מקדם חדש = ממוצע משוקלל: 70% מהמקדם הישן, 30% מהנתונים החדשים
        new_multiplier := (current_multiplier * 0.7) + (avg_actual_vs_estimated * 0.3);
        
        -- הגבלה למקדם סביר (בין 0.5 ל-5)
        new_multiplier := GREATEST(0.5, LEAST(5.0, new_multiplier));
        
        -- עדכון המקדם
        UPDATE public.time_correction_rules
        SET time_multiplier = new_multiplier,
            last_updated = NOW()
        WHERE user_id = NEW.user_id 
          AND task_type = NEW.task_type;
        
        -- לוג (אופציונלי)
        RAISE NOTICE 'Updated multiplier for % from % to %', 
          NEW.task_type, current_multiplier, new_multiplier;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- טריגר לעדכון אוטומטי של מקדמי תיקון
DROP TRIGGER IF EXISTS auto_update_correction_trigger ON public.tasks;
CREATE TRIGGER auto_update_correction_trigger
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_update_correction_multiplier();

-- ==============================================
-- הערות
-- ==============================================
-- 1. המערכת מציעה זמן מתוקן אוטומטית
-- 2. המקדם מתעדכן אוטומטית לפי התוצאות בפועל
-- 3. המשתמש יכול לערוך ידנית את המקדם בכל עת


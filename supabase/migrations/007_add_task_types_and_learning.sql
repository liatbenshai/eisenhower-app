-- ==============================================
-- הוספת סוג משימה ומערכת למידה
-- ==============================================

-- הוספת שדה task_type לטבלת tasks
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS task_type TEXT DEFAULT 'other';

-- יצירת אינדקס לשאילתות מהירות
CREATE INDEX IF NOT EXISTS idx_tasks_task_type ON public.tasks(task_type);

-- ==============================================
-- טבלת סטטיסטיקות למידה לפי סוג משימה
-- ==============================================
CREATE TABLE IF NOT EXISTS public.task_type_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL,
  
  -- סטטיסטיקות זמן
  total_tasks INTEGER DEFAULT 0,
  completed_tasks INTEGER DEFAULT 0,
  total_time_spent INTEGER DEFAULT 0, -- סה"כ זמן בדקות
  average_time INTEGER DEFAULT 0, -- ממוצע זמן בדקות
  min_time INTEGER DEFAULT NULL,
  max_time INTEGER DEFAULT 0,
  
  -- סטטיסטיקות דיוק
  total_estimates INTEGER DEFAULT 0,
  accurate_estimates INTEGER DEFAULT 0, -- כמה פעמים הערכנו נכון (בטווח של 20%)
  average_accuracy_percentage INTEGER DEFAULT 0,
  
  -- דפוסים
  preferred_quadrant INTEGER, -- רבע מועדף
  preferred_time_of_day TEXT, -- morning/afternoon/evening
  best_day_of_week INTEGER, -- 0-6 (0=ראשון)
  
  -- עדכון אחרון
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- מפתח ייחודי: משתמש + סוג משימה
  UNIQUE(user_id, task_type)
);

-- אינדקסים
CREATE INDEX IF NOT EXISTS idx_task_type_stats_user_id ON public.task_type_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_task_type_stats_type ON public.task_type_stats(task_type);

-- ==============================================
-- טבלת היסטוריית משימות מלאות (לצורך למידה מתקדמת)
-- ==============================================
CREATE TABLE IF NOT EXISTS public.task_completion_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  
  -- מידע על המשימה
  task_type TEXT NOT NULL,
  task_title TEXT,
  quadrant INTEGER,
  
  -- זמנים
  estimated_duration INTEGER, -- הערכה מקורית
  actual_duration INTEGER, -- זמן ביצוע בפועל
  accuracy_percentage INTEGER, -- אחוז דיוק (0-100)
  
  -- הקשר
  completed_at TIMESTAMPTZ,
  day_of_week INTEGER, -- 0-6
  hour_of_day INTEGER, -- 0-23
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- אינדקסים
CREATE INDEX IF NOT EXISTS idx_completion_history_user_id ON public.task_completion_history(user_id);
CREATE INDEX IF NOT EXISTS idx_completion_history_task_type ON public.task_completion_history(task_type);
CREATE INDEX IF NOT EXISTS idx_completion_history_completed_at ON public.task_completion_history(completed_at);

-- ==============================================
-- פונקציה לעדכון סטטיסטיקות אוטומטית
-- ==============================================
CREATE OR REPLACE FUNCTION public.update_task_type_stats()
RETURNS TRIGGER AS $$
DECLARE
  stats_record RECORD;
  task_accuracy INTEGER;
  new_avg_accuracy INTEGER;
BEGIN
  -- רק אם המשימה הושלמה ויש לה זמן משוער וזמן שבוצע
  IF NEW.is_completed = true AND OLD.is_completed = false 
     AND NEW.estimated_duration IS NOT NULL 
     AND NEW.time_spent IS NOT NULL 
     AND NEW.time_spent > 0 THEN
    
    -- חישוב דיוק
    task_accuracy := CASE 
      WHEN NEW.estimated_duration = 0 THEN 0
      ELSE 100 - ABS(NEW.time_spent - NEW.estimated_duration) * 100 / GREATEST(NEW.estimated_duration, NEW.time_spent)
    END;
    task_accuracy := GREATEST(0, task_accuracy); -- לא פחות מ-0
    
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
      NEW.time_spent,
      task_accuracy,
      NOW(),
      EXTRACT(DOW FROM NOW())::INTEGER,
      EXTRACT(HOUR FROM NOW())::INTEGER
    );
    
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
      NEW.time_spent,
      NEW.time_spent,
      NEW.time_spent, -- min_time
      NEW.time_spent, -- max_time
      1,
      CASE WHEN task_accuracy >= 80 THEN 1 ELSE 0 END,
      task_accuracy,
      NOW()
    )
    ON CONFLICT (user_id, task_type) DO UPDATE SET
      total_tasks = task_type_stats.total_tasks + 1,
      completed_tasks = task_type_stats.completed_tasks + 1,
      total_time_spent = task_type_stats.total_time_spent + NEW.time_spent,
      average_time = (task_type_stats.total_time_spent + NEW.time_spent) / (task_type_stats.completed_tasks + 1),
      min_time = CASE 
        WHEN task_type_stats.min_time IS NULL THEN NEW.time_spent
        ELSE LEAST(task_type_stats.min_time, NEW.time_spent)
      END,
      max_time = GREATEST(task_type_stats.max_time, NEW.time_spent),
      total_estimates = task_type_stats.total_estimates + 1,
      accurate_estimates = task_type_stats.accurate_estimates + CASE WHEN task_accuracy >= 80 THEN 1 ELSE 0 END,
      average_accuracy_percentage = (task_type_stats.average_accuracy_percentage * task_type_stats.total_estimates + task_accuracy) / (task_type_stats.total_estimates + 1),
      last_updated = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- טריגר לעדכון סטטיסטיקות
DROP TRIGGER IF EXISTS update_task_type_stats_trigger ON public.tasks;
CREATE TRIGGER update_task_type_stats_trigger
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_task_type_stats();

-- ==============================================
-- Row Level Security (RLS)
-- ==============================================

-- הפעלת RLS
ALTER TABLE public.task_type_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_completion_history ENABLE ROW LEVEL SECURITY;

-- מדיניות RLS - סטטיסטיקות
CREATE POLICY "users_select_own_stats" ON public.task_type_stats
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_stats" ON public.task_type_stats
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_stats" ON public.task_type_stats
  FOR UPDATE USING (auth.uid() = user_id);

-- מדיניות RLS - היסטוריה
CREATE POLICY "users_select_own_history" ON public.task_completion_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_history" ON public.task_completion_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- מנהל יכול לראות הכל (לסטטיסטיקות כלליות)
CREATE POLICY "admin_select_all_stats" ON public.task_type_stats
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "admin_select_all_history" ON public.task_completion_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- ==============================================
-- פונקציות עזר לשאילתות
-- ==============================================

-- קבלת סטטיסטיקות למשתמש
CREATE OR REPLACE FUNCTION public.get_user_task_type_stats(p_user_id UUID)
RETURNS TABLE (
  task_type TEXT,
  total_tasks INTEGER,
  completed_tasks INTEGER,
  average_time INTEGER,
  accuracy_percentage INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.task_type,
    s.total_tasks,
    s.completed_tasks,
    s.average_time,
    s.average_accuracy_percentage
  FROM public.task_type_stats s
  WHERE s.user_id = p_user_id
  ORDER BY s.total_tasks DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- חיזוי זמן לסוג משימה
CREATE OR REPLACE FUNCTION public.predict_task_duration(
  p_user_id UUID,
  p_task_type TEXT,
  p_quadrant INTEGER DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  predicted_time INTEGER;
BEGIN
  -- נסיון למצוא ממוצע מדויק
  SELECT average_time INTO predicted_time
  FROM public.task_type_stats
  WHERE user_id = p_user_id AND task_type = p_task_type;
  
  -- אם לא נמצא, השתמש בערך ברירת מחדל
  IF predicted_time IS NULL THEN
    predicted_time := 30; -- ברירת מחדל
  END IF;
  
  RETURN predicted_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- הערות
-- ==============================================
-- 1. המערכת תלמד אוטומטית מכל משימה שתושלם
-- 2. הסטטיסטיקות מתעדכנות בזמן אמת
-- 3. ניתן לשלוף תובנות על דפוסי עבודה


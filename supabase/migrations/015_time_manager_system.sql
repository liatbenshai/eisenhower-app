-- ==============================================
-- מערכת ניהול זמן חכמה - מיגרציה חדשה
-- ==============================================

-- טבלת למידת זמנים לפי סוג משימה
CREATE TABLE IF NOT EXISTS public.task_type_learning (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL,
  
  -- סטטיסטיקות מצטברות
  total_tasks INTEGER DEFAULT 0,
  total_estimated_minutes INTEGER DEFAULT 0,
  total_actual_minutes INTEGER DEFAULT 0,
  
  -- ממוצעים מחושבים
  average_ratio DECIMAL(4,2) DEFAULT 1.0, -- יחס בין בפועל להערכה
  
  -- עדכון אחרון
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, task_type)
);

-- אינדקסים
CREATE INDEX IF NOT EXISTS idx_task_type_learning_user ON public.task_type_learning(user_id);
CREATE INDEX IF NOT EXISTS idx_task_type_learning_type ON public.task_type_learning(task_type);

-- RLS
ALTER TABLE public.task_type_learning ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_type_learning_select_own" ON public.task_type_learning
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "task_type_learning_insert_own" ON public.task_type_learning
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "task_type_learning_update_own" ON public.task_type_learning
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "task_type_learning_delete_own" ON public.task_type_learning
  FOR DELETE USING (auth.uid() = user_id);

-- טריגר לעדכון updated_at
DROP TRIGGER IF EXISTS update_task_type_learning_updated_at ON public.task_type_learning;
CREATE TRIGGER update_task_type_learning_updated_at
  BEFORE UPDATE ON public.task_type_learning
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- הוספת עמודות חסרות לטבלת tasks אם לא קיימות
DO $$ 
BEGIN
  -- task_type
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'task_type') THEN
    ALTER TABLE public.tasks ADD COLUMN task_type TEXT DEFAULT 'other';
  END IF;
  
  -- time_spent
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'time_spent') THEN
    ALTER TABLE public.tasks ADD COLUMN time_spent INTEGER DEFAULT 0;
  END IF;
  
  -- estimated_duration
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'estimated_duration') THEN
    ALTER TABLE public.tasks ADD COLUMN estimated_duration INTEGER;
  END IF;
  
  -- task_parameter (למשל אורך קובץ לתמלול)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'task_parameter') THEN
    ALTER TABLE public.tasks ADD COLUMN task_parameter INTEGER;
  END IF;
  
  -- start_date
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'start_date') THEN
    ALTER TABLE public.tasks ADD COLUMN start_date DATE;
  END IF;
END $$;

-- אינדקס על task_type
CREATE INDEX IF NOT EXISTS idx_tasks_task_type ON public.tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_tasks_start_date ON public.tasks(start_date);

-- פונקציה לעדכון למידת זמן אחרי השלמת משימה
CREATE OR REPLACE FUNCTION public.update_task_type_learning()
RETURNS TRIGGER AS $$
DECLARE
  v_estimated INTEGER;
  v_actual INTEGER;
  v_task_type TEXT;
BEGIN
  -- רק אם המשימה הושלמה (עברה מ-false ל-true)
  IF NEW.is_completed = true AND (OLD.is_completed = false OR OLD.is_completed IS NULL) THEN
    v_estimated := COALESCE(NEW.estimated_duration, 0);
    v_actual := COALESCE(NEW.time_spent, 0);
    v_task_type := COALESCE(NEW.task_type, 'other');
    
    -- רק אם יש נתונים אמיתיים
    IF v_estimated > 0 AND v_actual > 0 THEN
      -- עדכון או יצירה של רשומת למידה
      INSERT INTO public.task_type_learning (
        user_id, task_type, total_tasks, total_estimated_minutes, total_actual_minutes, average_ratio
      )
      VALUES (
        NEW.user_id, 
        v_task_type, 
        1, 
        v_estimated, 
        v_actual,
        v_actual::DECIMAL / v_estimated::DECIMAL
      )
      ON CONFLICT (user_id, task_type) DO UPDATE SET
        total_tasks = task_type_learning.total_tasks + 1,
        total_estimated_minutes = task_type_learning.total_estimated_minutes + v_estimated,
        total_actual_minutes = task_type_learning.total_actual_minutes + v_actual,
        average_ratio = (task_type_learning.total_actual_minutes + v_actual)::DECIMAL / 
                       (task_type_learning.total_estimated_minutes + v_estimated)::DECIMAL,
        updated_at = NOW();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- טריגר לעדכון למידה בהשלמת משימה
DROP TRIGGER IF EXISTS on_task_completed_update_learning ON public.tasks;
CREATE TRIGGER on_task_completed_update_learning
  AFTER UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_task_type_learning();

-- ==============================================
-- הערות
-- ==============================================
-- מערכת הלמידה עובדת כך:
-- 1. כשמשימה מושלמת, מחשבים את היחס בין הזמן בפועל להערכה
-- 2. שומרים את הסטטיסטיקות המצטברות לפי סוג משימה
-- 3. average_ratio משמש להצעת זמן משוער בפעם הבאה
-- 4. אם ratio > 1 = המשתמש מעריך פחות מדי
-- 5. אם ratio < 1 = המשתמש מעריך יותר מדי

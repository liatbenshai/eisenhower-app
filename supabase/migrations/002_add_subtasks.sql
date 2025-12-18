-- ==============================================
-- הוספת תמיכה במשימות עם שלבים (Subtasks)
-- ==============================================

-- הוספת שדות חדשים לטבלת tasks
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS is_project BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS estimated_duration INTEGER, -- זמן משוער בדקות
ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE;

-- אינדקסים חדשים
CREATE INDEX IF NOT EXISTS idx_tasks_is_project ON public.tasks(is_project);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON public.tasks(parent_task_id);

-- ==============================================
-- טבלת שלבים (Subtasks)
-- ==============================================
CREATE TABLE IF NOT EXISTS public.subtasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  due_date DATE,
  due_time TIME,
  estimated_duration INTEGER, -- זמן משוער בדקות
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- אינדקסים
CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON public.subtasks(task_id);
CREATE INDEX IF NOT EXISTS idx_subtasks_due_date ON public.subtasks(due_date);
CREATE INDEX IF NOT EXISTS idx_subtasks_is_completed ON public.subtasks(is_completed);
CREATE INDEX IF NOT EXISTS idx_subtasks_order_index ON public.subtasks(order_index);

-- טריגר לעדכון updated_at
DROP TRIGGER IF EXISTS update_subtasks_updated_at ON public.subtasks;
CREATE TRIGGER update_subtasks_updated_at
  BEFORE UPDATE ON public.subtasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ==============================================
-- Row Level Security (RLS) - Subtasks
-- ==============================================
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;

-- משתמש רואה רק שלבים של המשימות שלו
CREATE POLICY "subtasks_select_own" ON public.subtasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tasks 
      WHERE tasks.id = subtasks.task_id AND tasks.user_id = auth.uid()
    )
  );

-- משתמש יכול להוסיף שלבים רק למשימות שלו
CREATE POLICY "subtasks_insert_own" ON public.subtasks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks 
      WHERE tasks.id = subtasks.task_id AND tasks.user_id = auth.uid()
    )
  );

-- משתמש יכול לעדכן רק שלבים של המשימות שלו
CREATE POLICY "subtasks_update_own" ON public.subtasks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.tasks 
      WHERE tasks.id = subtasks.task_id AND tasks.user_id = auth.uid()
    )
  );

-- משתמש יכול למחוק רק שלבים של המשימות שלו
CREATE POLICY "subtasks_delete_own" ON public.subtasks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.tasks 
      WHERE tasks.id = subtasks.task_id AND tasks.user_id = auth.uid()
    )
  );

-- מנהל יכול לראות את כל השלבים
CREATE POLICY "admin_select_all_subtasks" ON public.subtasks
  FOR SELECT USING (public.is_admin());


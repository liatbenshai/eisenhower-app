-- ==============================================
-- תבניות משימות - שמירה ויצירה מהירה של משימות חוזרות
-- ==============================================

-- טבלת תבניות משימות
CREATE TABLE IF NOT EXISTS public.task_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  quadrant INTEGER NOT NULL CHECK (quadrant BETWEEN 1 AND 4),
  due_time TIME,
  reminder_minutes INTEGER,
  estimated_duration INTEGER,
  is_project BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- אינדקסים
CREATE INDEX IF NOT EXISTS idx_task_templates_user_id ON public.task_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_task_templates_quadrant ON public.task_templates(quadrant);

-- טריגר לעדכון updated_at
DROP TRIGGER IF EXISTS update_task_templates_updated_at ON public.task_templates;
CREATE TRIGGER update_task_templates_updated_at
  BEFORE UPDATE ON public.task_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- הפעלת RLS
ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;

-- מדיניות RLS - תבניות משימות
-- משתמש רואה רק את התבניות שלו
CREATE POLICY "task_templates_select_own" ON public.task_templates
  FOR SELECT USING (auth.uid() = user_id);

-- משתמש יכול להוסיף תבניות רק לעצמו
CREATE POLICY "task_templates_insert_own" ON public.task_templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- משתמש יכול לעדכן רק את התבניות שלו
CREATE POLICY "task_templates_update_own" ON public.task_templates
  FOR UPDATE USING (auth.uid() = user_id);

-- משתמש יכול למחוק רק את התבניות שלו
CREATE POLICY "task_templates_delete_own" ON public.task_templates
  FOR DELETE USING (auth.uid() = user_id);


-- ==============================================
-- בלוקים של זמן - תכנון זמן לעבודה על משימות
-- ==============================================

-- טבלת בלוקי זמן
CREATE TABLE IF NOT EXISTS public.time_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  actual_start_time TIMESTAMPTZ,
  actual_end_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT time_blocks_end_after_start CHECK (end_time > start_time)
);

-- אינדקסים
CREATE INDEX IF NOT EXISTS idx_time_blocks_user_id ON public.time_blocks(user_id);
CREATE INDEX IF NOT EXISTS idx_time_blocks_task_id ON public.time_blocks(task_id);
CREATE INDEX IF NOT EXISTS idx_time_blocks_start_time ON public.time_blocks(start_time);

-- טריגר לעדכון updated_at
DROP TRIGGER IF EXISTS update_time_blocks_updated_at ON public.time_blocks;
CREATE TRIGGER update_time_blocks_updated_at
  BEFORE UPDATE ON public.time_blocks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- הפעלת RLS
ALTER TABLE public.time_blocks ENABLE ROW LEVEL SECURITY;

-- מדיניות RLS - בלוקי זמן
-- משתמש רואה רק את הבלוקים שלו
CREATE POLICY "time_blocks_select_own" ON public.time_blocks
  FOR SELECT USING (auth.uid() = user_id);

-- משתמש יכול להוסיף בלוקים רק לעצמו
CREATE POLICY "time_blocks_insert_own" ON public.time_blocks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- משתמש יכול לעדכן רק את הבלוקים שלו
CREATE POLICY "time_blocks_update_own" ON public.time_blocks
  FOR UPDATE USING (auth.uid() = user_id);

-- משתמש יכול למחוק רק את הבלוקים שלו
CREATE POLICY "time_blocks_delete_own" ON public.time_blocks
  FOR DELETE USING (auth.uid() = user_id);


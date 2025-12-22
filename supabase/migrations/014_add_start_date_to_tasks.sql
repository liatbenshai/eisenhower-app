-- ==============================================
-- הוספת תאריך התחלה למשימות
-- ==============================================

-- הוספת שדה start_date לטבלת tasks
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS start_date DATE;

-- הוספת שדה start_date גם לטבלת subtasks
ALTER TABLE public.subtasks 
ADD COLUMN IF NOT EXISTS start_date DATE;

-- אינדקסים לשאילתות מהירות
CREATE INDEX IF NOT EXISTS idx_tasks_start_date ON public.tasks(start_date);
CREATE INDEX IF NOT EXISTS idx_subtasks_start_date ON public.subtasks(start_date);

-- הודעת הצלחה
DO $$
BEGIN
  RAISE NOTICE '✅ העמודות start_date נוספו לטבלאות tasks ו-subtasks';
END $$;


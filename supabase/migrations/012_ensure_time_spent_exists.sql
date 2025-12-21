-- ==============================================
-- וידוא שהעמודה time_spent קיימת
-- ==============================================

-- הוספת העמודה time_spent אם היא לא קיימת
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS time_spent INTEGER DEFAULT 0;

-- וידוא שהאינדקס קיים
CREATE INDEX IF NOT EXISTS idx_tasks_time_spent ON public.tasks(time_spent);

-- הודעת הצלחה
DO $$
BEGIN
  RAISE NOTICE '✅ העמודה time_spent קיימת בטבלה tasks';
END $$;


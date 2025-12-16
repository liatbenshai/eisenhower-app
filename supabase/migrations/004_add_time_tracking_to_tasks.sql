-- ==============================================
-- הוספת מעקב זמן למשימות רגילות
-- ==============================================

-- הוספת שדה time_spent (זמן שבוצע) ל-tasks
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS time_spent INTEGER DEFAULT 0; -- זמן שבוצע בדקות

-- אינדקס לשאילתות מהירות
CREATE INDEX IF NOT EXISTS idx_tasks_time_spent ON public.tasks(time_spent);


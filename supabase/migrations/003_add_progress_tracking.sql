-- ==============================================
-- הוספת מעקב התקדמות לשלבים
-- ==============================================

-- הוספת שדה time_spent (זמן שבוצע) ל-subtasks
ALTER TABLE public.subtasks 
ADD COLUMN IF NOT EXISTS time_spent INTEGER DEFAULT 0; -- זמן שבוצע בדקות

-- אינדקס לשאילתות מהירות
CREATE INDEX IF NOT EXISTS idx_subtasks_time_spent ON public.subtasks(time_spent);

-- ==============================================
-- פונקציה לחישוב אחוז התקדמות
-- ==============================================
CREATE OR REPLACE FUNCTION public.calculate_subtask_progress(
  p_time_spent INTEGER,
  p_estimated_duration INTEGER
)
RETURNS INTEGER AS $$
BEGIN
  IF p_estimated_duration IS NULL OR p_estimated_duration = 0 THEN
    RETURN 0;
  END IF;
  
  RETURN LEAST(100, ROUND((p_time_spent::NUMERIC / p_estimated_duration::NUMERIC) * 100));
END;
$$ LANGUAGE plpgsql IMMUTABLE;


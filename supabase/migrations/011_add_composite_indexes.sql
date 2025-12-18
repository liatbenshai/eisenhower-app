-- ==============================================
-- אינדקסים משולבים לשיפור ביצועים
-- ==============================================

-- אינדקס משולב למשימות לפי משתמש ורבע
-- משפר ביצועים כשמסננים משימות לפי משתמש ורבע
CREATE INDEX IF NOT EXISTS idx_tasks_user_quadrant 
  ON public.tasks(user_id, quadrant);

-- אינדקס משולב למשימות לפי משתמש וסטטוס השלמה
-- משפר ביצועים כשמסננים משימות פעילות/הושלמו
CREATE INDEX IF NOT EXISTS idx_tasks_user_completed 
  ON public.tasks(user_id, is_completed);

-- אינדקס משולב להיסטוריית השלמה לפי משתמש וסוג משימה
-- משפר ביצועים כשמחפשים היסטוריה לפי סוג משימה
CREATE INDEX IF NOT EXISTS idx_completion_history_user_type 
  ON public.task_completion_history(user_id, task_type);

-- הודעת הצלחה
DO $$
BEGIN
  RAISE NOTICE '✅ אינדקסים משולבים נוצרו בהצלחה!';
END $$;


-- ==============================================
-- תיקון: וידוא ש-time_spent מתעדכן נכון
-- ==============================================

-- וידוא שהשדה time_spent קיים
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS time_spent INTEGER DEFAULT 0;

-- וידוא שהאינדקס קיים
CREATE INDEX IF NOT EXISTS idx_tasks_time_spent ON public.tasks(time_spent);

-- וידוא שה-RLS policy לעדכון משימות מאפשר עדכון של time_spent
-- נבדוק אם ה-policy קיים ואם לא, ניצור אותו מחדש
DROP POLICY IF EXISTS "tasks_update_own" ON public.tasks;

-- יצירת policy חדש שמאפשר עדכון של כל השדות כולל time_spent
-- ה-policy הזה מאפשר עדכון של כל השדות במשימה, כולל time_spent
-- כל עוד המשתמש הוא הבעלים של המשימה (auth.uid() = user_id)
CREATE POLICY "tasks_update_own" ON public.tasks
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- וידוא שהטריגר לעדכון updated_at עובד
DROP TRIGGER IF EXISTS update_tasks_updated_at ON public.tasks;
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at();

-- וידוא שהטריגר לעדכון סטטיסטיקות לא מונע עדכון של time_spent
-- הטריגר הזה צריך לרוץ רק כשמשימה הושלמה, לא בכל עדכון של time_spent
-- אבל הוא לא אמור למנוע עדכון של time_spent

-- הודעת הצלחה
DO $$
BEGIN
  RAISE NOTICE '✅ תיקון time_spent הושלם - ה-policy מאפשר עדכון של time_spent';
END $$;


-- ==============================================
-- תיקון Migration 007 - הרצה חוזרת בטוחה
-- ==============================================
-- קובץ זה מאפשר להריץ שוב את ה-policies בלי שגיאות

-- מחיקת policies ישנות אם קיימות
DROP POLICY IF EXISTS "users_select_own_stats" ON public.task_type_stats;
DROP POLICY IF EXISTS "users_insert_own_stats" ON public.task_type_stats;
DROP POLICY IF EXISTS "users_update_own_stats" ON public.task_type_stats;
DROP POLICY IF EXISTS "users_select_own_history" ON public.task_completion_history;
DROP POLICY IF EXISTS "users_insert_own_history" ON public.task_completion_history;
DROP POLICY IF EXISTS "admin_select_all_stats" ON public.task_type_stats;
DROP POLICY IF EXISTS "admin_select_all_history" ON public.task_completion_history;

-- יצירת policies מחדש
-- משתמש רואה רק את ההגדרות שלו
CREATE POLICY "users_select_own_stats" ON public.task_type_stats
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_stats" ON public.task_type_stats
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_stats" ON public.task_type_stats
  FOR UPDATE USING (auth.uid() = user_id);

-- מדיניות RLS - היסטוריה
CREATE POLICY "users_select_own_history" ON public.task_completion_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_history" ON public.task_completion_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- מנהל יכול לראות הכל
CREATE POLICY "admin_select_all_stats" ON public.task_type_stats
  FOR SELECT USING (public.is_admin());

CREATE POLICY "admin_select_all_history" ON public.task_completion_history
  FOR SELECT USING (public.is_admin());

-- הודעת הצלחה
DO $$
BEGIN
  RAISE NOTICE '✅ Policies עודכנו בהצלחה!';
END $$;


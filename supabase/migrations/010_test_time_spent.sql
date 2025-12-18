-- ==============================================
-- בדיקה: וידוא ש-time_spent עובד נכון
-- ==============================================
-- קובץ זה בודק שהכל תקין - אפשר להריץ אותו לבדיקה

-- בדיקה שהטבלה קיימת
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tasks') THEN
    RAISE EXCEPTION '❌ הטבלה tasks לא קיימת!';
  ELSE
    RAISE NOTICE '✅ הטבלה tasks קיימת';
  END IF;
END $$;

-- בדיקה שהשדה time_spent קיים
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tasks' 
    AND column_name = 'time_spent'
  ) THEN
    RAISE EXCEPTION '❌ השדה time_spent לא קיים!';
  ELSE
    RAISE NOTICE '✅ השדה time_spent קיים';
  END IF;
END $$;

-- בדיקה שה-policy לעדכון קיים
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'tasks' 
    AND policyname = 'tasks_update_own'
  ) THEN
    RAISE EXCEPTION '❌ ה-policy tasks_update_own לא קיים!';
  ELSE
    RAISE NOTICE '✅ ה-policy tasks_update_own קיים';
  END IF;
END $$;

-- בדיקה שה-RLS מופעל
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'tasks' 
    AND rowsecurity = true
  ) THEN
    RAISE WARNING '⚠️ RLS לא מופעל על הטבלה tasks!';
  ELSE
    RAISE NOTICE '✅ RLS מופעל על הטבלה tasks';
  END IF;
END $$;

-- הודעת הצלחה
DO $$
BEGIN
  RAISE NOTICE '✅ כל הבדיקות עברו בהצלחה! time_spent אמור לעבוד נכון.';
END $$;


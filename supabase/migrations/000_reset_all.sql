-- ==============================================
-- ⚠️ אזהרה: קובץ זה מוחק את כל הטבלאות והנתונים!
-- ==============================================
-- הרץ את זה רק אם אתה רוצה להתחיל מחדש מאפס!
-- כל הנתונים יימחקו!

-- מחיקת כל הטבלאות בסדר הנכון (למניעת שגיאות foreign key)
DROP TABLE IF EXISTS public.task_completion_history CASCADE;
DROP TABLE IF EXISTS public.task_type_stats CASCADE;
DROP TABLE IF EXISTS public.time_correction_rules CASCADE;
DROP TABLE IF EXISTS public.time_blocks CASCADE;
DROP TABLE IF EXISTS public.task_templates CASCADE;
DROP TABLE IF EXISTS public.subtasks CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.notification_settings CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- מחיקת פונקציות
DROP FUNCTION IF EXISTS public.update_task_type_stats() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.calculate_project_progress(INTEGER, INTEGER) CASCADE;

-- מחיקת טריגרים
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_task_type_stats_trigger ON public.tasks;
DROP TRIGGER IF EXISTS update_tasks_updated_at ON public.tasks;
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
DROP TRIGGER IF EXISTS update_notification_settings_updated_at ON public.notification_settings;
DROP TRIGGER IF EXISTS update_time_blocks_updated_at ON public.time_blocks;

-- הודעת הצלחה
DO $$
BEGIN
  RAISE NOTICE '✅ כל הטבלאות נמחקו! עכשיו הרץ את כל ה-migrations מההתחלה (001, 002, 003...)';
END $$;


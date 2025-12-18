-- ==============================================
-- מטריצת אייזנהאואר - סכמת מסד נתונים ראשונית
-- ==============================================

-- הפעלת UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================
-- טבלת משתמשים
-- ==============================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'super_admin')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- אינדקסים
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON public.users(is_active);

-- ==============================================
-- טבלת משימות
-- ==============================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  quadrant INTEGER NOT NULL CHECK (quadrant BETWEEN 1 AND 4),
  due_date DATE,
  due_time TIME,
  reminder_minutes INTEGER,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- אינדקסים
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_quadrant ON public.tasks(quadrant);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_is_completed ON public.tasks(is_completed);

-- ==============================================
-- טבלת הגדרות התראות
-- ==============================================
CREATE TABLE IF NOT EXISTS public.notification_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  push_enabled BOOLEAN DEFAULT false,
  email_enabled BOOLEAN DEFAULT false,
  reminder_minutes INTEGER DEFAULT 15,
  daily_summary_enabled BOOLEAN DEFAULT false,
  daily_summary_time TIME DEFAULT '08:00',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- טריגר ליצירת משתמש בטבלת users אחרי הרשמה
-- ==============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- טריגר
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================
-- טריגר לעדכון updated_at
-- ==============================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- טריגרים לעדכון
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_tasks_updated_at ON public.tasks;
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_notification_settings_updated_at ON public.notification_settings;
CREATE TRIGGER update_notification_settings_updated_at
  BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ==============================================
-- Row Level Security (RLS)
-- ==============================================

-- הפעלת RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- מדיניות RLS - משתמשים
-- ==============================================

-- משתמש רואה רק את עצמו
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id);

-- משתמש יכול לעדכן רק את עצמו
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- מנהל יכול לראות את כל המשתמשים
CREATE POLICY "admin_select_all_users" ON public.users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- מנהל יכול לעדכן את כל המשתמשים
CREATE POLICY "admin_update_all_users" ON public.users
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- מנהל יכול למחוק משתמשים
CREATE POLICY "admin_delete_users" ON public.users
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- ==============================================
-- מדיניות RLS - משימות
-- ==============================================

-- משתמש רואה רק את המשימות שלו
CREATE POLICY "tasks_select_own" ON public.tasks
  FOR SELECT USING (auth.uid() = user_id);

-- משתמש יכול להוסיף משימות רק לעצמו
CREATE POLICY "tasks_insert_own" ON public.tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- משתמש יכול לעדכן רק את המשימות שלו
CREATE POLICY "tasks_update_own" ON public.tasks
  FOR UPDATE USING (auth.uid() = user_id);

-- משתמש יכול למחוק רק את המשימות שלו
CREATE POLICY "tasks_delete_own" ON public.tasks
  FOR DELETE USING (auth.uid() = user_id);

-- מנהל יכול לראות את כל המשימות (לסטטיסטיקות)
CREATE POLICY "admin_select_all_tasks" ON public.tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- ==============================================
-- מדיניות RLS - הגדרות התראות
-- ==============================================

-- משתמש רואה רק את ההגדרות שלו
CREATE POLICY "notification_settings_select_own" ON public.notification_settings
  FOR SELECT USING (auth.uid() = user_id);

-- משתמש יכול להוסיף הגדרות רק לעצמו
CREATE POLICY "notification_settings_insert_own" ON public.notification_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- משתמש יכול לעדכן רק את ההגדרות שלו
CREATE POLICY "notification_settings_update_own" ON public.notification_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- משתמש יכול למחוק רק את ההגדרות שלו
CREATE POLICY "notification_settings_delete_own" ON public.notification_settings
  FOR DELETE USING (auth.uid() = user_id);

-- ==============================================
-- יצירת מנהל ראשוני (אופציונלי)
-- ==============================================
-- שנה את האימייל לאימייל המנהל הרצוי לאחר ההרשמה הראשונה
-- UPDATE public.users SET role = 'super_admin' WHERE email = 'admin@example.com';

-- ==============================================
-- הערות
-- ==============================================
-- 1. יש להריץ סקריפט זה ב-SQL Editor של Supabase
-- 2. לאחר ההרשמה הראשונה, עדכן את המשתמש הרצוי למנהל
-- 3. וודא ש-RLS מופעל בכל הטבלאות


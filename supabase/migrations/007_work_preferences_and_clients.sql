-- ============================================
-- מיגרציה: תכונות חדשות לניהול זמן
-- ============================================

-- טבלת העדפות עבודה
CREATE TABLE IF NOT EXISTS user_work_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  buffer_minutes INTEGER DEFAULT 15,
  work_start_hour INTEGER DEFAULT 8,
  work_end_hour INTEGER DEFAULT 16,
  high_energy_start INTEGER DEFAULT 8,
  high_energy_end INTEGER DEFAULT 11,
  max_block_size INTEGER DEFAULT 60,
  preferred_block_size INTEGER DEFAULT 45,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- טבלת לקוחות
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  hourly_rate DECIMAL(10, 2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- אינדקסים
CREATE INDEX IF NOT EXISTS idx_user_work_preferences_user_id ON user_work_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(user_id, name);

-- הוספת עמודות למשימות (אם לא קיימות)
DO $$ 
BEGIN
  -- עמודה לסימון שהמשימה נדחתה
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'was_delayed'
  ) THEN
    ALTER TABLE tasks ADD COLUMN was_delayed BOOLEAN DEFAULT FALSE;
  END IF;

  -- עמודה לסימון שצריך שיבוץ
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'needs_scheduling'
  ) THEN
    ALTER TABLE tasks ADD COLUMN needs_scheduling BOOLEAN DEFAULT FALSE;
  END IF;

  -- עמודה לשיוך ללקוח
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE tasks ADD COLUMN client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
  END IF;

  -- עמודה לעדיפות
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'priority'
  ) THEN
    ALTER TABLE tasks ADD COLUMN priority VARCHAR(20) DEFAULT 'normal';
  END IF;

  -- עמודה לקישור לעבודה מקורית
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'parent_job'
  ) THEN
    ALTER TABLE tasks ADD COLUMN parent_job VARCHAR(255);
  END IF;
END $$;

-- RLS policies
ALTER TABLE user_work_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- מדיניות גישה להעדפות
DROP POLICY IF EXISTS "Users can view own preferences" ON user_work_preferences;
CREATE POLICY "Users can view own preferences" ON user_work_preferences
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own preferences" ON user_work_preferences;
CREATE POLICY "Users can insert own preferences" ON user_work_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own preferences" ON user_work_preferences;
CREATE POLICY "Users can update own preferences" ON user_work_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- מדיניות גישה ללקוחות
DROP POLICY IF EXISTS "Users can view own clients" ON clients;
CREATE POLICY "Users can view own clients" ON clients
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own clients" ON clients;
CREATE POLICY "Users can insert own clients" ON clients
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own clients" ON clients;
CREATE POLICY "Users can update own clients" ON clients
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own clients" ON clients;
CREATE POLICY "Users can delete own clients" ON clients
  FOR DELETE USING (auth.uid() = user_id);

-- הודעת סיום
DO $$ BEGIN RAISE NOTICE 'Migration completed successfully!'; END $$;

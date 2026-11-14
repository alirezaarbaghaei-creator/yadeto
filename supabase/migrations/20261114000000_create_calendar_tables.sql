-- ============================================================
--  Smart Calendar (تقویم هوشمند) — calendar tables + RLS
--  Run in Supabase SQL editor (or as a new migration).
-- ============================================================

-- Calendar tasks
CREATE TABLE IF NOT EXISTS calendar_tasks (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    title TEXT DEFAULT '',
    description TEXT,
    due_date DATE NOT NULL,
    due_time TIME,
    duration INT DEFAULT 60,
    priority TEXT DEFAULT 'medium',
    category TEXT DEFAULT 'other',
    status TEXT DEFAULT 'pending',
    recurrence TEXT DEFAULT 'none',
    day_of_month INT,
    month_of_year INT,
    reminder INT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cal_tasks_user ON calendar_tasks (user_id);
CREATE INDEX IF NOT EXISTS idx_cal_tasks_due ON calendar_tasks (due_date);

-- Calendar events
CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    title TEXT DEFAULT '',
    description TEXT,
    event_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME,
    location TEXT,
    category TEXT DEFAULT 'work',
    color TEXT DEFAULT '#4f46e5',
    reminder INT,
    recurrence TEXT DEFAULT 'none',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cal_events_user ON calendar_events (user_id);
CREATE INDEX IF NOT EXISTS idx_cal_events_date ON calendar_events (event_date);

-- Calendar preferences (one row per user)
CREATE TABLE IF NOT EXISTS calendar_preferences (
    user_id UUID PRIMARY KEY,
    dark_mode BOOLEAN DEFAULT FALSE,
    persian_numbers BOOLEAN DEFAULT TRUE,
    work_start TEXT DEFAULT '08:00',
    work_end TEXT DEFAULT '20:00',
    work_days JSONB DEFAULT '[0,1,2,3,4]',
    default_reminder INT DEFAULT 15,
    notifications_enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: users can only touch their own calendar data
ALTER TABLE calendar_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users own calendar_tasks" ON calendar_tasks;
CREATE POLICY "users own calendar_tasks" ON calendar_tasks
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users own calendar_events" ON calendar_events;
CREATE POLICY "users own calendar_events" ON calendar_events
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users own calendar_preferences" ON calendar_preferences;
CREATE POLICY "users own calendar_preferences" ON calendar_preferences
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Drop legacy letter tables if present (smart calendar no longer uses them)
DROP TABLE IF EXISTS template_ratings CASCADE;
DROP TABLE IF EXISTS generated_letters CASCADE;
DROP TABLE IF EXISTS templates CASCADE;
DROP TABLE IF EXISTS drafts CASCADE;
DROP TABLE IF EXISTS discovery_usage CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

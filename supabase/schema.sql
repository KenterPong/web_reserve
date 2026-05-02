-- =============================================
-- AI 預約平台 - Supabase Schema（Route A）
-- 在 Supabase Dashboard > SQL Editor 執行此檔案
-- 路線 A：不使用 RLS，所有存取走 API + service role key
-- =============================================

-- =============================================
-- 工作者資料表
-- =============================================
CREATE TABLE workers (
  id                       UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  line_user_id             TEXT UNIQUE NOT NULL,
  display_name             TEXT NOT NULL,
  avatar_url               TEXT,
  contact_phone            TEXT,
  booking_confirmation_message TEXT,
  slug                     TEXT UNIQUE,
  business_name            TEXT,
  bio                      TEXT,
  bio_answers              JSONB,
  working_hours            JSONB NOT NULL DEFAULT '{
    "mon": {"start":"10:00","end":"20:00","closed":false},
    "tue": {"start":"10:00","end":"20:00","closed":false},
    "wed": {"start":"10:00","end":"20:00","closed":false},
    "thu": {"start":"10:00","end":"20:00","closed":false},
    "fri": {"start":"10:00","end":"20:00","closed":false},
    "sat": {"start":"10:00","end":"18:00","closed":false},
    "sun": {"start":"00:00","end":"00:00","closed":true}
  }'::jsonb,
  working_hours_exceptions JSONB NOT NULL DEFAULT '{}'::jsonb,
  slot_duration            INTEGER NOT NULL DEFAULT 60,
  referral_count           INTEGER NOT NULL DEFAULT 0,
  referred_by              UUID REFERENCES workers(id),
  subscription_status      TEXT NOT NULL DEFAULT 'inactive'
                           CHECK (subscription_status IN ('active', 'inactive')),
  is_active                BOOLEAN NOT NULL DEFAULT true,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- 預約資料表
-- =============================================
CREATE TABLE appointments (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id            UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  customer_name        TEXT NOT NULL,
  customer_phone       TEXT NOT NULL,
  party_size           INTEGER NOT NULL DEFAULT 1,
  service_item         TEXT NOT NULL DEFAULT '',
  appointment_date     DATE NOT NULL,
  appointment_time     TIME NOT NULL,
  duration             INTEGER NOT NULL DEFAULT 60,
  reference_image_url  TEXT,
  note                 TEXT,
  status               TEXT NOT NULL DEFAULT 'confirmed'
                       CHECK (status IN ('confirmed', 'cancelled', 'completed', 'no_show')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 防 double booking：同一工作者同一時段只能有一筆預約
  CONSTRAINT unique_worker_slot UNIQUE (worker_id, appointment_date, appointment_time)
);

-- 若你的資料庫已經建立過 appointments 表，可用以下 ALTER 補欄位：
-- ALTER TABLE appointments ADD COLUMN IF NOT EXISTS party_size INTEGER NOT NULL DEFAULT 1;
-- ALTER TABLE appointments ADD COLUMN IF NOT EXISTS service_item TEXT NOT NULL DEFAULT '';
-- ALTER TABLE workers ADD COLUMN IF NOT EXISTS contact_phone TEXT;
-- ALTER TABLE workers ADD COLUMN IF NOT EXISTS booking_confirmation_message TEXT;

-- =============================================
-- 對話紀錄資料表
-- =============================================
CREATE TABLE chat_sessions (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id      UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  session_token  TEXT UNIQUE NOT NULL,
  messages       JSONB NOT NULL DEFAULT '[]'::jsonb,
  status         TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'completed', 'abandoned')),
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- 索引
-- =============================================
CREATE INDEX idx_workers_slug ON workers(slug);
CREATE INDEX idx_appointments_worker_date ON appointments(worker_id, appointment_date);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_chat_sessions_token ON chat_sessions(session_token);
CREATE INDEX idx_chat_sessions_expires ON chat_sessions(expires_at);

-- =============================================
-- 黑名單（推薦滿 5 人解鎖；API 寫入／預約阻擋）
-- =============================================
CREATE TABLE blacklist (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id  UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  phone      TEXT NOT NULL,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_worker_blacklist_phone UNIQUE (worker_id, phone)
);

CREATE INDEX idx_blacklist_worker ON blacklist(worker_id);

-- 與 workers / appointments 相同策略：RLS 開啟但無 policy；實際存取僅 service role（繞過 RLS）+ REVOKE anon/authenticated。
ALTER TABLE blacklist ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 封鎖時段（推薦滿 15 人解鎖；單日部分時段不接預約）
-- =============================================
CREATE TABLE blocked_slots (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id    UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  blocked_date DATE NOT NULL,
  start_time   TIME NOT NULL,
  end_time     TIME NOT NULL,
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT blocked_slots_time_order CHECK (start_time < end_time)
);

CREATE INDEX idx_blocked_slots_worker_date ON blocked_slots(worker_id, blocked_date);

ALTER TABLE blocked_slots ENABLE ROW LEVEL SECURITY;

-- =============================================
-- updated_at 自動更新 trigger
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workers_updated_at
  BEFORE UPDATE ON workers FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER appointments_updated_at
  BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER chat_sessions_updated_at
  BEFORE UPDATE ON chat_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- 路線 A：確認 RLS 為關閉狀態（Supabase 預設即關閉）
-- 若之前曾啟用，執行以下指令關閉：
-- ALTER TABLE workers DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE appointments DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE chat_sessions DISABLE ROW LEVEL SECURITY;
-- =============================================

-- =============================================
-- 撤銷 anon / authenticated 對資料表的直接存取權限
-- 確保任何人都無法繞過 API 直接用 anon key 讀寫資料
-- 執行後驗證：用 anon key 直接查詢 workers 應回傳 permission denied
-- =============================================
REVOKE ALL ON TABLE workers       FROM anon, authenticated;
REVOKE ALL ON TABLE appointments  FROM anon, authenticated;
REVOKE ALL ON TABLE chat_sessions FROM anon, authenticated;
REVOKE ALL ON TABLE blacklist FROM anon, authenticated;
REVOKE ALL ON TABLE blocked_slots FROM anon, authenticated;

GRANT ALL ON TABLE public.blacklist TO service_role;
GRANT ALL ON TABLE public.blacklist TO postgres;
GRANT ALL ON TABLE public.blocked_slots TO service_role;
GRANT ALL ON TABLE public.blocked_slots TO postgres;

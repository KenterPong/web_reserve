-- 黑名單：已存在資料庫時單獨執行此檔即可（Supabase SQL Editor）
CREATE TABLE IF NOT EXISTS blacklist (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id  UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  phone      TEXT NOT NULL,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_worker_blacklist_phone UNIQUE (worker_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_blacklist_worker ON blacklist(worker_id);

-- 開啟 RLS 可消除 Supabase「新表未啟用 RLS」警告；本專案僅 service role 經 API 存取（會繞過 RLS），不必新增 policy。
ALTER TABLE blacklist ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE blacklist FROM anon, authenticated;

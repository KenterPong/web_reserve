-- 若專案早期建表時尚無推薦欄位，在 Supabase SQL Editor 執行此檔（可重複執行）
ALTER TABLE workers ADD COLUMN IF NOT EXISTS referral_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES workers(id);

COMMENT ON COLUMN workers.referral_count IS '被推薦成功註冊人數（由推薦連結首次登入累加）';
COMMENT ON COLUMN workers.referred_by IS '推薦人 workers.id，僅首次登入寫入一次';

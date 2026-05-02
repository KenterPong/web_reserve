-- 參考圖：appointments 儲存 Storage 物件路徑（若舊庫無此欄請執行）
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS reference_image_url TEXT;

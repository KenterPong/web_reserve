-- 預約完成提醒文字（顧客端顯示）；可重複執行
ALTER TABLE workers ADD COLUMN IF NOT EXISTS booking_confirmation_message TEXT;

COMMENT ON COLUMN workers.booking_confirmation_message IS '顧客送出預約後顯示的提醒文字；未設定時前端使用平台預設文案';

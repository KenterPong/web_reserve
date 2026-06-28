-- Onboarding 完成旗標（可重複執行）
ALTER TABLE workers
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;

-- 已有 slug 的既有工作者視為已完成 onboarding
UPDATE workers
SET onboarding_completed = true
WHERE slug IS NOT NULL
  AND TRIM(slug) <> ''
  AND onboarding_completed = false;

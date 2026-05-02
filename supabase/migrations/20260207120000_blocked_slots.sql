-- 封鎖時段：單日內特定時段禁止預約（推薦滿 15 人解鎖）
CREATE TABLE IF NOT EXISTS public.blocked_slots (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id    UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  blocked_date DATE NOT NULL,
  start_time   TIME NOT NULL,
  end_time     TIME NOT NULL,
  note         TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT blocked_slots_time_order CHECK (start_time < end_time)
);

CREATE INDEX IF NOT EXISTS idx_blocked_slots_worker_date
  ON public.blocked_slots (worker_id, blocked_date);

COMMENT ON TABLE public.blocked_slots IS '工作者自訂：某日特定時段不可被預約';

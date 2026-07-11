-- Onboarding 漏斗埋點：記錄各步驟達成與中途離開
CREATE TABLE IF NOT EXISTS public.onboarding_events (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id    TEXT NOT NULL,
  step          TEXT NOT NULL,
  line_user_id  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_events_session ON public.onboarding_events(session_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_events_step ON public.onboarding_events(step);

COMMENT ON TABLE public.onboarding_events IS 'Onboarding 漏斗各步驟事件（由 API 寫入）';

ALTER TABLE public.onboarding_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.onboarding_events FROM anon, authenticated;
GRANT ALL ON TABLE public.onboarding_events TO service_role;
GRANT ALL ON TABLE public.onboarding_events TO postgres;

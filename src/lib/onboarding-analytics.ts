export const ONBOARDING_STEPS = [
  'step1_viewed',
  'step2_bio_generated',
  'step3_slug_selected',
  'step4_completed',
] as const

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number]

const SESSION_STORAGE_KEY = 'onboarding_session_id'

export function getOrCreateOnboardingSessionId(): string {
  if (typeof window === 'undefined') return ''

  const existing = sessionStorage.getItem(SESSION_STORAGE_KEY)
  if (existing) return existing

  const sessionId = `onboarding_${Date.now()}_${crypto.randomUUID()}`
  sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId)
  return sessionId
}

export function trackOnboardingStep(
  step: OnboardingStep,
  options?: { lineUserId?: string | null },
): void {
  const sessionId = getOrCreateOnboardingSessionId()
  if (!sessionId) return

  const body: { session_id: string; step: OnboardingStep; line_user_id?: string } = {
    session_id: sessionId,
    step,
  }

  const lineUserId = options?.lineUserId?.trim()
  if (lineUserId) body.line_user_id = lineUserId

  void fetch('/api/onboarding-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => {
    // 埋點失敗不影響 onboarding 流程
  })
}

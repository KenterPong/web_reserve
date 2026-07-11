export const ONBOARDING_STEPS = [
  'step1_viewed',
  'step2_bio_generated',
  'step3_slug_selected',
  'step4_completed',
] as const

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number]

function sessionStorageKey(lineUserId: string): string {
  return `onboarding_session_${lineUserId}`
}

export function getOrCreateOnboardingSessionId(lineUserId: string): string {
  if (typeof window === 'undefined') return ''

  const key = sessionStorageKey(lineUserId)
  const existing = sessionStorage.getItem(key)
  if (existing) return existing

  const sessionId = `onboarding_${Date.now()}_${crypto.randomUUID()}`
  sessionStorage.setItem(key, sessionId)
  return sessionId
}

export function clearOnboardingSession(lineUserId: string): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(sessionStorageKey(lineUserId))
}

export function trackOnboardingStep(
  step: OnboardingStep,
  options: { lineUserId: string | null | undefined },
): void {
  const lineUserId = options.lineUserId?.trim()
  if (!lineUserId) return

  const sessionId = getOrCreateOnboardingSessionId(lineUserId)
  if (!sessionId) return

  void fetch('/api/onboarding-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      step,
      line_user_id: lineUserId,
    }),
  }).catch(() => {
    // 埋點失敗不影響 onboarding 流程
  })
}

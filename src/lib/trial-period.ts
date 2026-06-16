const DAY_MS = 24 * 60 * 60 * 1000

/** 免費試用天數（自 workers.created_at 起算） */
export const TRIAL_DAYS = 60

/** 試用到期後寬限天數，第 63 天起停用 */
export const TRIAL_GRACE_DAYS = 3

/** 試用到期前幾天顯示付款提醒 */
export const TRIAL_PAYMENT_REMINDER_DAYS = 3

export type TrialPhase = 'paid' | 'trial' | 'payment_reminder' | 'grace' | 'expired'

export interface TrialStatus {
  phase: TrialPhase
  trialEndsAt: string
  deactivateAt: string
  daysUntilTrialEnd: number
  daysUntilDeactivate: number
  showPaymentReminder: boolean
  shouldDeactivate: boolean
}

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * DAY_MS)
}

function ceilDaysUntil(from: Date, to: Date): number {
  const diff = to.getTime() - from.getTime()
  if (diff <= 0) return 0
  return Math.ceil(diff / DAY_MS)
}

export function getTrialStatus(
  createdAt: string | Date,
  subscriptionStatus: 'active' | 'inactive',
  isActive: boolean,
  now: Date = new Date(),
): TrialStatus {
  const created = new Date(createdAt)
  const trialEndsAt = addDays(created, TRIAL_DAYS)
  const deactivateAt = addDays(created, TRIAL_DAYS + TRIAL_GRACE_DAYS)

  if (subscriptionStatus === 'active') {
    return {
      phase: 'paid',
      trialEndsAt: trialEndsAt.toISOString(),
      deactivateAt: deactivateAt.toISOString(),
      daysUntilTrialEnd: 0,
      daysUntilDeactivate: 0,
      showPaymentReminder: false,
      shouldDeactivate: false,
    }
  }

  let phase: TrialPhase
  if (now >= deactivateAt) {
    phase = 'expired'
  } else if (now >= trialEndsAt) {
    phase = 'grace'
  } else if (now >= addDays(trialEndsAt, -TRIAL_PAYMENT_REMINDER_DAYS)) {
    phase = 'payment_reminder'
  } else {
    phase = 'trial'
  }

  return {
    phase,
    trialEndsAt: trialEndsAt.toISOString(),
    deactivateAt: deactivateAt.toISOString(),
    daysUntilTrialEnd: ceilDaysUntil(now, trialEndsAt),
    daysUntilDeactivate: ceilDaysUntil(now, deactivateAt),
    showPaymentReminder: phase === 'payment_reminder' || phase === 'grace',
    shouldDeactivate: now >= deactivateAt && isActive,
  }
}

/** Cron：是否應將此工作者標記為停用 */
export function shouldDeactivateWorker(
  createdAt: string | Date,
  subscriptionStatus: 'active' | 'inactive',
  isActive: boolean,
  now: Date = new Date(),
): boolean {
  if (!isActive || subscriptionStatus === 'active') return false
  return getTrialStatus(createdAt, subscriptionStatus, isActive, now).shouldDeactivate
}

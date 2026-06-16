'use client'

import { useEffect, useState } from 'react'
import { formatYmdLongZhTaipei } from '@/lib/datetime-taipei'
import type { TrialPhase } from '@/lib/trial-period'

type TrialPayload = {
  phase: TrialPhase
  trialEndsAt: string
  deactivateAt: string
  daysUntilTrialEnd: number
  daysUntilDeactivate: number
  showPaymentReminder: boolean
}

function trialEndYmd(iso: string): string {
  return iso.slice(0, 10)
}

export function TrialAccountNotice() {
  const [trial, setTrial] = useState<TrialPayload | null>(null)
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    fetch('/api/workers/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.worker) return
        setIsActive(Boolean(data.worker.is_active))
        if (data.trial) setTrial(data.trial as TrialPayload)
      })
      .catch(() => {})
  }, [])

  if (!trial) return null

  if (!isActive) {
    return (
      <div className="bg-red-50 border-b border-red-100 px-4 py-3 text-sm text-red-800">
        你的帳號已因試用期屆滿而停用，預約頁面已無法使用。
      </div>
    )
  }

  if (trial.phase === 'expired') {
    return (
      <div className="bg-red-50 border-b border-red-100 px-4 py-3 text-sm text-red-800">
        試用寬限期已結束，帳號即將停用。
      </div>
    )
  }

  if (trial.phase === 'paid' || !trial.showPaymentReminder) return null

  const trialEndLabel = formatYmdLongZhTaipei(trialEndYmd(trial.trialEndsAt))
  const deactivateLabel = formatYmdLongZhTaipei(trialEndYmd(trial.deactivateAt))

  let message: string
  if (trial.phase === 'grace') {
    message =
      trial.daysUntilDeactivate <= 1
        ? `試用期已結束，帳號將於今天（${deactivateLabel}）停用。`
        : `試用期已結束，帳號將於 ${trial.daysUntilDeactivate} 天後停用（${deactivateLabel}）。`
  } else {
    message =
      trial.daysUntilTrialEnd <= 1
        ? `免費試用將於今天結束（${trialEndLabel}）。`
        : `免費試用將於 ${trial.daysUntilTrialEnd} 天後結束（${trialEndLabel}）。`
  }

  return (
    <div className="bg-amber-50 border-b border-amber-100 px-4 py-3 text-sm text-amber-900">
      <p>
        {message}
        試用結束後每月 NT$199，完成付款開通後可繼續使用。
      </p>
    </div>
  )
}

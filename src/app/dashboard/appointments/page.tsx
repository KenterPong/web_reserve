'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Appointment, Worker } from '@/types'
import { copyTextToClipboard } from '@/lib/utils'
import { QRCodeCanvas } from 'qrcode.react'
import { dayKeyForDateTaipei, taipeiNowYmdMinutes } from '@/lib/datetime-taipei'

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

function fromMinutes(mins: number): string {
  const h = String(Math.floor(mins / 60)).padStart(2, '0')
  const m = String(mins % 60).padStart(2, '0')
  return `${h}:${m}`
}

const STATUS_LABEL: Record<string, string> = {
  confirmed: '已確認',
  completed: '已完成',
  cancelled: '已取消',
  no_show: '未出現',
}

const STATUS_COLOR: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-gray-100 text-gray-400',
  no_show: 'bg-orange-100 text-orange-600',
}

export default function AppointmentsPage() {
  const router = useRouter()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [workerId, setWorkerId] = useState<string>('')
  const [mySlug, setMySlug] = useState<string>('')
  const [referralCount, setReferralCount] = useState<number>(0)
  const [shareOpen, setShareOpen] = useState(false)
  const [copyMsg, setCopyMsg] = useState('')
  const [notifyOpen, setNotifyOpen] = useState(false)
  const [lastSeenAt, setLastSeenAt] = useState<number>(0)
  const [readKeys, setReadKeys] = useState<Record<string, true>>({})
  const [unlockOpen, setUnlockOpen] = useState<null | 'blacklist' | 'referenceImage' | 'sms'>(null)
  const [workerSlotDuration, setWorkerSlotDuration] = useState(60)
  const [workerWorkingHours, setWorkerWorkingHours] = useState<Worker['working_hours'] | null>(null)
  const [workerExceptions, setWorkerExceptions] = useState<Record<string, boolean>>({})
  const [rescheduleFor, setRescheduleFor] = useState<Appointment | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleTime, setRescheduleTime] = useState('')
  const [reschedulePartySize, setReschedulePartySize] = useState('1')
  const [rescheduleServiceItem, setRescheduleServiceItem] = useState('')
  const [rescheduleBookedTimes, setRescheduleBookedTimes] = useState<string[]>([])
  const [rescheduleLoading, setRescheduleLoading] = useState(false)
  const [rescheduleError, setRescheduleError] = useState('')
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  })
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    return `${y}-${m}`
  })

  useEffect(() => { fetchAppointments({ silent: false }) }, [currentMonth])

  // Poll for changes to avoid manual refresh
  useEffect(() => {
    const t = window.setInterval(() => {
      fetchAppointments({ silent: true })
    }, 15000)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth])

  useEffect(() => {
    fetch('/api/workers/me')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        const w = data?.worker as Worker | undefined
        setMySlug(w?.slug ?? '')
        setWorkerId(w?.id ?? '')
        setReferralCount(Number(w?.referral_count ?? 0))
        setWorkerSlotDuration(Number(w?.slot_duration ?? 60))
        setWorkerWorkingHours(w?.working_hours ?? null)
        setWorkerExceptions((w?.working_hours_exceptions as Record<string, boolean>) ?? {})
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!rescheduleFor || !workerId || !rescheduleDate) return
    let cancelled = false
    fetch(
      `/api/appointments?workerId=${encodeURIComponent(workerId)}&date=${encodeURIComponent(rescheduleDate)}&excludeAppointmentId=${encodeURIComponent(rescheduleFor.id)}`,
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setRescheduleBookedTimes((data?.bookedTimes as string[]) ?? [])
      })
      .catch(() => {
        if (!cancelled) setRescheduleBookedTimes([])
      })
    return () => {
      cancelled = true
    }
  }, [rescheduleFor, rescheduleDate, workerId])

  const availableRescheduleTimes = useMemo(() => {
    if (!rescheduleFor || !workerWorkingHours || !rescheduleDate) return []
    if (workerExceptions[rescheduleDate]) return []
    const dur = workerSlotDuration || 60
    const key = dayKeyForDateTaipei(rescheduleDate)
    const s = workerWorkingHours[key]
    if (!s || s.closed) return []
    const start = toMinutes(s.start)
    const end = toMinutes(s.end)
    const out: string[] = []
    const { ymd: todayYmd, minutes: nowMin } = taipeiNowYmdMinutes()
    const minMinutes = rescheduleDate === todayYmd ? nowMin : -Infinity
    const minAligned =
      minMinutes === -Infinity
        ? -Infinity
        : Math.max(start, start + Math.ceil((minMinutes - start) / dur) * dur)
    for (let t = start; t + dur <= end; t += dur) out.push(fromMinutes(t))
    const bookedSet = new Set(rescheduleBookedTimes.map((x) => String(x).slice(0, 5)))
    return out.filter((t) => toMinutes(t) >= minAligned && !bookedSet.has(t))
  }, [
    rescheduleFor,
    workerWorkingHours,
    rescheduleDate,
    workerExceptions,
    workerSlotDuration,
    rescheduleBookedTimes,
  ])

  useEffect(() => {
    if (!copyMsg) return
    const t = window.setTimeout(() => setCopyMsg(''), 1600)
    return () => window.clearTimeout(t)
  }, [copyMsg])

  // Notifications state persisted in localStorage
  useEffect(() => {
    if (!workerId) return
    const seenKey = `notifications:lastSeenAt:${workerId}`
    const readKey = `notifications:readKeys:${workerId}`
    const savedSeen = Number(localStorage.getItem(seenKey) ?? 0)
    const savedRead = localStorage.getItem(readKey)

    const initialSeen = Number.isFinite(savedSeen) && savedSeen > 0 ? savedSeen : Date.now()
    setLastSeenAt(initialSeen)
    localStorage.setItem(seenKey, String(initialSeen))

    try {
      const parsed = savedRead ? (JSON.parse(savedRead) as Record<string, true>) : {}
      setReadKeys(parsed && typeof parsed === 'object' ? parsed : {})
    } catch {
      setReadKeys({})
    }
  }, [workerId])

  useEffect(() => {
    if (!workerId) return
    localStorage.setItem(`notifications:lastSeenAt:${workerId}`, String(lastSeenAt || Date.now()))
  }, [workerId, lastSeenAt])

  useEffect(() => {
    if (!workerId) return
    localStorage.setItem(`notifications:readKeys:${workerId}`, JSON.stringify(readKeys))
  }, [workerId, readKeys])

  async function fetchAppointments(opts: { silent: boolean }) {
    if (!opts.silent) setIsLoading(true)
    try {
      const res = await fetch(`/api/appointments?month=${currentMonth}`)
      if (res.status === 401) {
        window.location.href = '/api/auth/line-bootstrap'
        return
      }
      const data = await res.json()
      setAppointments(data.appointments ?? [])
    } catch {
      // ignore
    } finally {
      if (!opts.silent) setIsLoading(false)
    }
  }

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/appointments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    fetchAppointments({ silent: true })
  }

  function openReschedule(apt: Appointment) {
    setRescheduleError('')
    setRescheduleFor(apt)
    setRescheduleDate(apt.appointment_date)
    setRescheduleTime('')
    setReschedulePartySize(String(apt.party_size ?? 1))
    setRescheduleServiceItem(apt.service_item ?? '')
  }

  function closeReschedule() {
    setRescheduleFor(null)
    setRescheduleError('')
    setRescheduleLoading(false)
  }

  async function submitReschedule() {
    if (!rescheduleFor || !rescheduleTime) return
    setRescheduleLoading(true)
    setRescheduleError('')
    try {
      const res = await fetch(`/api/appointments/${rescheduleFor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointment_date: rescheduleDate,
          appointment_time: `${rescheduleTime}:00`,
          party_size: Number(reschedulePartySize),
          service_item: rescheduleServiceItem.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setRescheduleError((data as { error?: string }).error || '改期失敗')
        return
      }
      const ym = rescheduleDate.slice(0, 7)
      setCurrentMonth(ym)
      setSelectedDate(rescheduleDate)
      closeReschedule()
      await fetchAppointments({ silent: true })
    } finally {
      setRescheduleLoading(false)
    }
  }

  async function openReferenceImage(appointmentId: string) {
    try {
      const res = await fetch(`/api/reference-image/signed?appointmentId=${encodeURIComponent(appointmentId)}`)
      const data = await res.json()
      if (!res.ok) {
        alert(data?.error || '取得參考圖失敗')
        return
      }
      if (data?.url) window.open(String(data.url), '_blank', 'noopener,noreferrer')
    } catch {
      alert('取得參考圖失敗')
    }
  }

  function getDaysInMonth() {
    const [year, month] = currentMonth.split('-').map(Number)
    const count = new Date(year, month, 0).getDate()
    return Array.from({ length: count }, (_, i) => {
      const day = String(i + 1).padStart(2, '0')
      return `${currentMonth}-${day}`
    })
  }

  function countForDate(date: string) {
    return appointments.filter(a => a.appointment_date === date && a.status === 'confirmed').length
  }

  function prevMonth() {
    const [y, m] = currentMonth.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    setCurrentMonth(ym)
  }

  function nextMonth() {
    const [y, m] = currentMonth.split('-').map(Number)
    const d = new Date(y, m, 1)
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    setCurrentMonth(ym)
  }

  const selectedAppointments = appointments
    .filter(a => a.appointment_date === selectedDate)
    .sort((a, b) => a.appointment_time.localeCompare(b.appointment_time))

  const today = new Date().toISOString().split('T')[0]
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN
  const shareUrl =
    mySlug && rootDomain
      ? `https://${mySlug}.${rootDomain}`
      : mySlug
        ? `${window.location.protocol}//${mySlug}.${window.location.host.replace(/^www\./, '')}`
        : ''

  const referralUrl =
    mySlug && rootDomain
      ? `https://www.${rootDomain}/${mySlug}`
      : mySlug && typeof window !== 'undefined' && window.location.hostname.startsWith('www.')
        ? `${window.location.origin}/${mySlug}`
        : ''

  function handleCopyShareUrl() {
    if (!shareUrl) return
    void copyTextToClipboard(shareUrl).then((ok) => setCopyMsg(ok ? '已複製' : '複製失敗'))
  }

  function handleCopyReferralUrl() {
    if (!referralUrl) return
    void copyTextToClipboard(referralUrl).then((ok) => setCopyMsg(ok ? '已複製' : '複製失敗'))
  }

  function unlockNextText(n: number): string | null {
    const x = Number.isFinite(n) ? n : 0
    if (x < 5) return `目前 ${x} 人　還差 ${5 - x} 人可解鎖 🚫 黑名單功能`
    if (x < 10) return `目前 ${x} 人　還差 ${10 - x} 人可解鎖 🖼️ 參考圖功能`
    if (x < 15) return `目前 ${x} 人　還差 ${15 - x} 人可解鎖 💬 簡訊通知功能`
    return null
  }

  function isUnlocked(kind: 'blacklist' | 'referenceImage' | 'sms'): boolean {
    if (kind === 'blacklist') return referralCount >= 5
    if (kind === 'referenceImage') return referralCount >= 10
    return referralCount >= 15
  }

  function appointmentEventAtMs(a: Appointment): number {
    const t = Date.parse(a.updated_at || a.created_at)
    return Number.isFinite(t) ? t : 0
  }

  const notificationCandidates = lastSeenAt
    ? appointments.filter((a) => appointmentEventAtMs(a) > lastSeenAt)
    : []

  const unreadNotifications = notificationCandidates
    .filter((a) => !readKeys[`${a.id}:${a.updated_at}`])
    .sort((a, b) => appointmentEventAtMs(b) - appointmentEventAtMs(a))

  function markAllRead() {
    setReadKeys({})
    setLastSeenAt(Date.now())
    setNotifyOpen(false)
  }

  function markOneRead(a: Appointment) {
    const k = `${a.id}:${a.updated_at}`
    setReadKeys((prev) => ({ ...prev, [k]: true }))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm px-4 py-4">
        <div className="flex justify-between items-center">
          <div>
          <h1 className="text-lg font-bold text-gray-800">預約管理</h1>
          <p className="text-xs text-gray-400">點選日期查看預約</p>
          </div>

          <div className="flex items-center gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setNotifyOpen((v) => !v)}
              className="relative text-sm text-green-600 hover:text-green-700"
            >
              通知
              {unreadNotifications.length > 0 ? (
                <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] leading-none">
                  {unreadNotifications.length > 99 ? '99+' : unreadNotifications.length}
                </span>
              ) : null}
            </button>

            {notifyOpen ? (
              <div className="absolute right-0 mt-2 w-[320px] rounded-2xl border border-gray-100 bg-white shadow-lg overflow-hidden z-40">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-800">通知</p>
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="text-xs text-green-700 hover:text-green-800"
                  >
                    全部已讀
                  </button>
                </div>
                <div className="max-h-[360px] overflow-auto">
                  {unreadNotifications.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-gray-400">目前沒有新通知</div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {unreadNotifications.map((a) => (
                        <button
                          key={`${a.id}:${a.updated_at}`}
                          type="button"
                          className="w-full text-left px-4 py-3 hover:bg-gray-50"
                          onClick={() => {
                            markOneRead(a)
                            setSelectedDate(a.appointment_date)
                            setNotifyOpen(false)
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-gray-800">
                              {a.appointment_time.slice(0, 5)} {a.customer_name}
                            </p>
                            <span className={`text-[11px] px-2 py-0.5 rounded-full ${STATUS_COLOR[a.status]}`}>
                              {STATUS_LABEL[a.status]}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-1">
                            {a.appointment_date}・{(a.party_size ?? 1)} 人・{a.service_item || '（未填寫服務項目）'}
                          </p>
                          <p className="text-[11px] text-gray-400 mt-1">
                            更新：{new Date(appointmentEventAtMs(a)).toLocaleString('zh-TW')}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="text-sm text-green-600 hover:text-green-700"
          >
            分享
          </button>
          <a href="/dashboard/insights" className="text-sm text-green-600 hover:text-green-700">洞察</a>
          <a href="/dashboard/profile" className="text-sm text-green-600 hover:text-green-700">設定</a>
        </div>
      </div>

        {/* Unlock navbar */}
        <div className="mt-3 flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <a
              href="/dashboard/appointments"
              className="w-9 h-9 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-700"
              aria-label="回到行事曆"
              title="回到行事曆"
            >
              🏠
            </a>
            {([
              { kind: 'blacklist' as const, label: '🚫', title: '黑名單' },
              { kind: 'referenceImage' as const, label: '🖼️', title: '參考圖' },
              { kind: 'sms' as const, label: '💬', title: '簡訊通知' },
            ]).map((it) => {
              const ok = isUnlocked(it.kind)
              return (
                <button
                  key={it.kind}
                  type="button"
                  onClick={() => {
                    if (it.kind === 'blacklist' && isUnlocked('blacklist')) {
                      router.push('/dashboard/blacklist')
                      return
                    }
                    setUnlockOpen(it.kind)
                  }}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                    ok ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-gray-50 text-gray-400 opacity-60 hover:opacity-80'
                  }`}
                  aria-label={it.title}
                  title={it.title}
                >
                  {it.label}
                </button>
              )
            })}
          </div>
          {unlockNextText(referralCount) ? (
            <p className="text-[11px] text-gray-400 text-center">{unlockNextText(referralCount)}</p>
          ) : null}
        </div>
      </div>

      {shareOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setShareOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white shadow-lg p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-800">分享你的預約連結</h2>
              <button
                type="button"
                onClick={() => setShareOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                aria-label="關閉"
              >
                ×
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <p className="text-xs text-gray-500 mb-1">你的專屬連結</p>
                <p className="text-sm font-medium text-gray-800 break-all">
                  {shareUrl || '尚未設定 slug（請到「設定」填寫專屬網址）'}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyShareUrl}
                    disabled={!shareUrl}
                    className="px-3 py-2 rounded-lg bg-green-500 text-white text-sm font-semibold disabled:opacity-50 hover:bg-green-600 transition-colors"
                  >
                    複製連結
                  </button>
                  {copyMsg ? <span className="text-xs text-gray-500">{copyMsg}</span> : null}
                </div>
              </div>

              <div className="rounded-xl border border-gray-100 p-4 flex flex-col items-center">
                <p className="text-xs text-gray-500 mb-3">或讓客戶掃描 QR Code</p>
                <div className={`bg-white p-3 rounded-xl ${shareUrl ? '' : 'opacity-40'}`}>
                  <QRCodeCanvas value={shareUrl || 'https://example.com'} size={192} />
                </div>
                <p className="text-[11px] text-gray-400 mt-3 text-center">
                  客戶掃描後會直接開啟你的子網域預約頁
                </p>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-semibold text-gray-800">推薦設計師加入</p>
                <p className="text-xs text-gray-500 mt-1">
                  把連結分享給其他設計師，他們加入後自動計入你的推薦紀錄
                </p>
                <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500 mb-1">推薦連結</p>
                  <p className="text-sm font-medium text-gray-800 break-all">
                    {referralUrl || '尚未設定 slug（請到「設定」填寫專屬網址）'}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyReferralUrl}
                      disabled={!referralUrl}
                      className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold disabled:opacity-50 hover:bg-gray-800 transition-colors"
                    >
                      複製推薦連結
                    </button>
                    {copyMsg ? <span className="text-xs text-gray-500">{copyMsg}</span> : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {unlockOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setUnlockOpen(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white shadow-lg p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-800">
                {unlockOpen === 'blacklist' ? '🚫 黑名單功能' : unlockOpen === 'referenceImage' ? '🖼️ 參考圖功能' : '💬 簡訊通知功能'}
              </h2>
              <button
                type="button"
                onClick={() => setUnlockOpen(null)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                aria-label="關閉"
              >
                ×
              </button>
            </div>

            <div className="mt-3 text-sm text-gray-600 space-y-2">
              {!isUnlocked(unlockOpen) ? (
                <>
                  <p>此功能尚未解鎖。</p>
                  <p className="text-xs text-gray-500">把推薦連結分享給其他設計師，他們完成加入後就會計入推薦數。</p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleCopyReferralUrl()
                    }}
                    disabled={!referralUrl}
                    className="mt-2 w-full px-3 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold disabled:opacity-50 hover:bg-gray-800 transition-colors"
                  >
                    複製推薦連結
                  </button>
                  {copyMsg ? <p className="text-xs text-gray-500">{copyMsg}</p> : null}
                </>
              ) : (
                <p className="text-green-700 font-medium">已解鎖（入口開發中）。</p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {rescheduleFor ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => !rescheduleLoading && closeReschedule()}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white shadow-lg p-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-800">改期</h2>
              <button
                type="button"
                disabled={rescheduleLoading}
                onClick={() => closeReschedule()}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none disabled:opacity-50"
                aria-label="關閉"
              >
                ×
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {rescheduleFor.customer_name}・{rescheduleFor.customer_phone}
            </p>

            <div className="mt-4 space-y-3 text-left">
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">日期</label>
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => {
                    setRescheduleDate(e.target.value)
                    setRescheduleTime('')
                  }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">時段（{workerSlotDuration} 分鐘一格）</label>
                <div className="flex flex-wrap gap-2">
                  {availableRescheduleTimes.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setRescheduleTime(t)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                        rescheduleTime === t
                          ? 'border-green-600 bg-green-50 text-green-800'
                          : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                {availableRescheduleTimes.length === 0 ? (
                  <p className="text-xs text-gray-400 mt-1">此日無可選時段（公休、已滿或已過今日可預約時間）</p>
                ) : null}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] text-gray-500 mb-1">人數</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={reschedulePartySize}
                    onChange={(e) => setReschedulePartySize(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] text-gray-500 mb-1">服務項目</label>
                  <input
                    type="text"
                    value={rescheduleServiceItem}
                    onChange={(e) => setRescheduleServiceItem(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm"
                  />
                </div>
              </div>
              {rescheduleError ? <p className="text-xs text-red-600">{rescheduleError}</p> : null}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={rescheduleLoading}
                  onClick={() => closeReschedule()}
                  className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  type="button"
                  disabled={
                    rescheduleLoading ||
                    !rescheduleTime ||
                    !rescheduleServiceItem.trim() ||
                    !reschedulePartySize.trim()
                  }
                  onClick={() => void submitReschedule()}
                  className="flex-1 bg-green-500 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-green-600 disabled:opacity-50"
                >
                  {rescheduleLoading ? '送出中...' : '確認改期'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Calendar */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-lg">‹</button>
            <span className="font-semibold text-gray-800 text-sm">
              {new Date(currentMonth + '-01').toLocaleDateString('zh-TW', { year: 'numeric', month: 'long' })}
            </span>
            <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-lg">›</button>
          </div>

          <div className="grid grid-cols-7 mb-2">
            {['日','一','二','三','四','五','六'].map(d => (
              <div key={d} className="text-center text-xs text-gray-400 py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: new Date(currentMonth + '-01').getDay() }).map((_, i) => (
              <div key={`e-${i}`} />
            ))}
            {getDaysInMonth().map(date => {
              const count = countForDate(date)
              const isSelected = date === selectedDate
              const isToday = date === today
              return (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  className={`relative aspect-square rounded-xl flex flex-col items-center justify-center text-sm transition-colors ${
                    isSelected ? 'bg-green-500 text-white' :
                    isToday ? 'bg-green-50 text-green-700' :
                    'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  {date.split('-')[2].replace(/^0/, '')}
                  {count > 0 && (
                    <span className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-green-400'}`} />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Day appointments */}
        <div>
          <h2 className="text-xs font-semibold text-gray-500 mb-2 px-1">
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('zh-TW', {
              year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
            })}
          </h2>

          {isLoading ? (
            <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-400 text-sm">載入中...</div>
          ) : selectedAppointments.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-400 text-sm">這天沒有預約</div>
          ) : (
            <div className="space-y-2">
              {selectedAppointments.map(apt => (
                <div key={apt.id} className="bg-white rounded-2xl shadow-sm p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg font-bold text-gray-800">{apt.appointment_time.slice(0, 5)}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[apt.status]}`}>
                          {STATUS_LABEL[apt.status]}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-700">{apt.customer_name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {(apt.party_size ?? 1)} 人・{apt.service_item || '（未填寫服務項目）'}
                      </p>
                      <a href={`tel:${apt.customer_phone}`} className="text-sm text-green-600 hover:underline">
                        {apt.customer_phone}
                      </a>
                      {apt.note && <p className="text-xs text-gray-400 mt-1">{apt.note}</p>}
                      {apt.reference_image_url ? (
                        <button
                          type="button"
                          onClick={() => openReferenceImage(apt.id)}
                          className="mt-2 inline-flex items-center text-xs text-green-700 hover:text-green-800 underline underline-offset-2"
                        >
                          🖼️ 查看參考圖
                        </button>
                      ) : null}
                    </div>

                    {apt.status === 'confirmed' && (
                      <div className="flex flex-col gap-1 ml-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => openReschedule(apt)}
                          className="text-xs bg-green-50 text-green-700 px-3 py-1 rounded-lg hover:bg-green-100"
                        >
                          改期
                        </button>
                        <button
                          type="button"
                          onClick={() => updateStatus(apt.id, 'completed')}
                          className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-lg hover:bg-blue-100"
                        >
                          完成
                        </button>
                        <button
                          type="button"
                          onClick={() => updateStatus(apt.id, 'no_show')}
                          className="text-xs bg-orange-50 text-orange-500 px-3 py-1 rounded-lg hover:bg-orange-100"
                        >
                          未到
                        </button>
                        <button
                          type="button"
                          onClick={() => { if (confirm('確定取消？')) updateStatus(apt.id, 'cancelled') }}
                          className="text-xs bg-red-50 text-red-500 px-3 py-1 rounded-lg hover:bg-red-100"
                        >
                          取消
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Monthly stats */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-500 mb-3">本月統計</p>
          <div className="grid grid-cols-4 gap-2 text-center">
            {(['confirmed','completed','cancelled','no_show'] as const).map(s => (
              <div key={s}>
                <p className={`text-xl font-bold ${
                  s === 'confirmed' ? 'text-green-500' :
                  s === 'completed' ? 'text-blue-500' :
                  s === 'no_show' ? 'text-orange-400' : 'text-gray-300'
                }`}>
                  {appointments.filter(a => a.status === s).length}
                </p>
                <p className="text-xs text-gray-400">{STATUS_LABEL[s]}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

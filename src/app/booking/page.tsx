'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { ChatMessage } from '@/types'
import { dayKeyForDateTaipei } from '@/lib/datetime-taipei'
import { AppAlertDialog } from '@/components/AppDialog'

interface WorkerPublic {
  id: string
  display_name: string
  business_name?: string | null
  avatar_url?: string | null
  contact_phone?: string | null
  /** 顧客「預約申請已送出」畫面；未設定時用平台預設 */
  booking_confirmation_message?: string | null
  working_hours_exceptions?: Record<string, boolean>
  referral_count?: number
}

const DEFAULT_BOOKING_CONFIRMATION_MESSAGE =
  '我會盡快確認您的預約，如有時間調整會直接與您聯繫，謝謝！'

interface PendingBooking {
  proposedDate: string
  proposedTime: string
}

type WorkingHours = Record<
  'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun',
  { start: string; end: string; closed: boolean }
>

interface CompletedAppointment {
  appointmentId: string
  manageToken: string
  date: string
  time: string
  partySize: number
  serviceItem: string
}

type LookupAppointment = { date: string; time: string }

function generateSessionToken(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}

function getOrCreateSessionToken(): string {
  const key = 'booking_session_token'
  let token = sessionStorage.getItem(key)
  if (!token) {
    token = generateSessionToken()
    sessionStorage.setItem(key, token)
  }
  return token
}

function getSlugFromHost(): string | null {
  if (typeof window === 'undefined') return null
  const hostname = window.location.hostname
  const parts = hostname.split('.')
  if (parts.length < 2) return null
  if (parts[0] === 'www') return null
  return parts[0] || null
}

function taipeiNowYmdMinutes(): { ymd: string; minutes: number } {
  const now = new Date()
  const ymd = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)
  const hh = Number(parts.find(p => p.type === 'hour')?.value ?? '0')
  const mm = Number(parts.find(p => p.type === 'minute')?.value ?? '0')
  return { ymd, minutes: (hh || 0) * 60 + (mm || 0) }
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

function fromMinutes(mins: number): string {
  const h = String(Math.floor(mins / 60)).padStart(2, '0')
  const m = String(mins % 60).padStart(2, '0')
  return `${h}:${m}`
}

function formatDateTime(date: string, time: string): string {
  return new Date(`${date}T${time}`).toLocaleString('zh-TW', {
    year: 'numeric', month: 'long', day: 'numeric',
    weekday: 'long', hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Taipei',
  })
}

function extractNameAndPhone(text: string): { name?: string; phone?: string } {
  const phoneMatch = text.match(/(\+886|0)[0-9]{8,9}/)
  const phone = phoneMatch?.[0]
  // Very lightweight heuristic: take leading non-digit tokens as name
  const maybeName = text
    .replace(phone ?? '', '')
    .replace(/[0-9+\-()\s]/g, ' ')
    .trim()
    .split(/\s+/)[0]
  const name = maybeName && maybeName.length <= 20 ? maybeName : undefined
  return { name, phone }
}

function BookingChat() {
  const searchParams = useSearchParams()
  const slugFromQuery = searchParams.get('slug')
  const [slug, setSlug] = useState<string | null>(() => {
    if (slugFromQuery) return slugFromQuery
    return getSlugFromHost()
  })

  const [worker, setWorker] = useState<WorkerPublic | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [pendingBooking, setPendingBooking] = useState<PendingBooking | null>(null)
  const [isCompleted, setIsCompleted] = useState(false)
  const [completed, setCompleted] = useState<CompletedAppointment | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [partySize, setPartySize] = useState('1')
  const [serviceItem, setServiceItem] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [manageMsg, setManageMsg] = useState<string>('')
  const [isManaging, setIsManaging] = useState(false)
  const [isRescheduling, setIsRescheduling] = useState(false)
  const [isCancelled, setIsCancelled] = useState(false)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleTime, setRescheduleTime] = useState('')
  const [reschedulePartySize, setReschedulePartySize] = useState('1')
  const [rescheduleServiceItem, setRescheduleServiceItem] = useState('')
  const [referenceFile, setReferenceFile] = useState<File | null>(null)
  const [referenceUploadMsg, setReferenceUploadMsg] = useState('')
  const [isReferenceUploading, setIsReferenceUploading] = useState(false)
  const [showLookup, setShowLookup] = useState(false)
  const [lookupPhone, setLookupPhone] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState<string>('')
  const [lookupResults, setLookupResults] = useState<LookupAppointment[] | null>(null)
  const [noticeDialog, setNoticeDialog] = useState<{ title?: string; message: string } | null>(null)
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  })
  const [bookedTimes, setBookedTimes] = useState<string[]>([])
  const [sessionToken] = useState(() =>
    typeof window !== 'undefined' ? getOrCreateSessionToken() : '',
  )

  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (slugFromQuery) {
      setSlug(slugFromQuery)
      return
    }
    setSlug(getSlugFromHost())
  }, [slugFromQuery])

  // Load worker by slug
  useEffect(() => {
    if (!slug) {
      setNotFound(true)
      setWorker(null)
      return
    }
    setNotFound(false)

    fetch(`/api/workers?slug=${encodeURIComponent(slug)}`)
      .then(res => {
        if (!res.ok) { setNotFound(true); return null }
        return res.json()
      })
      .then(data => {
        if (!data) return
        setWorker(data.worker)
        setMessages([{
          role: 'assistant',
          content: `您好！我是${data.worker.business_name || data.worker.display_name}的預約助理，請問您想預約什麼時間呢？`,
        }])
      })
      .catch(() => setNotFound(true))
  }, [slug])

  // Load booked slots for selected date (public)
  useEffect(() => {
    if (!worker?.id || !selectedDate) return
    const exclude = completed?.manageToken ? `&excludeManageToken=${encodeURIComponent(completed.manageToken)}` : ''
    fetch(`/api/appointments?workerId=${encodeURIComponent(worker.id)}&date=${encodeURIComponent(selectedDate)}${exclude}`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => setBookedTimes((data?.bookedTimes as string[]) ?? []))
      .catch(() => setBookedTimes([]))
  }, [worker?.id, selectedDate, completed?.manageToken])

  // Prefill contact fields if user already typed them in chat
  useEffect(() => {
    if (!pendingBooking) return
    const lastUser = [...messages].reverse().find(m => m.role === 'user')?.content ?? ''
    const { name, phone } = extractNameAndPhone(lastUser)
    if (phone && !customerPhone.trim()) setCustomerPhone(phone)
    if (name && !customerName.trim()) setCustomerName(name)
  }, [pendingBooking, messages, customerPhone, customerName])

  const availableTimes = (() => {
    if (!worker) return [] as string[]
    const wAny = worker as unknown as {
      working_hours?: WorkingHours
      slot_duration?: number
      working_hours_exceptions?: Record<string, boolean>
    }
    if (wAny.working_hours_exceptions?.[selectedDate]) return [] as string[]
    const wh = wAny?.working_hours
    const dur = Number(wAny?.slot_duration ?? 60)
    if (!wh || !selectedDate || !dur) return [] as string[]
    const key = dayKeyForDateTaipei(selectedDate)
    const s = wh[key]
    if (!s || s.closed) return [] as string[]
    const start = toMinutes(s.start)
    const end = toMinutes(s.end)
    const out: string[] = []
    const { ymd: todayYmd, minutes: nowMin } = taipeiNowYmdMinutes()
    const minMinutes = selectedDate === todayYmd ? nowMin + 120 : -Infinity
    const minAligned =
      minMinutes === -Infinity
        ? -Infinity
        : Math.max(start, start + Math.ceil((minMinutes - start) / dur) * dur)
    for (let t = start; t + dur <= end; t += dur) out.push(fromMinutes(t))
    return out.filter((t) => toMinutes(t) >= minAligned)
  })()

  const bookedSet = new Set(bookedTimes.map(t => t.slice(0, 5)))

  function validateProposedSlot(date: string, time: string): { ok: boolean; reason?: string } {
    if (!worker) return { ok: false, reason: '載入中' }
    const wAny = worker as unknown as {
      working_hours?: WorkingHours
      slot_duration?: number
      working_hours_exceptions?: Record<string, boolean>
    }
    if (wAny.working_hours_exceptions?.[date]) return { ok: false, reason: '此日期為公休' }
    const wh = wAny?.working_hours
    const dur = Number(wAny?.slot_duration ?? 60)
    if (!wh || !dur) return { ok: false, reason: '尚未設定營業時間' }

    const key = dayKeyForDateTaipei(date)
    const s = wh[key]
    if (!s || s.closed) return { ok: false, reason: '此日期未營業' }

    const start = toMinutes(s.start)
    const end = toMinutes(s.end)
    const requested = toMinutes(String(time).slice(0, 5))
    if (requested < start || requested + dur > end) return { ok: false, reason: '此時間不在營業時段內' }
    if ((requested - start) % dur !== 0) return { ok: false, reason: `請選擇每 ${dur} 分鐘為間隔的時段` }
    if (bookedSet.has(String(time).slice(0, 5))) return { ok: false, reason: '此時段已被預約' }

    const { ymd: todayYmd, minutes: nowMin } = taipeiNowYmdMinutes()
    if (date === todayYmd && requested < nowMin + 120) {
      return { ok: false, reason: '最早需在 2 小時後才能預約' }
    }

    return { ok: true }
  }

  function suggestionsForDate(date: string, fromTime?: string): string[] {
    if (!worker) return []
    const wAny = worker as unknown as {
      working_hours?: WorkingHours
      slot_duration?: number
      working_hours_exceptions?: Record<string, boolean>
    }
    if (wAny.working_hours_exceptions?.[date]) return []
    const wh = wAny?.working_hours
    const dur = Number(wAny?.slot_duration ?? 60)
    if (!wh || !dur) return []

    const key = dayKeyForDateTaipei(date)
    const s = wh[key]
    if (!s || s.closed) return []

    const start = toMinutes(s.start)
    const end = toMinutes(s.end)
    const out: string[] = []
    for (let t = start; t + dur <= end; t += dur) out.push(fromMinutes(t))

    const unbooked = out.filter((t) => !bookedSet.has(t))
    if (!fromTime) return unbooked.slice(0, 3)

    const req = toMinutes(fromTime.slice(0, 5))
    const next = unbooked.filter((t) => toMinutes(t) >= req)
    return (next.length > 0 ? next : unbooked).slice(0, 3)
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading || !worker) return

    const userMessage: ChatMessage = { role: 'user', content: input.trim() }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId: worker.id,
          sessionToken,
          message: input.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.error || '發生錯誤，請稍後再試',
        }])
        return
      }

      setMessages(prev => [...prev, { role: 'assistant', content: data.message }])

      if (data.action?.type === 'SHOW_CONTACT_FORM') {
        const d = String(data.action.proposedDate)
        const t = String(data.action.proposedTime)

        // Ensure slot validation happens immediately (before showing the form)
        const validation = validateProposedSlot(d, t)
        if (!validation.ok) {
          setSelectedDate(d)
          const sugg = suggestionsForDate(d, t)
          const extra =
            sugg.length > 0
              ? `建議你改選：${sugg.join('、')}。你想預約哪一個時段？`
              : '這天可能已滿或不在營業時間內，請換一個日期或時段，我幫你看看。'
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `${validation.reason}。\n${extra}`,
          }])
          return
        }

        setPendingBooking({ proposedDate: d, proposedTime: t })
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '抱歉，發生了一點問題，請稍後再試。',
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmitContact = async () => {
    if (!partySize.trim() || !serviceItem.trim() || !customerName.trim() || !customerPhone.trim() || !pendingBooking || !worker) return

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId: worker.id,
          partySize: Number(partySize),
          serviceItem: serviceItem.trim(),
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          appointmentDate: pendingBooking.proposedDate,
          appointmentTime: pendingBooking.proposedTime,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        sessionStorage.removeItem('booking_session_token')
        setCompleted({
          appointmentId: String(data?.appointment?.id ?? ''),
          manageToken: data.manageToken,
          date: pendingBooking.proposedDate,
          time: pendingBooking.proposedTime,
          partySize: Number(partySize),
          serviceItem: serviceItem.trim(),
        })
        setIsCompleted(true)
      } else {
        const data = await res.json().catch(() => ({}))
        setNoticeDialog({
          title: '預約無法完成',
          message: data.error || '預約失敗，請稍後再試',
        })
        if (res.status !== 403) {
          setSelectedDate(pendingBooking.proposedDate)
          setPendingBooking(null)
        }
      }
    } catch {
      setNoticeDialog({ title: '連線異常', message: '網路錯誤，請稍後再試' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLookup = async () => {
    if (!worker?.id) return
    setLookupLoading(true)
    setLookupError('')
    setLookupResults(null)

    try {
      const res = await fetch(
        `/api/appointments/lookup?phone=${encodeURIComponent(lookupPhone.trim())}&workerId=${encodeURIComponent(worker.id)}`,
      )
      const data = await res.json()
      if (!res.ok) {
        setLookupError(data?.error || '查詢失敗，請稍後再試')
        return
      }
      setLookupResults((data?.appointments as LookupAppointment[]) ?? [])
    } catch {
      setLookupError('網路錯誤，請稍後再試')
    } finally {
      setLookupLoading(false)
    }
  }

  const canUploadReferenceImage = Number((worker as any)?.referral_count ?? 0) >= 10

  const handleUploadReference = async () => {
    if (!completed?.manageToken) return
    if (!referenceFile) return
    setReferenceUploadMsg('')
    setIsReferenceUploading(true)
    try {
      const fd = new FormData()
      fd.append('manageToken', completed.manageToken)
      fd.append('customerPhone', customerPhone.trim())
      fd.append('file', referenceFile)
      const res = await fetch('/api/reference-image', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setNoticeDialog({
          title: '參考圖上傳失敗',
          message: data?.error || `上傳失敗（HTTP ${res.status}）`,
        })
        return
      }
      setReferenceUploadMsg('上傳成功')
      setReferenceFile(null)
    } catch {
      setNoticeDialog({ title: '連線異常', message: '網路錯誤，請稍後再試' })
    } finally {
      setIsReferenceUploading(false)
    }
  }

  const handleCancel = async () => {
    if (!completed?.manageToken) return
    setIsManaging(true)
    setManageMsg('')
    try {
      const res = await fetch('/api/appointments/manage', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manageToken: completed.manageToken,
          customerPhone: customerPhone.trim(),
          action: 'cancel',
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setIsCancelled(true)
        setIsRescheduling(false)
        setManageMsg('取消成功')
      } else {
        setManageMsg(data.error || '取消失敗')
      }
    } finally {
      setIsManaging(false)
    }
  }

  const handleReschedule = async (newDate: string, newTime: string) => {
    if (!completed?.manageToken) return
    setIsManaging(true)
    setManageMsg('')
    try {
      const res = await fetch('/api/appointments/manage', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manageToken: completed.manageToken,
          customerPhone: customerPhone.trim(),
          action: 'reschedule',
          newDate,
          newTime,
          partySize: Number(reschedulePartySize),
          serviceItem: rescheduleServiceItem.trim(),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setCompleted({
          ...completed,
          date: newDate,
          time: newTime,
          partySize: Number(reschedulePartySize),
          serviceItem: rescheduleServiceItem.trim(),
        })
        setIsRescheduling(false)
        setRescheduleTime('')
        setManageMsg('已完成改期')
      } else {
        setManageMsg(data.error || '改期失敗')
      }
    } finally {
      setIsManaging(false)
    }
  }

  useEffect(() => {
    if (!isRescheduling || !completed) return
    setIsCancelled(false)
    setRescheduleDate(completed.date)
    setSelectedDate(completed.date)
    setRescheduleTime('')
    setReschedulePartySize(String(completed.partySize ?? 1))
    setRescheduleServiceItem(completed.serviceItem ?? '')
  }, [isRescheduling, completed])

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">找不到此工作者的預約頁面</p>
      </div>
    )
  }

  if (!worker) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400 text-sm">載入中...</p>
      </div>
    )
  }

  if (isCompleted && pendingBooking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center space-y-4">
          <div className="text-5xl">{isCancelled ? '✅' : '✅'}</div>
          <h2 className="text-xl font-bold text-gray-800">
            {isCancelled ? '已取消預約' : '預約申請已送出'}
          </h2>
          {!isCancelled ? (
            <>
              <p className="text-sm text-gray-800 font-medium">
                {worker.business_name || worker.display_name}
                <span className="text-gray-400 font-normal"> ／ </span>
                <span className="text-gray-700">
                  {formatDateTime(
                    completed?.date ?? pendingBooking.proposedDate,
                    completed?.time ?? pendingBooking.proposedTime,
                  )}
                </span>
              </p>
              <p className="text-sm text-gray-600 leading-relaxed px-1">
                {(worker.booking_confirmation_message ?? '').trim() ||
                  DEFAULT_BOOKING_CONFIRMATION_MESSAGE}
              </p>
              <p className="text-sm text-gray-700">
                <span aria-hidden>📞</span>{' '}
                {worker.contact_phone ? (
                  <a href={`tel:${worker.contact_phone}`} className="font-semibold text-green-700 underline">
                    {worker.contact_phone}
                  </a>
                ) : (
                  <span className="text-gray-400">尚未設定聯絡電話</span>
                )}
              </p>
              <p className="text-xs text-gray-500 border-t border-gray-100 pt-3">
                請截圖保存此頁面作為預約憑證
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-700">
                {worker.business_name || worker.display_name}
              </p>
              <p className="text-gray-600 text-sm">
                已成功取消此筆預約。<br />
                如需重新預約，請回到預約頁再選擇時段。
              </p>
            </>
          )}

          {!isCancelled && canUploadReferenceImage ? (
            <div className="text-left rounded-xl border border-gray-100 bg-gray-50 p-3">
              <p className="text-sm font-semibold text-gray-800">上傳參考圖（選填）</p>
              <p className="text-xs text-gray-500 mt-1">可上傳一張 jpg/png（5MB 以內），讓工作者提前評估。</p>
              <div className="mt-2 space-y-2">
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={(e) => setReferenceFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-xs text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-white file:text-gray-700"
                />
                <button
                  type="button"
                  onClick={handleUploadReference}
                  disabled={!completed?.manageToken || !referenceFile || isReferenceUploading}
                  className="w-full px-3 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold disabled:opacity-50 hover:bg-gray-800 transition-colors"
                >
                  {isReferenceUploading ? '上傳中...' : '上傳參考圖'}
                </button>
                {referenceUploadMsg ? <p className="text-xs text-gray-500">{referenceUploadMsg}</p> : null}
              </div>
            </div>
          ) : null}

          <p className="text-xs text-gray-400">如需更改或取消，可直接在下方操作。</p>

          {manageMsg ? <p className="text-sm text-green-600">{manageMsg}</p> : null}

          {!isCancelled ? (
            <div className="space-y-2 pt-2">
            {!completed?.manageToken ? (
              <p className="text-xs text-red-500">
                缺少管理代碼（manageToken），請重新預約一次再嘗試取消/改期。
              </p>
            ) : null}
            <button
              onClick={() => setIsRescheduling(v => !v)}
              disabled={isManaging || !completed?.manageToken}
              className="w-full border border-green-300 text-green-700 rounded-xl py-2 text-sm hover:bg-green-50 disabled:opacity-50"
            >
              {isRescheduling ? '取消改期' : '改期'}
            </button>
            <button
              onClick={handleCancel}
              disabled={isManaging || !completed?.manageToken}
              className="w-full border border-red-300 text-red-600 rounded-xl py-2 text-sm hover:bg-red-50 disabled:opacity-50"
            >
              取消預約
            </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full bg-green-500 text-white rounded-xl py-3 text-sm font-semibold hover:bg-green-600 transition-colors"
            >
              回到預約頁
            </button>
          )}

          {isRescheduling ? (
            <div className="text-left pt-3 space-y-2">
              <p className="text-xs text-gray-500">確認改期資訊</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="block text-[11px] text-gray-500 mb-1">人數</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={reschedulePartySize}
                    onChange={(e) => setReschedulePartySize(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] text-gray-500 mb-1">服務項目</label>
                  <input
                    type="text"
                    value={rescheduleServiceItem}
                    onChange={(e) => setRescheduleServiceItem(e.target.value)}
                    placeholder="例：洗+剪、凝膠卸甲+手部保養"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">選擇新的日期與時段（需距離現在至少 2 小時）</p>
              <input
                type="date"
                value={rescheduleDate || selectedDate}
                onChange={(e) => { setRescheduleDate(e.target.value); setSelectedDate(e.target.value); setRescheduleTime('') }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400"
              />
              <div className="flex flex-wrap gap-2">
                {availableTimes.map((t) => {
                  const isBooked = bookedSet.has(t)
                  return (
                    <button
                      key={t}
                      disabled={isBooked || isManaging}
                      onClick={() => setRescheduleTime(`${t}:00`)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                        isBooked || isManaging
                          ? 'border-gray-200 text-gray-300 bg-gray-50 cursor-not-allowed'
                          : rescheduleTime.slice(0, 5) === t
                            ? 'border-green-600 bg-green-50 text-green-800'
                            : 'border-green-300 text-green-700 hover:bg-green-50'
                      }`}
                    >
                      {t}
                    </button>
                  )
                })}
              </div>
              <button
                type="button"
                disabled={
                  isManaging ||
                  !completed?.manageToken ||
                  !rescheduleTime ||
                  !rescheduleServiceItem.trim() ||
                  !reschedulePartySize.trim()
                }
                onClick={() => handleReschedule(rescheduleDate || selectedDate, rescheduleTime)}
                className="w-full bg-green-500 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50 hover:bg-green-600 transition-colors"
              >
                {isManaging ? '送出中...' : '確認改期'}
              </button>
              {availableTimes.length === 0 ? (
                <p className="text-xs text-gray-400">這天未營業或尚未設定營業時間</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm px-4 py-3 flex items-center gap-3">
        {worker.avatar_url ? (
          <img src={worker.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
        ) : (
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-bold">
            {(worker.business_name || worker.display_name).charAt(0)}
          </div>
        )}
        <div>
          <p className="font-semibold text-gray-800 text-sm">
            {worker.business_name || worker.display_name} 預約助理
          </p>
          <p className="text-xs text-green-500">● 線上</p>
        </div>
      </div>

      {/* Slot picker */}
      {!pendingBooking && (
        <div className="bg-white border-b border-gray-100 px-4 py-3 space-y-2">
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-500 shrink-0">選擇日期</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400"
            />
            <button
              onClick={() => {
                setShowLookup((v) => !v)
                setLookupError('')
                setLookupResults(null)
              }}
              className="ml-auto text-xs text-green-700 hover:text-green-800 underline underline-offset-2"
            >
              {showLookup ? '關閉查詢' : '查詢我的預約'}
            </button>
          </div>

          {showLookup && (
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-2">
              <p className="text-xs text-gray-600">
                輸入你預約時留下的電話號碼，可查詢此工作者的未來預約（不含歷史）。
              </p>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={lookupPhone}
                  onChange={(e) => setLookupPhone(e.target.value)}
                  placeholder="電話（例：0912345678）"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400"
                />
                <button
                  onClick={handleLookup}
                  disabled={!lookupPhone.trim() || lookupLoading}
                  className="px-3 py-2 rounded-lg bg-green-500 text-white text-sm font-semibold disabled:opacity-50 hover:bg-green-600 transition-colors"
                >
                  {lookupLoading ? '查詢中...' : '查詢'}
                </button>
              </div>

              {lookupError ? (
                <p className="text-xs text-red-600">{lookupError}</p>
              ) : null}

              {lookupResults ? (
                lookupResults.length === 0 ? (
                  <p className="text-xs text-gray-500">查無預約</p>
                ) : (
                  <div className="space-y-1">
                    <p className="text-xs text-gray-700 font-semibold">你的未來預約</p>
                    <ul className="text-xs text-gray-700 space-y-1">
                      {lookupResults.map((a, idx) => (
                        <li key={`${a.date}_${a.time}_${idx}`} className="flex items-center justify-between gap-2">
                          <span className="text-gray-700">{a.date}</span>
                          <span className="ml-auto font-medium text-gray-800">{a.time}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-[11px] text-gray-600">
                      如需取消或改期，請聯繫工作者
                      {worker.contact_phone ? (
                        <>
                          ：
                          <a href={`tel:${worker.contact_phone}`} className="text-green-700 font-medium underline">
                            {worker.contact_phone}
                          </a>
                        </>
                      ) : (
                        '（店家若未公開電話，請透過其他管道聯繫）'
                      )}
                      。
                    </p>
                  </div>
                )
              ) : null}
            </div>
          )}

          {availableTimes.length === 0 ? (
            <p className="text-xs text-gray-400">這天未營業或尚未設定營業時間</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {availableTimes.map((t) => {
                const isBooked = bookedSet.has(t)
                return (
                  <button
                    key={t}
                    disabled={isBooked}
                    onClick={() => setPendingBooking({ proposedDate: selectedDate, proposedTime: `${t}:00` })}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      isBooked
                        ? 'border-gray-200 text-gray-300 bg-gray-50 cursor-not-allowed'
                        : 'border-green-300 text-green-700 hover:bg-green-50'
                    }`}
                  >
                    {t}
                  </button>
                )
              })}
            </div>
          )}
          <p className="text-[11px] text-gray-400">也可以直接在下方輸入時間，讓 AI 協助安排。</p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-green-500 text-white rounded-br-sm'
                  : 'bg-white text-gray-800 shadow-sm rounded-bl-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white shadow-sm px-4 py-3 rounded-2xl rounded-bl-sm">
              <div className="flex gap-1">
                {[0, 150, 300].map(delay => (
                  <span
                    key={delay}
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Contact form (shown after time slot confirmed) */}
      {pendingBooking && (
        <div className="bg-white border-t border-gray-100 px-4 py-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">
            確認預約：{formatDateTime(pendingBooking.proposedDate, pendingBooking.proposedTime)}
          </p>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1">
              <label className="block text-[11px] text-gray-500 mb-1">人數</label>
              <input
                type="number"
                min={1}
                max={20}
                value={partySize}
                onChange={(e) => setPartySize(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-400"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] text-gray-500 mb-1">服務項目</label>
              <input
                type="text"
                placeholder="例：洗+剪、凝膠卸甲+手部保養"
                value={serviceItem}
                onChange={(e) => setServiceItem(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-400"
              />
            </div>
          </div>
          <input
            type="text"
            placeholder="您的姓名（例：陳小姐）"
            value={customerName}
            onChange={e => setCustomerName(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-400"
          />
          <input
            type="tel"
            placeholder="聯絡電話（例：0912345678）"
            value={customerPhone}
            onChange={e => setCustomerPhone(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-400"
          />
          <button
            onClick={handleSubmitContact}
            disabled={!partySize.trim() || !serviceItem.trim() || !customerName.trim() || !customerPhone.trim() || isSubmitting}
            className="w-full bg-green-500 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50 hover:bg-green-600 transition-colors"
          >
            {isSubmitting ? '預約中...' : '確認預約'}
          </button>
        </div>
      )}

      {/* Input */}
      {!pendingBooking && (
        <div className="bg-white border-t border-gray-100 px-4 py-3 flex gap-2">
          <input
            type="text"
            placeholder="輸入訊息..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            disabled={isLoading}
            className="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-green-400 disabled:bg-gray-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center disabled:opacity-50 hover:bg-green-600 transition-colors"
          >
            ➤
          </button>
        </div>
      )}

      <AppAlertDialog
        open={noticeDialog !== null}
        title={noticeDialog?.title}
        message={noticeDialog?.message ?? ''}
        onClose={() => setNoticeDialog(null)}
      />
    </div>
  )
}

export default function BookingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400 text-sm">載入中...</p>
      </div>
    }>
      <BookingChat />
    </Suspense>
  )
}

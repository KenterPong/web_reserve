'use client'

import { useState, useEffect } from 'react'
import { Worker } from '@/types'

const BIO_QUESTIONS = [
  { key: 'name', label: '你的名字／稱呼？', placeholder: '例：Jessica、陳師傅' },
  { key: 'profession', label: '你的職業／專長？', placeholder: '例：美甲師、按摩師' },
  { key: 'experience', label: '你有幾年經驗？', placeholder: '例：8 年' },
  { key: 'features', label: '你的服務特色是什麼？', placeholder: '例：日系凝膠、客製化手繪' },
  { key: 'location', label: '你的工作地點在哪裡？', placeholder: '例：台北大安區' },
]

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const DAY_LABELS: Record<string, string> = {
  mon: '週一', tue: '週二', wed: '週三', thu: '週四', fri: '週五', sat: '週六', sun: '週日',
}

export default function ProfilePage() {
  const [worker, setWorker] = useState<Worker | null>(null)
  const [slug, setSlug] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [bookingConfirmationMessage, setBookingConfirmationMessage] = useState('')
  const [bio, setBio] = useState('')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [workingHours, setWorkingHours] = useState<Worker['working_hours'] | null>(null)
  const [slotDuration, setSlotDuration] = useState(60)
  const [isSaving, setIsSaving] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isGeneratingBookingMsg, setIsGeneratingBookingMsg] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [saveMsgType, setSaveMsgType] = useState<'success' | 'error' | ''>('')

  useEffect(() => {
    fetch('/api/appointments?month=2099-01') // Use appointments endpoint just to check auth
      .then(res => {
        if (res.status === 401) window.location.href = '/api/auth/line-bootstrap'
      })

    // Fetch own worker profile
    fetch('/api/workers/me')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data?.worker) return
        const w: Worker = data.worker
        setWorker(w)
        setSlug(w.slug ?? '')
        setBusinessName(w.business_name ?? '')
        setContactPhone(w.contact_phone ?? '')
        setBookingConfirmationMessage(w.booking_confirmation_message ?? '')
        setBio(w.bio ?? '')
        setAnswers((w.bio_answers as Record<string, string>) ?? {})
        setWorkingHours(w.working_hours)
        setSlotDuration(w.slot_duration)
      })
  }, [])

  useEffect(() => {
    if (!saveMsg) return
    const t = window.setTimeout(() => {
      setSaveMsg('')
      setSaveMsgType('')
    }, 2200)
    return () => window.clearTimeout(t)
  }, [saveMsg])

  async function handleSave() {
    setIsSaving(true)
    setSaveMsg('')
    setSaveMsgType('')
    try {
      const res = await fetch('/api/workers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: slug || undefined,
          business_name: businessName || undefined,
          contact_phone: contactPhone.trim() || null,
          booking_confirmation_message: bookingConfirmationMessage.trim() || null,
          bio,
          bio_answers: answers,
          working_hours: workingHours,
          slot_duration: slotDuration,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setSaveMsg('儲存成功')
        setSaveMsgType('success')
        setWorker(data.worker)
      } else {
        setSaveMsg(data.error || '儲存失敗')
        setSaveMsgType('error')
      }
    } finally {
      setIsSaving(false)
    }
  }

  async function handleGenerateBio() {
    setIsGenerating(true)
    try {
      const res = await fetch('/api/generate-bio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      const data = await res.json()
      if (res.ok) setBio(data.bio)
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleGenerateBookingMessage() {
    setIsGeneratingBookingMsg(true)
    try {
      const res = await fetch('/api/generate-booking-message', { method: 'POST' })
      const data = await res.json()
      if (res.ok && typeof data.message === 'string') setBookingConfirmationMessage(data.message)
      else if (!res.ok && data.error) {
        setSaveMsg(data.error)
        setSaveMsgType('error')
      }
    } finally {
      setIsGeneratingBookingMsg(false)
    }
  }

  function toggleDay(day: string) {
    if (!workingHours) return
    setWorkingHours({
      ...workingHours,
      [day]: { ...workingHours[day as keyof typeof workingHours], closed: !workingHours[day as keyof typeof workingHours].closed },
    })
  }

  function updateHours(day: string, field: 'start' | 'end', value: string) {
    if (!workingHours) return
    setWorkingHours({
      ...workingHours,
      [day]: { ...workingHours[day as keyof typeof workingHours], [field]: value },
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {saveMsg ? (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <div
            className={`px-4 py-2 rounded-xl shadow-md text-sm border ${
              saveMsgType === 'success'
                ? 'bg-white text-green-700 border-green-200'
                : 'bg-white text-red-600 border-red-200'
            }`}
          >
            {saveMsg}
          </div>
        </div>
      ) : null}
      <div className="bg-white shadow-sm px-4 py-4 flex items-center gap-3">
        <a href="/dashboard" className="text-green-600 text-sm">← 返回</a>
        <h1 className="text-lg font-bold text-gray-800">個人設定</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Basic info */}
        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-600">基本資料</h2>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">專屬網址（slug）</label>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400">yoursite.com/</span>
              <input
                type="text"
                value={slug}
                onChange={e => setSlug(e.target.value.toLowerCase())}
                placeholder="jessica"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">小寫英數字，3～30 字元</p>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">店家 / 個人名稱</label>
            <input
              type="text"
              value={businessName}
              onChange={e => setBusinessName(e.target.value)}
              placeholder="例：Jessica 美甲工作室"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">顧客聯絡用電話</label>
            <input
              type="tel"
              value={contactPhone}
              onChange={e => setContactPhone(e.target.value)}
              placeholder="例：0912345678（顯示於預約完成頁）"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400"
            />
            <p className="text-xs text-gray-400 mt-1">顧客送出預約申請後會看到此號碼，方便聯繫改期／取消</p>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">預約完成提醒文字</label>
            <p className="text-xs text-gray-400 mb-2">
              顯示於顧客的「預約申請已送出」畫面。未填寫時使用平台預設文案。
            </p>
            <textarea
              value={bookingConfirmationMessage}
              onChange={e => setBookingConfirmationMessage(e.target.value)}
              rows={4}
              placeholder="例：我會在 24 小時內確認您的預約，若有時段調整會主動與您聯繫。"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400 resize-none"
            />
            <button
              type="button"
              onClick={handleGenerateBookingMessage}
              disabled={isGeneratingBookingMsg}
              className="mt-2 w-full border border-green-400 text-green-600 rounded-xl py-2 text-sm hover:bg-green-50 transition-colors disabled:opacity-50"
            >
              {isGeneratingBookingMsg ? 'AI 生成中...' : '✨ AI 幫我生成'}
            </button>
          </div>
        </div>

        {/* Bio */}
        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-600">個人簡介</h2>
          {BIO_QUESTIONS.map(q => (
            <div key={q.key}>
              <label className="text-xs text-gray-500 mb-1 block">{q.label}</label>
              <input
                type="text"
                value={answers[q.key] ?? ''}
                onChange={e => setAnswers(prev => ({ ...prev, [q.key]: e.target.value }))}
                placeholder={q.placeholder}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400"
              />
            </div>
          ))}
          <button
            onClick={handleGenerateBio}
            disabled={isGenerating}
            className="w-full border border-green-400 text-green-600 rounded-xl py-2 text-sm hover:bg-green-50 transition-colors disabled:opacity-50"
          >
            {isGenerating ? 'AI 生成中...' : '✨ AI 自動生成簡介'}
          </button>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">簡介文案（可手動修改）</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              rows={4}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400 resize-none"
            />
          </div>
        </div>

        {/* Working hours */}
        {workingHours && (
          <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-600">營業時間</h2>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">每次服務時長（分鐘）</label>
              <select
                value={slotDuration}
                onChange={e => setSlotDuration(Number(e.target.value))}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400"
              >
                {[30, 45, 60, 90, 120].map(v => (
                  <option key={v} value={v}>{v} 分鐘</option>
                ))}
              </select>
            </div>
            {DAY_KEYS.map(day => {
              const s = workingHours[day]
              return (
                <div key={day} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-8">{DAY_LABELS[day]}</span>
                  <button
                    onClick={() => toggleDay(day)}
                    className={`text-xs px-2 py-1 rounded-full border ${
                      s.closed ? 'border-gray-200 text-gray-400' : 'border-green-400 text-green-600 bg-green-50'
                    }`}
                  >
                    {s.closed ? '公休' : '營業'}
                  </button>
                  {!s.closed && (
                    <>
                      <input
                        type="time"
                        value={s.start}
                        onChange={e => updateHours(day, 'start', e.target.value)}
                        className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-green-400"
                      />
                      <span className="text-gray-400 text-xs">～</span>
                      <input
                        type="time"
                        value={s.end}
                        onChange={e => updateHours(day, 'end', e.target.value)}
                        className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-green-400"
                      />
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full bg-green-500 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50 hover:bg-green-600 transition-colors"
        >
          {isSaving ? '儲存中...' : '儲存設定'}
        </button>
      </div>
    </div>
  )
}

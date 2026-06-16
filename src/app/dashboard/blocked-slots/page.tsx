'use client'

import { useState, useEffect, type FormEvent } from 'react'
import type { BlockedSlot } from '@/types'
import { MIN_REFERRALS_BLOCKED_SLOTS } from '@/lib/blocked-slots'
import { taipeiTodayYmd } from '@/lib/datetime-taipei'

export default function BlockedSlotsPage() {
  const [referralCount, setReferralCount] = useState(0)
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([])
  const [blockedMonth, setBlockedMonth] = useState(() => taipeiTodayYmd().slice(0, 7))
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [bsDate, setBsDate] = useState(() => taipeiTodayYmd())
  const [bsStart, setBsStart] = useState('10:00')
  const [bsEnd, setBsEnd] = useState('11:00')
  const [bsNote, setBsNote] = useState('')
  const [bsSaving, setBsSaving] = useState(false)
  const [bsMsg, setBsMsg] = useState('')
  const [bsMsgType, setBsMsgType] = useState<'success' | 'error' | ''>('')

  const unlocked = referralCount >= MIN_REFERRALS_BLOCKED_SLOTS

  useEffect(() => {
    fetch('/api/workers/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setReferralCount(Number(data?.worker?.referral_count ?? 0))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!unlocked) {
      setLoading(false)
      setBlockedSlots([])
      return
    }
    setLoading(true)
    setListError('')
    fetch(`/api/blocked-slots?month=${encodeURIComponent(blockedMonth)}`)
      .then(async (r) => {
        if (r.status === 401) {
          window.location.href = '/api/auth/line-bootstrap'
          return null
        }
        const data = await r.json().catch(() => ({}))
        if (!r.ok) {
          setListError(data.error || '無法載入封鎖時段')
          return null
        }
        return data
      })
      .then((data) => {
        if (data?.blockedSlots) setBlockedSlots(data.blockedSlots)
      })
      .catch(() => setListError('無法載入封鎖時段'))
      .finally(() => setLoading(false))
  }, [unlocked, blockedMonth])

  useEffect(() => {
    if (!bsMsg) return
    const t = window.setTimeout(() => {
      setBsMsg('')
      setBsMsgType('')
    }, 2400)
    return () => window.clearTimeout(t)
  }, [bsMsg])

  function shiftBlockedMonth(delta: number) {
    const [y, m] = blockedMonth.split('-').map(Number)
    const d = new Date(y, (m || 1) - 1 + delta, 1)
    const ny = d.getFullYear()
    const nm = String(d.getMonth() + 1).padStart(2, '0')
    setBlockedMonth(`${ny}-${nm}`)
  }

  async function handleAddBlockedSlot(e: FormEvent) {
    e.preventDefault()
    setBsSaving(true)
    setBsMsg('')
    setBsMsgType('')
    try {
      const res = await fetch('/api/blocked-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blocked_date: bsDate,
          start_time: bsStart,
          end_time: bsEnd,
          note: bsNote.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setBsMsg(data.error || '新增失敗')
        setBsMsgType('error')
        return
      }
      setBsMsg('已新增封鎖時段')
      setBsMsgType('success')
      setBsNote('')
      const ym = bsDate.slice(0, 7)
      if (ym !== blockedMonth) setBlockedMonth(ym)
      const g = await fetch(`/api/blocked-slots?month=${encodeURIComponent(ym)}`)
      const gj = g.ok ? await g.json() : {}
      setBlockedSlots((gj?.blockedSlots as BlockedSlot[]) ?? [])
    } finally {
      setBsSaving(false)
    }
  }

  async function handleDeleteBlockedSlot(id: string) {
    setBsMsg('')
    setBsMsgType('')
    const res = await fetch(`/api/blocked-slots/${encodeURIComponent(id)}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setBsMsg(data.error || '刪除失敗')
      setBsMsgType('error')
      return
    }
    setBsMsg('已刪除')
    setBsMsgType('success')
    const g = await fetch(`/api/blocked-slots?month=${encodeURIComponent(blockedMonth)}`)
    const gj = g.ok ? await g.json() : {}
    setBlockedSlots((gj?.blockedSlots as BlockedSlot[]) ?? [])
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {bsMsg ? (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <div
            className={`px-4 py-2 rounded-xl shadow-md text-sm border ${
              bsMsgType === 'success'
                ? 'bg-white text-green-700 border-green-200'
                : 'bg-white text-red-600 border-red-200'
            }`}
          >
            {bsMsg}
          </div>
        </div>
      ) : null}

      <div className="bg-white shadow-sm px-4 py-4 flex items-center gap-3">
        <a href="/dashboard/appointments" className="text-green-600 text-sm">
          ← 返回行事曆
        </a>
        <h1 className="text-lg font-bold text-gray-800">封鎖時段</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {!unlocked ? (
          <div className="bg-white rounded-2xl shadow-sm p-5 text-sm text-gray-600">
            <p className="font-medium text-gray-800">封鎖時段功能尚未解鎖</p>
            <p className="mt-2 text-xs text-gray-500">
              推薦滿 {MIN_REFERRALS_BLOCKED_SLOTS} 位設計師加入後即可設定不可預約的時段。請從行事曆頁複製推薦連結分享給其他人。
            </p>
          </div>
        ) : (
          <>
            {listError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {listError}
              </div>
            ) : null}

            <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
              <p className="text-xs text-gray-500 leading-relaxed">
                在<strong>已營業</strong>的某一天內，指定連續時段不接受預約（顧客選時段時會與已預約一併顯示為不可選）。區間須完全落在該日營業時間內。
              </p>

              <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-3">
                <button
                  type="button"
                  onClick={() => shiftBlockedMonth(-1)}
                  className="text-sm text-green-600 hover:text-green-700"
                >
                  ‹ 上個月
                </button>
                <input
                  type="month"
                  value={blockedMonth}
                  onChange={(e) => setBlockedMonth(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-700"
                />
                <button
                  type="button"
                  onClick={() => shiftBlockedMonth(1)}
                  className="text-sm text-green-600 hover:text-green-700"
                >
                  下個月 ›
                </button>
              </div>

              {loading ? (
                <p className="text-sm text-gray-500">載入中…</p>
              ) : blockedSlots.length === 0 ? (
                <p className="text-xs text-gray-500">這個月尚無封鎖時段。</p>
              ) : (
                <ul className="divide-y divide-gray-100 text-sm">
                  {blockedSlots.map((row) => (
                    <li key={row.id} className="py-2 flex justify-between gap-2 items-start">
                      <div>
                        <p className="font-medium text-gray-800">{row.blocked_date}</p>
                        <p className="text-xs text-gray-600">
                          {String(row.start_time).slice(0, 5)}～{String(row.end_time).slice(0, 5)}
                        </p>
                        {row.note ? <p className="text-xs text-gray-400 mt-0.5">{row.note}</p> : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleDeleteBlockedSlot(row.id)}
                        className="text-xs text-red-600 shrink-0 hover:underline"
                      >
                        刪除
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
              <h2 className="text-sm font-semibold text-gray-600">新增封鎖時段</h2>
              <form onSubmit={handleAddBlockedSlot} className="space-y-2">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">日期</label>
                  <input
                    type="date"
                    value={bsDate}
                    onChange={(e) => setBsDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-green-400"
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 block mb-1">開始</label>
                    <input
                      type="time"
                      value={bsStart}
                      onChange={(e) => setBsStart(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-green-400"
                      required
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 block mb-1">結束</label>
                    <input
                      type="time"
                      value={bsEnd}
                      onChange={(e) => setBsEnd(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-green-400"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">備註（選填）</label>
                  <input
                    value={bsNote}
                    onChange={(e) => setBsNote(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-green-400"
                    placeholder="例：外出看診"
                  />
                </div>
                <button
                  type="submit"
                  disabled={bsSaving}
                  className="w-full border border-gray-900 text-gray-900 rounded-xl py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
                >
                  {bsSaving ? '儲存中…' : '新增封鎖時段'}
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

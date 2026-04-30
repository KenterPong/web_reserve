'use client'

import { useEffect, useState } from 'react'

type Insights = {
  period: {
    today: string
    currentMonthStart: string
    lastMonthStart: string
  }
  month: {
    currentTotal: number
    lastTotal: number
    delta: number
    deltaPct: number | null
    status: Record<'confirmed' | 'completed' | 'cancelled' | 'no_show', number>
    busiest: {
      weekday: { weekday: string; count: number } | null
      hour: { hour: string; count: number } | null
    }
    customers: {
      newCustomers: number
      returningCustomers: number
    }
  }
  sleepingCustomers: Array<{ phone: string; lastDate: string }>
}

function pctText(v: number | null): string {
  if (v === null) return '—'
  const sign = v > 0 ? '+' : ''
  return `${sign}${v.toFixed(0)}%`
}

export default function InsightsPage() {
  const [data, setData] = useState<Insights | null>(null)
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/insights')
      .then(async (res) => {
        const j = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(j?.error || `讀取失敗（HTTP ${res.status}）`)
        return j as Insights
      })
      .then((j) => setData(j))
      .catch((e) => setError(e?.message || '讀取失敗'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm px-4 py-4 flex items-center gap-3">
          <a href="/dashboard/appointments" className="text-green-600 text-sm">← 返回</a>
          <h1 className="text-lg font-bold text-gray-800">數據洞察</h1>
        </div>
        <div className="max-w-lg mx-auto px-4 py-6 text-sm text-gray-400">載入中...</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm px-4 py-4 flex items-center gap-3">
          <a href="/dashboard/appointments" className="text-green-600 text-sm">← 返回</a>
          <h1 className="text-lg font-bold text-gray-800">數據洞察</h1>
        </div>
        <div className="max-w-lg mx-auto px-4 py-6">
          <p className="text-sm text-red-500">{error || '讀取失敗'}</p>
        </div>
      </div>
    )
  }

  const m = data.month

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/dashboard/appointments" className="text-green-600 text-sm">← 返回</a>
          <div>
            <h1 className="text-lg font-bold text-gray-800">數據洞察</h1>
            <p className="text-xs text-gray-400">本月（{data.period.currentMonthStart} 起）</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="text-sm text-green-600 hover:text-green-700"
        >
          重新整理
        </button>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-500">本月預約總數</p>
            <p className="mt-2 text-3xl font-bold text-gray-800">{m.currentTotal}</p>
            <p className="mt-1 text-xs text-gray-400">上月 {m.lastTotal}（{pctText(m.deltaPct)}）</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-500">新客 / 回頭客</p>
            <p className="mt-2 text-xl font-bold text-gray-800">
              {m.customers.newCustomers} / {m.customers.returningCustomers}
            </p>
            <p className="mt-1 text-xs text-gray-400">以本月出現過的電話去重計算</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-500 mb-3">本月狀態分佈</p>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <p className="text-xl font-bold text-green-600">{m.status.confirmed}</p>
              <p className="text-xs text-gray-400">已確認</p>
            </div>
            <div>
              <p className="text-xl font-bold text-blue-600">{m.status.completed}</p>
              <p className="text-xs text-gray-400">已完成</p>
            </div>
            <div>
              <p className="text-xl font-bold text-gray-400">{m.status.cancelled}</p>
              <p className="text-xs text-gray-400">已取消</p>
            </div>
            <div>
              <p className="text-xl font-bold text-orange-500">{m.status.no_show}</p>
              <p className="text-xs text-gray-400">未出現</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-500 mb-2">最忙時段</p>
          <div className="text-sm text-gray-700 space-y-1">
            <p>
              週幾：{m.busiest.weekday ? `週${m.busiest.weekday.weekday}（${m.busiest.weekday.count} 筆）` : '—'}
            </p>
            <p>
              幾點：{m.busiest.hour ? `${m.busiest.hour.hour}:00（${m.busiest.hour.count} 筆）` : '—'}
            </p>
            <p className="text-xs text-gray-400">以本月「已確認」預約統計</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500">沉睡顧客（60 天未預約）</p>
            <p className="text-[11px] text-gray-400">最多顯示 50 筆</p>
          </div>
          {data.sleepingCustomers.length === 0 ? (
            <p className="mt-3 text-sm text-gray-400">目前沒有</p>
          ) : (
            <div className="mt-3 space-y-2">
              {data.sleepingCustomers.map((c) => (
                <div key={c.phone} className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2">
                  <p className="text-sm text-gray-800 font-medium">{c.phone}</p>
                  <p className="text-xs text-gray-400">最後：{c.lastDate}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


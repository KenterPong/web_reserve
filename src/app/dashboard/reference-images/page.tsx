'use client'

import { useState, useEffect } from 'react'
import type { Appointment, Worker } from '@/types'
import { AppAlertDialog } from '@/components/AppDialog'

const MIN_REFERRALS = 10

export default function ReferenceImagesPage() {
  const [referralCount, setReferralCount] = useState(0)
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    return `${y}-${m}`
  })
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [imageAlert, setImageAlert] = useState<string | null>(null)

  const unlocked = referralCount >= MIN_REFERRALS

  useEffect(() => {
    fetch('/api/workers/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const w = data?.worker as Worker | undefined
        setReferralCount(Number(w?.referral_count ?? 0))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!unlocked) {
      setLoading(false)
      setAppointments([])
      return
    }
    setLoading(true)
    fetch(`/api/appointments?month=${encodeURIComponent(currentMonth)}`)
      .then((r) => {
        if (r.status === 401) {
          window.location.href = '/api/auth/line-bootstrap'
          return null
        }
        return r.json()
      })
      .then((data) => {
        setAppointments((data?.appointments as Appointment[]) ?? [])
      })
      .catch(() => setAppointments([]))
      .finally(() => setLoading(false))
  }, [unlocked, currentMonth])

  const withImage = appointments.filter((a) => Boolean(a.reference_image_url?.trim()))

  async function openReferenceImage(appointmentId: string) {
    try {
      const res = await fetch(
        `/api/reference-image/signed?appointmentId=${encodeURIComponent(appointmentId)}`,
      )
      const data = await res.json()
      if (!res.ok) {
        setImageAlert(data?.error || '取得參考圖失敗')
        return
      }
      if (data?.url) window.open(String(data.url), '_blank', 'noopener,noreferrer')
    } catch {
      setImageAlert('取得參考圖失敗')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm px-4 py-4 flex items-center gap-3">
        <a href="/dashboard/appointments" className="text-green-600 text-sm">
          ← 返回行事曆
        </a>
        <h1 className="text-lg font-bold text-gray-800">參考圖</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {!unlocked ? (
          <div className="bg-white rounded-2xl shadow-sm p-5 text-sm text-gray-600">
            <p className="font-medium text-gray-800">參考圖功能尚未解鎖</p>
            <p className="mt-2 text-xs text-gray-500">
              推薦滿 {MIN_REFERRALS} 位設計師加入後，顧客即可在「預約完成頁」上傳一張參考圖（jpg／png，5MB
              以內）。請從行事曆頁複製推薦連結分享給其他人。
            </p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3 text-sm text-gray-600">
              <h2 className="text-sm font-semibold text-gray-600">顧客如何上傳</h2>
              <p>
                顧客送出預約後，在<strong>同一頁的預約完成畫面</strong>可選擇上傳一張參考圖（選填）。上傳成功後，你可在下方列表或行事曆的該筆預約旁點「查看參考圖」。
              </p>
              <p className="text-xs text-gray-500">格式：JPEG／PNG，單檔不超過 5MB。若重新上傳會覆蓋舊檔。</p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-gray-600">已有參考圖的預約</h2>
                <input
                  type="month"
                  value={currentMonth}
                  onChange={(e) => setCurrentMonth(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-700"
                />
              </div>
              {loading ? (
                <p className="text-sm text-gray-500">載入中…</p>
              ) : withImage.length === 0 ? (
                <p className="text-sm text-gray-500">這個月尚無已上傳參考圖的預約。</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {withImage.map((a) => (
                    <li key={a.id} className="py-3 flex items-start justify-between gap-3 first:pt-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800">
                          {a.appointment_date}{' '}
                          {String(a.appointment_time).slice(0, 5)}・{a.customer_name}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{a.customer_phone}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openReferenceImage(a.id)}
                        className="shrink-0 text-xs text-green-600 hover:text-green-700 font-medium"
                      >
                        查看
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p className="text-[11px] text-center text-gray-400 px-2">
              Supabase 需建立 Private bucket「reference-images」，詳見專案 README。
            </p>
          </>
        )}
      </div>

      <AppAlertDialog
        open={imageAlert !== null}
        title="參考圖"
        message={imageAlert ?? ''}
        onClose={() => setImageAlert(null)}
      />
    </div>
  )
}

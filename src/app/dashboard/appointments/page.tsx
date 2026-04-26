'use client'

import { useState, useEffect } from 'react'
import { Appointment } from '@/types'

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
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [isLoading, setIsLoading] = useState(true)
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

  useEffect(() => { fetchAppointments() }, [currentMonth])

  async function fetchAppointments() {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/appointments?month=${currentMonth}`)
      if (res.status === 401) { window.location.href = '/auth/login'; return }
      const data = await res.json()
      setAppointments(data.appointments ?? [])
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/appointments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    fetchAppointments()
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm px-4 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold text-gray-800">預約管理</h1>
          <p className="text-xs text-gray-400">點選日期查看預約</p>
        </div>
        <a href="/dashboard/profile" className="text-sm text-green-600">設定</a>
      </div>

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
                    </div>

                    {apt.status === 'confirmed' && (
                      <div className="flex flex-col gap-1 ml-2 shrink-0">
                        <button
                          onClick={() => updateStatus(apt.id, 'completed')}
                          className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-lg hover:bg-blue-100"
                        >
                          完成
                        </button>
                        <button
                          onClick={() => updateStatus(apt.id, 'no_show')}
                          className="text-xs bg-orange-50 text-orange-500 px-3 py-1 rounded-lg hover:bg-orange-100"
                        >
                          未到
                        </button>
                        <button
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

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Status = 'confirmed' | 'completed' | 'cancelled' | 'no_show'

function taipeiYmd(d = new Date()): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
}

function addDaysYmd(ymd: string, days: number): string {
  const t = new Date(`${ymd}T00:00:00+08:00`)
  t.setDate(t.getDate() + days)
  return taipeiYmd(t)
}

function monthStartYmd(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`
}

function prevMonthStartYmd(ymd: string): string {
  const [y, m] = ymd.slice(0, 7).split('-').map(Number)
  const d = new Date(y, (m || 1) - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function nextMonthStartYmd(ymd: string): string {
  const [y, m] = ymd.slice(0, 7).split('-').map(Number)
  const d = new Date(y, (m || 1), 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function weekdayZhFromYmd(dateStr: string): string {
  const day = new Date(`${dateStr}T00:00:00+08:00`).getDay()
  return ['日', '一', '二', '三', '四', '五', '六'][day] ?? ''
}

export async function GET(req: NextRequest) {
  try {
    const workerId = req.cookies.get('worker_id')?.value
    if (!workerId) {
      return NextResponse.json({ error: '未登入' }, { status: 401 })
    }

    const today = taipeiYmd()
    const currentMonthStart = monthStartYmd(today)
    const nextMonthStart = nextMonthStartYmd(today)
    const lastMonthStart = prevMonthStartYmd(today)
    const lastMonthNextStart = currentMonthStart

    const { data: currentMonthAppts, error: curErr } = await supabaseAdmin
      .from('appointments')
      .select('appointment_date, appointment_time, status, customer_phone')
      .eq('worker_id', workerId)
      .gte('appointment_date', currentMonthStart)
      .lt('appointment_date', nextMonthStart)

    if (curErr) {
      return NextResponse.json({ error: '取得本月資料失敗', details: curErr }, { status: 500 })
    }

    const { data: lastMonthAppts, error: lastErr } = await supabaseAdmin
      .from('appointments')
      .select('appointment_date, appointment_time, status, customer_phone')
      .eq('worker_id', workerId)
      .gte('appointment_date', lastMonthStart)
      .lt('appointment_date', lastMonthNextStart)

    if (lastErr) {
      return NextResponse.json({ error: '取得上月資料失敗', details: lastErr }, { status: 500 })
    }

    // For retention/sleeping customers: last 365 days
    const since = addDaysYmd(today, -365)
    const { data: recentYear, error: yearErr } = await supabaseAdmin
      .from('appointments')
      .select('appointment_date, status, customer_phone')
      .eq('worker_id', workerId)
      .gte('appointment_date', since)

    if (yearErr) {
      return NextResponse.json({ error: '取得歷史資料失敗', details: yearErr }, { status: 500 })
    }

    const cur = currentMonthAppts ?? []
    const last = lastMonthAppts ?? []
    const all = recentYear ?? []

    const statusCounts = (rows: any[]) => {
      const init: Record<Status, number> = { confirmed: 0, completed: 0, cancelled: 0, no_show: 0 }
      for (const r of rows) {
        const s = String(r.status) as Status
        if (s in init) init[s] += 1
      }
      return init
    }

    const currentTotal = cur.length
    const lastTotal = last.length
    const delta = currentTotal - lastTotal
    const deltaPct = lastTotal > 0 ? (delta / lastTotal) * 100 : null

    const currentStatus = statusCounts(cur)

    // Busiest: weekday + hour buckets, using confirmed appointments
    const busiestWeekday: Record<string, number> = {}
    const busiestHour: Record<string, number> = {}
    for (const r of cur) {
      if (String(r.status) !== 'confirmed') continue
      const wd = weekdayZhFromYmd(String(r.appointment_date))
      busiestWeekday[wd] = (busiestWeekday[wd] ?? 0) + 1
      const hh = String(r.appointment_time).slice(0, 2)
      busiestHour[hh] = (busiestHour[hh] ?? 0) + 1
    }
    const topEntry = (m: Record<string, number>) =>
      Object.entries(m).sort((a, b) => b[1] - a[1])[0] ?? null

    const topWeekday = topEntry(busiestWeekday)
    const topHour = topEntry(busiestHour)

    // New vs returning (based on first seen date within last 365d)
    const firstSeenByPhone = new Map<string, string>()
    for (const r of all) {
      const phone = String(r.customer_phone ?? '')
      const date = String(r.appointment_date ?? '')
      if (!phone || !date) continue
      const prev = firstSeenByPhone.get(phone)
      if (!prev || date < prev) firstSeenByPhone.set(phone, date)
    }
    let newCustomers = 0
    let returningCustomers = 0
    const seenThisMonth = new Set<string>()
    for (const r of cur) {
      const phone = String(r.customer_phone ?? '')
      if (!phone || seenThisMonth.has(phone)) continue
      seenThisMonth.add(phone)
      const first = firstSeenByPhone.get(phone)
      if (!first) continue
      if (first >= currentMonthStart) newCustomers += 1
      else returningCustomers += 1
    }

    // Sleeping customers: no confirmed/completed appointment for >=60 days (within last year)
    const lastActiveByPhone = new Map<string, string>()
    for (const r of all) {
      const s = String(r.status)
      if (s !== 'confirmed' && s !== 'completed') continue
      const phone = String(r.customer_phone ?? '')
      const date = String(r.appointment_date ?? '')
      if (!phone || !date) continue
      const prev = lastActiveByPhone.get(phone)
      if (!prev || date > prev) lastActiveByPhone.set(phone, date)
    }
    const sleepThreshold = addDaysYmd(today, -60)
    const sleepingPhones = Array.from(lastActiveByPhone.entries())
      .filter(([, lastDate]) => lastDate < sleepThreshold)
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([phone, lastDate]) => ({ phone, lastDate }))

    return NextResponse.json({
      period: { today, currentMonthStart, lastMonthStart },
      month: {
        currentTotal,
        lastTotal,
        delta,
        deltaPct,
        status: currentStatus,
        busiest: {
          weekday: topWeekday ? { weekday: topWeekday[0], count: topWeekday[1] } : null,
          hour: topHour ? { hour: topHour[0], count: topHour[1] } : null,
        },
        customers: {
          newCustomers,
          returningCustomers,
        },
      },
      sleepingCustomers: sleepingPhones.slice(0, 50),
    })
  } catch (error) {
    console.error('Insights error:', error)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}


import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { dayKeyForDateTaipei } from '@/lib/datetime-taipei'
import { requireBlockedSlotsFeature } from '@/lib/blocked-slots-access'
import { timeStrToMinutes, rangesOverlap } from '@/lib/blocked-slots'

function parseBodyTimes(body: {
  blocked_date?: string
  start_time?: string
  end_time?: string
  note?: string | null
}): { blocked_date: string; start_time: string; end_time: string; note: string | null } | null {
  const blocked_date = String(body?.blocked_date ?? '').trim()
  const start_time = String(body?.start_time ?? '').trim()
  const end_time = String(body?.end_time ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(blocked_date)) return null
  if (!start_time || !end_time) return null
  return {
    blocked_date,
    start_time: start_time.length >= 5 ? start_time.slice(0, 5) : start_time,
    end_time: end_time.length >= 5 ? end_time.slice(0, 5) : end_time,
    note: body?.note != null && String(body.note).trim() ? String(body.note).trim().slice(0, 500) : null,
  }
}

// GET /api/blocked-slots — list own blocked ranges (requires login + unlock)
export async function GET(req: NextRequest) {
  const workerId = req.cookies.get('worker_id')?.value
  if (!workerId) {
    return NextResponse.json({ error: '未登入' }, { status: 401 })
  }

  const denied = await requireBlockedSlotsFeature(workerId)
  if (denied) return denied

  const month = req.nextUrl.searchParams.get('month') // optional YYYY-MM

  let q = supabaseAdmin
    .from('blocked_slots')
    .select('id,worker_id,blocked_date,start_time,end_time,note,created_at')
    .eq('worker_id', workerId)
    .order('blocked_date', { ascending: true })
    .order('start_time', { ascending: true })

  if (month) {
    const [y, m] = month.split('-').map(Number)
    if (!y || !m) {
      return NextResponse.json({ error: 'month 格式錯誤，應為 YYYY-MM' }, { status: 400 })
    }
    const monthStart = `${month}-01`
    const nextMonthStart = new Date(y, m, 1).toISOString().slice(0, 10)
    q = q.gte('blocked_date', monthStart).lt('blocked_date', nextMonthStart)
  }

  const { data, error } = await q

  if (error) {
    console.error('[blocked-slots GET]', error)
    return NextResponse.json({ error: '讀取封鎖時段失敗', details: error.message }, { status: 500 })
  }

  return NextResponse.json({ blockedSlots: data ?? [] })
}

// POST /api/blocked-slots — create (requires login + unlock)
export async function POST(req: NextRequest) {
  const workerId = req.cookies.get('worker_id')?.value
  if (!workerId) {
    return NextResponse.json({ error: '未登入' }, { status: 401 })
  }

  const denied = await requireBlockedSlotsFeature(workerId)
  if (denied) return denied

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '無效的 JSON' }, { status: 400 })
  }

  const parsed = parseBodyTimes((body ?? {}) as Record<string, unknown>)
  if (!parsed) {
    return NextResponse.json({ error: 'blocked_date（YYYY-MM-DD）、start_time、end_time 為必填' }, { status: 400 })
  }

  const startMin = timeStrToMinutes(parsed.start_time)
  const endMin = timeStrToMinutes(parsed.end_time)
  if (!(startMin < endMin)) {
    return NextResponse.json({ error: '結束時間必須晚於開始時間' }, { status: 400 })
  }

  const { data: worker } = await supabaseAdmin
    .from('workers')
    .select('working_hours, working_hours_exceptions')
    .eq('id', workerId)
    .single()

  if (!worker) {
    return NextResponse.json({ error: '找不到工作者' }, { status: 404 })
  }

  const exceptions = (worker.working_hours_exceptions ?? {}) as Record<string, boolean>
  if (exceptions[parsed.blocked_date]) {
    return NextResponse.json({ error: '該日為公休，無需封鎖時段' }, { status: 400 })
  }

  const dayKey = dayKeyForDateTaipei(parsed.blocked_date)
  const schedule = (worker.working_hours as Record<string, { start: string; end: string; closed: boolean }> | null)?.[
    dayKey
  ]
  if (!schedule || schedule.closed) {
    return NextResponse.json({ error: '該日未營業，無法設定封鎖時段' }, { status: 400 })
  }

  const bizStart = timeStrToMinutes(schedule.start)
  const bizEnd = timeStrToMinutes(schedule.end)
  if (startMin < bizStart || endMin > bizEnd) {
    return NextResponse.json({ error: '封鎖時段必須落在當日營業時間內' }, { status: 400 })
  }

  const { data: existing } = await supabaseAdmin
    .from('blocked_slots')
    .select('start_time,end_time')
    .eq('worker_id', workerId)
    .eq('blocked_date', parsed.blocked_date)

  for (const row of existing ?? []) {
    const a = timeStrToMinutes(String(row.start_time))
    const b = timeStrToMinutes(String(row.end_time))
    if (rangesOverlap(startMin, endMin, a, b)) {
      return NextResponse.json({ error: '與既有封鎖時段重疊，請調整或先刪除舊資料' }, { status: 409 })
    }
  }

  const { data: created, error } = await supabaseAdmin
    .from('blocked_slots')
    .insert({
      worker_id: workerId,
      blocked_date: parsed.blocked_date,
      start_time: `${parsed.start_time}:00`,
      end_time: `${parsed.end_time}:00`,
      note: parsed.note,
    })
    .select('id,worker_id,blocked_date,start_time,end_time,note,created_at')
    .single()

  if (error) {
    console.error('[blocked-slots POST]', error)
    return NextResponse.json({ error: '新增失敗', details: error.message }, { status: 500 })
  }

  return NextResponse.json({ blockedSlot: created }, { status: 201 })
}

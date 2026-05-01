import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { dayKeyForDateTaipei } from '@/lib/datetime-taipei'

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  confirmed: ['completed', 'cancelled', 'no_show'],
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

function normalizeTimeForDb(t: string): string {
  const hhmm = String(t).slice(0, 5)
  return `${hhmm}:00`
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const workerId = req.cookies.get('worker_id')?.value
  if (!workerId) {
    return NextResponse.json({ error: '未登入' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const status = body.status as string | undefined
  const newDate = body.appointment_date as string | undefined
  const newTimeRaw = body.appointment_time as string | undefined
  const partySizeRaw = body.party_size
  const serviceItemRaw = body.service_item

  const hasReschedule =
    typeof newDate === 'string' &&
    newDate.trim() !== '' &&
    typeof newTimeRaw === 'string' &&
    newTimeRaw.trim() !== ''
  const hasStatus = typeof status === 'string' && status.trim() !== ''

  if (hasReschedule && hasStatus) {
    return NextResponse.json({ error: '請分開更新狀態與改期' }, { status: 400 })
  }
  if (!hasReschedule && !hasStatus) {
    return NextResponse.json({ error: '缺少 status 或改期欄位（appointment_date、appointment_time）' }, { status: 400 })
  }

  const { data: appointment, error: fetchErr } = await supabaseAdmin
    .from('appointments')
    .select('*')
    .eq('id', params.id)
    .single()

  if (fetchErr || !appointment) {
    return NextResponse.json({ error: '找不到預約' }, { status: 404 })
  }

  if (appointment.worker_id !== workerId) {
    return NextResponse.json({ error: '無權限' }, { status: 403 })
  }

  if (hasStatus) {
    const allowed = ALLOWED_TRANSITIONS[appointment.status] ?? []
    if (!allowed.includes(status)) {
      return NextResponse.json(
        { error: `狀態 ${appointment.status} 無法轉換為 ${status}` },
        { status: 400 },
      )
    }

    const { data, error } = await supabaseAdmin
      .from('appointments')
      .update({ status })
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: '更新失敗' }, { status: 500 })
    }

    return NextResponse.json({ appointment: data })
  }

  // —— 後台改期（僅 confirmed）——
  if (appointment.status !== 'confirmed') {
    return NextResponse.json({ error: '僅已確認的預約可改期' }, { status: 400 })
  }

  const dateStr = String(newDate).trim()
  const hhmm = String(newTimeRaw).slice(0, 5)
  const timeForDb = normalizeTimeForDb(hhmm)

  const sameSlot =
    appointment.appointment_date === dateStr &&
    String(appointment.appointment_time ?? '').slice(0, 5) === hhmm
  if (sameSlot) {
    return NextResponse.json({ appointment })
  }

  const { data: worker, error: workerErr } = await supabaseAdmin
    .from('workers')
    .select('id, is_active, slot_duration, working_hours, working_hours_exceptions')
    .eq('id', workerId)
    .eq('is_active', true)
    .single()

  if (workerErr || !worker) {
    return NextResponse.json({ error: '找不到工作者' }, { status: 404 })
  }

  const exceptions = (worker.working_hours_exceptions ?? {}) as Record<string, boolean>
  if (exceptions[dateStr]) {
    return NextResponse.json({ error: '此日期為公休，請選擇其他時間' }, { status: 400 })
  }

  const duration = Number(worker.slot_duration ?? 60)
  const dayKey = dayKeyForDateTaipei(dateStr)
  const schedule = (worker.working_hours as Record<string, { start: string; end: string; closed: boolean }> | null)?.[
    dayKey
  ]
  if (!schedule || schedule.closed) {
    return NextResponse.json({ error: '此日期未營業，請選擇其他時間' }, { status: 400 })
  }

  const start = toMinutes(schedule.start)
  const end = toMinutes(schedule.end)
  const requested = toMinutes(hhmm)
  if (requested < start || requested + duration > end) {
    return NextResponse.json({ error: '此時間不在營業時段內' }, { status: 400 })
  }
  if ((requested - start) % duration !== 0) {
    return NextResponse.json({ error: `請選擇每 ${duration} 分鐘為間隔的時段` }, { status: 400 })
  }

  const apptAt = new Date(`${dateStr}T${hhmm}:00+08:00`).getTime()
  if (!Number.isFinite(apptAt)) {
    return NextResponse.json({ error: '改期時間格式錯誤' }, { status: 400 })
  }
  if (apptAt <= Date.now()) {
    return NextResponse.json({ error: '改期後的時間須為未來時段' }, { status: 400 })
  }

  const { data: conflict } = await supabaseAdmin
    .from('appointments')
    .select('id')
    .eq('worker_id', workerId)
    .eq('appointment_date', dateStr)
    .eq('appointment_time', timeForDb)
    .eq('status', 'confirmed')
    .neq('id', params.id)
    .maybeSingle()

  if (conflict?.id) {
    return NextResponse.json({ error: '此時段已有其他確認中預約，請選擇其他時間' }, { status: 409 })
  }

  const updates: Record<string, unknown> = {
    appointment_date: dateStr,
    appointment_time: timeForDb,
  }

  if (partySizeRaw !== undefined) {
    const n = Number(partySizeRaw)
    if (!Number.isFinite(n) || n < 1 || n > 20) {
      return NextResponse.json({ error: '人數格式不正確（1～20）' }, { status: 400 })
    }
    updates.party_size = n
  }

  if (serviceItemRaw !== undefined) {
    const s = String(serviceItemRaw ?? '').trim()
    if (!s) {
      return NextResponse.json({ error: '服務項目不可為空白' }, { status: 400 })
    }
    updates.service_item = s
  }

  const { data, error } = await supabaseAdmin
    .from('appointments')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: '此時段已被預約，請選擇其他時間' }, { status: 409 })
    }
    return NextResponse.json({ error: '改期失敗', details: error }, { status: 500 })
  }

  return NextResponse.json({ appointment: data })
}

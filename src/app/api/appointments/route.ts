import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { validatePhone, getClientIp } from '@/lib/utils'
import { dayKeyForDateTaipei } from '@/lib/datetime-taipei'
import { checkRateLimit } from '@/lib/rate-limit'

const MIN_LEAD_TIME_MS = 2 * 60 * 60 * 1000

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

// GET /api/appointments — worker reads their own appointments (requires cookie)
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl

  // Public availability query: GET /api/appointments?workerId=...&date=YYYY-MM-DD
  const publicWorkerId = searchParams.get('workerId')
  const publicDate = searchParams.get('date')
  const excludeManageToken = searchParams.get('excludeManageToken')
  if (publicWorkerId && publicDate) {
    const { data, error } = await supabaseAdmin
      .from('appointments')
      .select('appointment_time,status')
      .eq('worker_id', publicWorkerId)
      .eq('appointment_date', publicDate)

    if (error) {
      return NextResponse.json({ error: '取得可預約時段失敗', details: error }, { status: 500 })
    }

    const bookedTimes = (data ?? [])
      .filter((a) => a.status === 'confirmed')
      .map((a) => a.appointment_time)

    // When rescheduling, allow keeping the original slot without marking it as booked
    if (excludeManageToken) {
      const { data: current } = await supabaseAdmin
        .from('appointments')
        .select('appointment_date,appointment_time')
        .eq('manage_token', excludeManageToken)
        .single()
      if (current?.appointment_date === publicDate && current?.appointment_time) {
        const keep = String(current.appointment_time)
        return NextResponse.json({ bookedTimes: bookedTimes.filter((t) => t !== keep) })
      }
    }

    return NextResponse.json({ bookedTimes })
  }

  const workerId = req.cookies.get('worker_id')?.value
  if (!workerId) {
    return NextResponse.json({ error: '未登入' }, { status: 401 })
  }

  const month = searchParams.get('month') // YYYY-MM

  let query = supabaseAdmin
    .from('appointments')
    .select('*')
    .eq('worker_id', workerId)
    .order('appointment_date', { ascending: true })
    .order('appointment_time', { ascending: true })

  if (month) {
    // Use [monthStart, nextMonthStart) to avoid invalid dates like YYYY-MM-31
    const [y, m] = month.split('-').map(Number)
    if (!y || !m) {
      return NextResponse.json({ error: 'month 格式錯誤，應為 YYYY-MM' }, { status: 400 })
    }
    const monthStart = `${month}-01`
    const nextMonthStart = new Date(y, m, 1).toISOString().slice(0, 10) // YYYY-MM-01 (UTC safe for date string)
    query = query.gte('appointment_date', monthStart).lt('appointment_date', nextMonthStart)
  }

  const { data: appointments, error } = await query

  if (error) {
    return NextResponse.json({ error: '取得預約失敗', details: error }, { status: 500 })
  }

  return NextResponse.json({ appointments: appointments ?? [] })
}

// POST /api/appointments — customer creates an appointment (public)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      workerId: wId,
      customerName,
      customerPhone,
      partySize,
      serviceItem,
      appointmentDate,
      appointmentTime,
    } = body ?? {}

    if (!wId || !customerName || !customerPhone || !appointmentDate || !appointmentTime) {
      return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 })
    }

    const ip = getClientIp(req)
    const postRl = checkRateLimit({
      key: `appointments_post:${ip}:${wId}`,
      limit: 5,
      windowMs: 60 * 60 * 1000,
    })
    if (!postRl.allowed) {
      return NextResponse.json({ error: '建立預約次數過多，請稍後再試' }, { status: 429 })
    }

    // Validate phone format
    if (!validatePhone(customerPhone)) {
      return NextResponse.json({ error: '電話格式不正確（範例：0912345678）' }, { status: 400 })
    }

    const parsedPartySize = Number(partySize ?? 1)
    if (!Number.isFinite(parsedPartySize) || parsedPartySize < 1 || parsedPartySize > 20) {
      return NextResponse.json({ error: '人數格式不正確（1～20）' }, { status: 400 })
    }
    const service = String(serviceItem ?? '').trim()
    if (!service) {
      return NextResponse.json({ error: '請填寫服務項目' }, { status: 400 })
    }

    // Validate worker exists and is active
    const { data: worker } = await supabaseAdmin
      .from('workers')
      .select('id, is_active, slot_duration, working_hours, working_hours_exceptions')
      .eq('id', wId)
      .eq('is_active', true)
      .single()

    if (!worker) {
      return NextResponse.json({ error: '找不到工作者' }, { status: 404 })
    }

    const exceptions = (worker.working_hours_exceptions ?? {}) as Record<string, boolean>
    if (exceptions[appointmentDate]) {
      return NextResponse.json({ error: '此日期為公休，請選擇其他時間' }, { status: 400 })
    }

    // Validate slot is within business hours & aligns to slot_duration
    const duration = Number(worker.slot_duration ?? 60)
    const dayKey = dayKeyForDateTaipei(appointmentDate)
    const schedule = (worker.working_hours as any)?.[dayKey] as { start: string; end: string; closed: boolean } | undefined

    if (!schedule || schedule.closed) {
      return NextResponse.json({ error: '此日期未營業，請選擇其他時間' }, { status: 400 })
    }

    const start = toMinutes(schedule.start)
    const end = toMinutes(schedule.end)
    const hhmm = String(appointmentTime).slice(0, 5)
    const requested = toMinutes(hhmm)
    if (requested < start || requested + duration > end) {
      return NextResponse.json({ error: '此時間不在營業時段內' }, { status: 400 })
    }
    if ((requested - start) % duration !== 0) {
      return NextResponse.json({ error: `請選擇每 ${duration} 分鐘為間隔的時段` }, { status: 400 })
    }

    // Lead time rule: must be at least 2 hours from now (Asia/Taipei)
    const apptAt = new Date(`${appointmentDate}T${hhmm}:00+08:00`).getTime()
    if (!Number.isFinite(apptAt)) {
      return NextResponse.json({ error: '預約時間格式錯誤' }, { status: 400 })
    }
    if (apptAt < Date.now() + MIN_LEAD_TIME_MS) {
      return NextResponse.json({ error: '最早需在 2 小時後才能預約' }, { status: 400 })
    }

    const manageToken = crypto.randomUUID()

    const { data, error } = await supabaseAdmin
      .from('appointments')
      .insert({
        worker_id: wId,
        manage_token: manageToken,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        party_size: parsedPartySize,
        service_item: service,
        appointment_date: appointmentDate,
        appointment_time: appointmentTime,
        duration,
      })
      .select()
      .single()

    if (error) {
      // unique_violation: slot already taken
      if (error.code === '23505') {
        return NextResponse.json({ error: '此時段已被預約，請選擇其他時間' }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json({ appointment: data, manageToken }, { status: 201 })
  } catch (error) {
    console.error('Appointment create error:', error)
    return NextResponse.json({ error: '預約失敗，請稍後再試' }, { status: 500 })
  }
}

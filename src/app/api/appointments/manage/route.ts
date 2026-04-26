import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { validatePhone } from '@/lib/utils'

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

function dayKeyForDate(dateStr: string): 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' {
  const day = new Date(`${dateStr}T00:00:00`).getDay()
  return (['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const)[day]
}

export async function PATCH(req: NextRequest) {
  try {
    const { manageToken, customerPhone, action, newDate, newTime } = await req.json()

    if (!manageToken || !customerPhone || !action) {
      return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 })
    }
    if (!validatePhone(customerPhone)) {
      return NextResponse.json({ error: '電話格式不正確（範例：0912345678）' }, { status: 400 })
    }

    const { data: appt, error: apptErr } = await supabaseAdmin
      .from('appointments')
      .select('id, worker_id, customer_phone, appointment_date, appointment_time, status')
      .eq('manage_token', manageToken)
      .single()

    if (apptErr || !appt) {
      return NextResponse.json({ error: '找不到預約' }, { status: 404 })
    }
    if (appt.customer_phone !== customerPhone) {
      return NextResponse.json({ error: '電話驗證失敗' }, { status: 403 })
    }
    if (appt.status !== 'confirmed') {
      return NextResponse.json({ error: '此預約已無法修改' }, { status: 400 })
    }

    if (action === 'cancel') {
      const { data, error } = await supabaseAdmin
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', appt.id)
        .select()
        .single()
      if (error) {
        return NextResponse.json({ error: '取消失敗', details: error }, { status: 500 })
      }
      return NextResponse.json({ appointment: data })
    }

    if (action === 'reschedule') {
      if (!newDate || !newTime) {
        return NextResponse.json({ error: '缺少改期時間' }, { status: 400 })
      }

      const { data: worker } = await supabaseAdmin
        .from('workers')
        .select('id, is_active, slot_duration, working_hours')
        .eq('id', appt.worker_id)
        .eq('is_active', true)
        .single()

      if (!worker) {
        return NextResponse.json({ error: '找不到工作者' }, { status: 404 })
      }

      const duration = Number(worker.slot_duration ?? 60)
      const dayKey = dayKeyForDate(newDate)
      const schedule = (worker.working_hours as any)?.[dayKey] as { start: string; end: string; closed: boolean } | undefined
      if (!schedule || schedule.closed) {
        return NextResponse.json({ error: '此日期未營業，請選擇其他時間' }, { status: 400 })
      }

      const start = toMinutes(schedule.start)
      const end = toMinutes(schedule.end)
      const requested = toMinutes(String(newTime).slice(0, 5))
      if (requested < start || requested + duration > end) {
        return NextResponse.json({ error: '此時間不在營業時段內' }, { status: 400 })
      }
      if ((requested - start) % duration !== 0) {
        return NextResponse.json({ error: `請選擇每 ${duration} 分鐘為間隔的時段` }, { status: 400 })
      }

      const { data, error } = await supabaseAdmin
        .from('appointments')
        .update({ appointment_date: newDate, appointment_time: newTime })
        .eq('id', appt.id)
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

    return NextResponse.json({ error: '不支援的操作' }, { status: 400 })
  } catch (error) {
    console.error('Appointment manage error:', error)
    return NextResponse.json({ error: '操作失敗，請稍後再試' }, { status: 500 })
  }
}


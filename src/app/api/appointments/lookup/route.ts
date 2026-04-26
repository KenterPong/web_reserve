import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { validatePhone, getClientIp } from '@/lib/utils'
import { checkRateLimit } from '@/lib/rate-limit'

function taipeiToday(): string {
  // YYYY-MM-DD in Asia/Taipei
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
}

// GET /api/appointments/lookup?phone=...&workerId=...
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const phone = searchParams.get('phone')?.trim() ?? ''
  const workerId = searchParams.get('workerId')?.trim() ?? ''

  if (!phone || !workerId) {
    return NextResponse.json({ error: '缺少必要參數' }, { status: 400 })
  }
  if (!validatePhone(phone)) {
    return NextResponse.json({ error: '電話格式不正確（範例：0912345678）' }, { status: 400 })
  }

  const ip = getClientIp(req)
  const limit = checkRateLimit({
    key: `appointments_lookup:${ip}`,
    limit: 10,
    windowMs: 60 * 60 * 1000,
  })

  if (!limit.allowed) {
    return NextResponse.json({ error: '查詢次數過多，請稍後再試' }, { status: 429 })
  }

  // Ensure worker exists and active (avoid scanning ids)
  const { data: worker } = await supabaseAdmin
    .from('workers')
    .select('id')
    .eq('id', workerId)
    .eq('is_active', true)
    .single()

  if (!worker) {
    return NextResponse.json({ error: '找不到工作者' }, { status: 404 })
  }

  const today = taipeiToday()

  const { data, error } = await supabaseAdmin
    .from('appointments')
    .select('appointment_date, appointment_time')
    .eq('worker_id', workerId)
    .eq('customer_phone', phone)
    .eq('status', 'confirmed')
    .gte('appointment_date', today)
    .order('appointment_date', { ascending: true })
    .order('appointment_time', { ascending: true })

  if (error) {
    return NextResponse.json({ error: '查詢失敗，請稍後再試', details: error }, { status: 500 })
  }

  return NextResponse.json({
    appointments: (data ?? []).map((a) => ({
      date: a.appointment_date,
      time: String(a.appointment_time).slice(0, 5),
    })),
  })
}


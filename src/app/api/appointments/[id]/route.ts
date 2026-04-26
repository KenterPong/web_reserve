import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  confirmed: ['completed', 'cancelled', 'no_show'],
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const workerId = req.cookies.get('worker_id')?.value
  if (!workerId) {
    return NextResponse.json({ error: '未登入' }, { status: 401 })
  }

  const { status } = await req.json()

  if (!status) {
    return NextResponse.json({ error: '缺少 status' }, { status: 400 })
  }

  // Fetch the appointment to verify ownership
  const { data: appointment } = await supabaseAdmin
    .from('appointments')
    .select('id, worker_id, status')
    .eq('id', params.id)
    .single()

  if (!appointment) {
    return NextResponse.json({ error: '找不到預約' }, { status: 404 })
  }

  if (appointment.worker_id !== workerId) {
    return NextResponse.json({ error: '無權限' }, { status: 403 })
  }

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

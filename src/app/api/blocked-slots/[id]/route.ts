import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireBlockedSlotsFeature } from '@/lib/blocked-slots-access'

// DELETE /api/blocked-slots/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const workerId = req.cookies.get('worker_id')?.value
  if (!workerId) {
    return NextResponse.json({ error: '未登入' }, { status: 401 })
  }

  const denied = await requireBlockedSlotsFeature(workerId)
  if (denied) return denied

  const id = params.id
  if (!id) {
    return NextResponse.json({ error: '缺少 id' }, { status: 400 })
  }

  const { data: row, error: findErr } = await supabaseAdmin
    .from('blocked_slots')
    .select('id,worker_id')
    .eq('id', id)
    .maybeSingle()

  if (findErr) {
    console.error('[blocked-slots DELETE] find', findErr)
    return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
  }
  if (!row) {
    return NextResponse.json({ error: '找不到資料' }, { status: 404 })
  }
  if (row.worker_id !== workerId) {
    return NextResponse.json({ error: '無權限' }, { status: 403 })
  }

  const { error } = await supabaseAdmin.from('blocked_slots').delete().eq('id', id).eq('worker_id', workerId)

  if (error) {
    console.error('[blocked-slots DELETE]', error)
    return NextResponse.json({ error: '刪除失敗' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

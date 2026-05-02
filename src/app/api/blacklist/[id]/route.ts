import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireBlacklistFeature } from '@/lib/blacklist-access'
import { mapBlacklistDbError } from '@/lib/blacklist-db-error'

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const workerId = req.cookies.get('worker_id')?.value
  if (!workerId) {
    return NextResponse.json({ error: '未登入' }, { status: 401 })
  }

  const denied = await requireBlacklistFeature(workerId)
  if (denied) return denied

  const id = params.id
  if (!id) {
    return NextResponse.json({ error: '缺少 id' }, { status: 400 })
  }

  const { data: row, error: findErr } = await supabaseAdmin
    .from('blacklist')
    .select('id')
    .eq('id', id)
    .eq('worker_id', workerId)
    .maybeSingle()

  if (findErr) {
    return mapBlacklistDbError(findErr, 'delete')
  }
  if (!row) {
    return NextResponse.json({ error: '找不到項目' }, { status: 404 })
  }

  const { error } = await supabaseAdmin.from('blacklist').delete().eq('id', id).eq('worker_id', workerId)

  if (error) {
    return mapBlacklistDbError(error, 'delete')
  }

  return NextResponse.json({ ok: true })
}

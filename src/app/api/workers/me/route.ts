import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getTrialStatus } from '@/lib/trial-period'

// GET /api/workers/me — authenticated worker reads their own full profile
export async function GET(req: NextRequest) {
  const workerId = req.cookies.get('worker_id')?.value
  if (!workerId) {
    return NextResponse.json({ error: '未登入' }, { status: 401 })
  }

  const { data: worker } = await supabaseAdmin
    .from('workers')
    .select('*')
    .eq('id', workerId)
    .single()

  if (!worker) {
    return NextResponse.json({ error: '找不到帳號' }, { status: 404 })
  }

  const trial = getTrialStatus(
    worker.created_at,
    worker.subscription_status,
    worker.is_active,
  )

  return NextResponse.json({ worker, trial })
}

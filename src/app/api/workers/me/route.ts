import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

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

  return NextResponse.json({ worker })
}

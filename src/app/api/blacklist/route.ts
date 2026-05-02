import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireBlacklistFeature } from '@/lib/blacklist-access'
import { normalizeTaiwanPhone, validatePhone } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const workerId = req.cookies.get('worker_id')?.value
  if (!workerId) {
    return NextResponse.json({ error: '未登入' }, { status: 401 })
  }

  const denied = await requireBlacklistFeature(workerId)
  if (denied) return denied

  const { data, error } = await supabaseAdmin
    .from('blacklist')
    .select('id, worker_id, phone, note, created_at')
    .eq('worker_id', workerId)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: '讀取黑名單失敗', details: error }, { status: 500 })
  }

  return NextResponse.json({ items: data ?? [] })
}

export async function POST(req: NextRequest) {
  const workerId = req.cookies.get('worker_id')?.value
  if (!workerId) {
    return NextResponse.json({ error: '未登入' }, { status: 401 })
  }

  const denied = await requireBlacklistFeature(workerId)
  if (denied) return denied

  let body: { phone?: string; note?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '請求格式錯誤' }, { status: 400 })
  }

  const raw = String(body?.phone ?? '').trim()
  const note = String(body?.note ?? '').trim() || null

  if (!raw) {
    return NextResponse.json({ error: '請填寫電話' }, { status: 400 })
  }
  if (!validatePhone(raw)) {
    return NextResponse.json({ error: '電話格式不正確（範例：0912345678）' }, { status: 400 })
  }

  const phone = normalizeTaiwanPhone(raw)

  const { data, error } = await supabaseAdmin
    .from('blacklist')
    .insert({ worker_id: workerId, phone, note })
    .select('id, worker_id, phone, note, created_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: '此電話已在黑名單中' }, { status: 409 })
    }
    return NextResponse.json({ error: '新增失敗', details: error }, { status: 500 })
  }

  return NextResponse.json({ item: data }, { status: 201 })
}

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

// DELETE /api/workers/me — 刪除自己的帳號與相關資料
export async function DELETE(req: NextRequest) {
  const workerId = req.cookies.get('worker_id')?.value
  if (!workerId) {
    return NextResponse.json({ error: '未登入' }, { status: 401 })
  }

  const { data: worker } = await supabaseAdmin
    .from('workers')
    .select('id')
    .eq('id', workerId)
    .single()

  if (!worker) {
    return NextResponse.json({ error: '找不到帳號' }, { status: 404 })
  }

  const { data: appointments } = await supabaseAdmin
    .from('appointments')
    .select('reference_image_url')
    .eq('worker_id', workerId)
    .not('reference_image_url', 'is', null)

  const imagePaths = (appointments ?? [])
    .map((a) => String(a.reference_image_url ?? '').trim())
    .filter(Boolean)

  if (imagePaths.length > 0) {
    const { error: rmErr } = await supabaseAdmin.storage
      .from('reference-images')
      .remove(imagePaths)
    if (rmErr) {
      console.warn('[delete-account] storage remove:', rmErr.message)
    }
  }

  await supabaseAdmin
    .from('workers')
    .update({ referred_by: null })
    .eq('referred_by', workerId)

  const { error: delErr } = await supabaseAdmin
    .from('workers')
    .delete()
    .eq('id', workerId)

  if (delErr) {
    console.error('[delete-account]', delErr)
    return NextResponse.json({ error: '刪除失敗，請稍後再試' }, { status: 500 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set('worker_id', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })
  return response
}

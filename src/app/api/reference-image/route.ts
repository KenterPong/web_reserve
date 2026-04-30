import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { validatePhone } from '@/lib/utils'

export const runtime = 'nodejs'

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png'])

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const manageToken = String(form.get('manageToken') ?? '').trim()
    const customerPhone = String(form.get('customerPhone') ?? '').trim()
    const file = form.get('file')

    if (!manageToken || !customerPhone || !file) {
      return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 })
    }
    if (!validatePhone(customerPhone)) {
      return NextResponse.json({ error: '電話格式不正確（範例：0912345678）' }, { status: 400 })
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: '檔案格式不正確' }, { status: 400 })
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: '僅支援 jpg / png' }, { status: 400 })
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      return NextResponse.json({ error: '檔案大小需在 5MB 以內' }, { status: 400 })
    }

    const { data: appt } = await supabaseAdmin
      .from('appointments')
      .select('id, worker_id, customer_phone, status, manage_token')
      .eq('manage_token', manageToken)
      .single()

    if (!appt) {
      return NextResponse.json({ error: '找不到預約' }, { status: 404 })
    }
    if (appt.customer_phone !== customerPhone) {
      return NextResponse.json({ error: '電話驗證失敗' }, { status: 403 })
    }
    if (appt.status !== 'confirmed') {
      return NextResponse.json({ error: '此預約已無法上傳參考圖' }, { status: 400 })
    }

    const { data: worker } = await supabaseAdmin
      .from('workers')
      .select('id, referral_count, is_active')
      .eq('id', appt.worker_id)
      .eq('is_active', true)
      .single()

    if (!worker) {
      return NextResponse.json({ error: '找不到工作者' }, { status: 404 })
    }
    if (Number(worker.referral_count ?? 0) < 10) {
      return NextResponse.json({ error: '此工作者尚未解鎖參考圖功能' }, { status: 403 })
    }

    const ext = file.type === 'image/png' ? 'png' : 'jpg'
    const objectPath = `${appt.worker_id}/${appt.id}/reference.${ext}`

    const { error: uploadErr } = await supabaseAdmin.storage
      .from('reference-images')
      .upload(objectPath, file, { contentType: file.type, upsert: true })

    if (uploadErr) {
      return NextResponse.json({ error: '上傳失敗', details: uploadErr }, { status: 500 })
    }

    const { error: updateErr } = await supabaseAdmin
      .from('appointments')
      .update({ reference_image_url: objectPath })
      .eq('id', appt.id)

    if (updateErr) {
      return NextResponse.json({ error: '寫入預約資料失敗', details: updateErr }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Reference image upload error:', error)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}


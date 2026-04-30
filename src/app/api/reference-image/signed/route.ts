import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const workerId = req.cookies.get('worker_id')?.value
    if (!workerId) {
      return NextResponse.json({ error: '未登入' }, { status: 401 })
    }

    const appointmentId = req.nextUrl.searchParams.get('appointmentId')
    if (!appointmentId) {
      return NextResponse.json({ error: '缺少 appointmentId' }, { status: 400 })
    }

    const { data: appt } = await supabaseAdmin
      .from('appointments')
      .select('id, worker_id, reference_image_url')
      .eq('id', appointmentId)
      .single()

    if (!appt) {
      return NextResponse.json({ error: '找不到預約' }, { status: 404 })
    }
    if (appt.worker_id !== workerId) {
      return NextResponse.json({ error: '無權限' }, { status: 403 })
    }
    if (!appt.reference_image_url) {
      return NextResponse.json({ error: '此預約尚未上傳參考圖' }, { status: 404 })
    }

    const { data, error } = await supabaseAdmin.storage
      .from('reference-images')
      .createSignedUrl(String(appt.reference_image_url), 60 * 60 * 24)

    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: '產生連結失敗', details: error }, { status: 500 })
    }

    return NextResponse.json({ url: data.signedUrl })
  } catch (error) {
    console.error('Reference image signed url error:', error)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}


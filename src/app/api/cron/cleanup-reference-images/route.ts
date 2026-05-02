import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { appointmentSlotEndMsTaipei } from '@/lib/datetime-taipei'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 預約「時段結束」後再保留多久（毫秒）才刪除參考圖 */
const RETENTION_AFTER_SLOT_MS = 2 * 60 * 60 * 1000

function authorizeCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

async function runCleanup() {
  const now = Date.now()
  const { data: rows, error } = await supabaseAdmin
    .from('appointments')
    .select('id, reference_image_url, appointment_date, appointment_time, duration')
    .not('reference_image_url', 'is', null)
    .order('appointment_date', { ascending: true })
    .limit(2000)

  if (error) {
    return NextResponse.json({ error: '查詢失敗', details: error }, { status: 500 })
  }

  let cleaned = 0
  const errors: string[] = []

  for (const row of rows ?? []) {
    const path = String(row.reference_image_url ?? '').trim()
    if (!path) continue

    const endMs = appointmentSlotEndMsTaipei(
      String(row.appointment_date),
      String(row.appointment_time),
      Number(row.duration ?? 60),
    )
    if (!Number.isFinite(endMs)) continue
    if (now < endMs + RETENTION_AFTER_SLOT_MS) continue

    const { error: rmErr } = await supabaseAdmin.storage.from('reference-images').remove([path])
    if (rmErr) {
      console.warn('[cleanup-reference-images] storage remove:', path, rmErr.message)
    }

    const { error: upErr } = await supabaseAdmin
      .from('appointments')
      .update({ reference_image_url: null })
      .eq('id', row.id)

    if (upErr) {
      errors.push(`${row.id}: ${upErr.message}`)
      continue
    }
    cleaned += 1
  }

  return NextResponse.json({
    ok: true,
    cleaned,
    scanned: (rows ?? []).length,
    errors: errors.length ? errors.slice(0, 20) : undefined,
  })
}

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET?.trim()) {
    return NextResponse.json({ error: '未設定 CRON_SECRET，排程無法執行' }, { status: 503 })
  }
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }
  try {
    return await runCleanup()
  } catch (e) {
    console.error('[cleanup-reference-images]', e)
    return NextResponse.json({ error: '執行失敗' }, { status: 500 })
  }
}

/** 與 GET 相同，方便手動或部分排程器以 POST 觸發 */
export async function POST(req: NextRequest) {
  return GET(req)
}

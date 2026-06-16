import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { shouldDeactivateWorker } from '@/lib/trial-period'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function authorizeCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

async function runDeactivateExpiredTrials() {
  const now = new Date()
  const { data: workers, error } = await supabaseAdmin
    .from('workers')
    .select('id, created_at, subscription_status, is_active')
    .eq('is_active', true)
    .eq('subscription_status', 'inactive')

  if (error) {
    return NextResponse.json({ error: '查詢失敗', details: error }, { status: 500 })
  }

  const toDeactivate = (workers ?? []).filter((w) =>
    shouldDeactivateWorker(w.created_at, w.subscription_status, w.is_active, now),
  )

  let deactivated = 0
  const errors: string[] = []

  for (const w of toDeactivate) {
    const { error: upErr } = await supabaseAdmin
      .from('workers')
      .update({ is_active: false, updated_at: now.toISOString() })
      .eq('id', w.id)
      .eq('is_active', true)

    if (upErr) {
      errors.push(`${w.id}: ${upErr.message}`)
      continue
    }
    deactivated += 1
  }

  return NextResponse.json({
    ok: true,
    scanned: (workers ?? []).length,
    deactivated,
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
    return await runDeactivateExpiredTrials()
  } catch (e) {
    console.error('[deactivate-expired-trials]', e)
    return NextResponse.json({ error: '執行失敗' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  return GET(req)
}

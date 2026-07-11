import { NextRequest, NextResponse } from 'next/server'
import { ONBOARDING_STEPS } from '@/lib/onboarding-analytics'
import { supabaseAdmin } from '@/lib/supabase-admin'

const VALID_STEPS = new Set<string>(ONBOARDING_STEPS)

function parseBody(body: unknown): {
  session_id: string
  step: string
  line_user_id: string | null
} | null {
  if (!body || typeof body !== 'object') return null

  const record = body as Record<string, unknown>
  const session_id = String(record.session_id ?? '').trim()
  const step = String(record.step ?? '').trim()
  const line_user_id =
    record.line_user_id != null && String(record.line_user_id).trim()
      ? String(record.line_user_id).trim().slice(0, 128)
      : null

  if (!session_id || session_id.length > 128) return null
  if (!step || !VALID_STEPS.has(step)) return null

  return { session_id, step, line_user_id }
}

// POST /api/onboarding-events — 寫入 onboarding 漏斗事件
export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = parseBody(body)
  if (!parsed) {
    return NextResponse.json({ error: 'Invalid session_id or step' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('onboarding_events').insert({
    session_id: parsed.session_id,
    step: parsed.step,
    line_user_id: parsed.line_user_id,
  })

  if (error) {
    console.error('[onboarding-events POST]', error)
    return NextResponse.json({ error: '寫入失敗' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

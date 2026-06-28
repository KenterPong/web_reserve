import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isReservedWorkerSlug } from '@/lib/reserved-slugs'
import { validateSlug } from '@/lib/utils'

/** GET /api/workers/check-slug?slug= — onboarding 即時驗證（需登入） */
export async function GET(req: NextRequest) {
  const workerId = req.cookies.get('worker_id')?.value
  if (!workerId) {
    return NextResponse.json({ error: '未登入' }, { status: 401 })
  }

  const slug = (req.nextUrl.searchParams.get('slug') ?? '').trim().toLowerCase()

  if (!slug) {
    return NextResponse.json({ status: 'invalid' as const })
  }

  if (!validateSlug(slug)) {
    return NextResponse.json({ status: 'invalid' as const })
  }

  if (isReservedWorkerSlug(slug)) {
    return NextResponse.json({ status: 'reserved' as const })
  }

  const { data: existing } = await supabaseAdmin
    .from('workers')
    .select('id')
    .eq('slug', slug)
    .neq('id', workerId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ status: 'taken' as const })
  }

  return NextResponse.json({ status: 'available' as const })
}

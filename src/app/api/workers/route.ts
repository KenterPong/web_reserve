import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { validateSlug, validatePhone, getClientIp } from '@/lib/utils'
import { checkRateLimit } from '@/lib/rate-limit'

// GET /api/workers?slug= — public worker profile
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')

  if (!slug) {
    return NextResponse.json({ error: '缺少 slug' }, { status: 400 })
  }

  const ip = getClientIp(req)
  const rl = checkRateLimit({
    key: `workers_get:${ip}`,
    limit: 100,
    windowMs: 60 * 60 * 1000,
  })
  if (!rl.allowed) {
    return NextResponse.json({ error: '請求次數過多，請稍後再試' }, { status: 429 })
  }

  const { data: worker } = await supabaseAdmin
    .from('workers')
    .select(
      'id, display_name, business_name, avatar_url, slug, bio, working_hours, working_hours_exceptions, slot_duration, is_active, contact_phone, booking_confirmation_message, referral_count',
    )
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!worker) {
    return NextResponse.json({ error: '找不到工作者' }, { status: 404 })
  }

  return NextResponse.json({ worker })
}

// PATCH /api/workers — authenticated worker updates own profile
export async function PATCH(req: NextRequest) {
  const workerId = req.cookies.get('worker_id')?.value
  if (!workerId) {
    return NextResponse.json({ error: '未登入' }, { status: 401 })
  }

  const body = await req.json()
  const {
    slug,
    business_name,
    bio,
    bio_answers,
    working_hours,
    working_hours_exceptions,
    slot_duration,
    contact_phone,
    booking_confirmation_message,
  } = body

  const updates: Record<string, unknown> = {}

  if (slug !== undefined) {
    if (!validateSlug(slug)) {
      return NextResponse.json(
        { error: 'slug 只能使用小寫英數字，長度 3～30 字元' },
        { status: 400 },
      )
    }
    // Check uniqueness (excluding current worker)
    const { data: existing } = await supabaseAdmin
      .from('workers')
      .select('id')
      .eq('slug', slug)
      .neq('id', workerId)
      .single()

    if (existing) {
      return NextResponse.json({ error: '此 slug 已被使用' }, { status: 409 })
    }
    updates.slug = slug
  }

  if (business_name !== undefined) updates.business_name = business_name
  if (bio !== undefined) updates.bio = bio
  if (bio_answers !== undefined) updates.bio_answers = bio_answers
  if (working_hours !== undefined) updates.working_hours = working_hours
  if (working_hours_exceptions !== undefined) updates.working_hours_exceptions = working_hours_exceptions
  if (slot_duration !== undefined) updates.slot_duration = slot_duration
  if (contact_phone !== undefined) {
    const raw = contact_phone === null || contact_phone === '' ? '' : String(contact_phone).trim()
    if (raw && !validatePhone(raw)) {
      return NextResponse.json({ error: '聯絡電話格式不正確（範例：0912345678）' }, { status: 400 })
    }
    updates.contact_phone = raw.length ? raw : null
  }
  if (booking_confirmation_message !== undefined) {
    const raw =
      booking_confirmation_message === null || booking_confirmation_message === ''
        ? ''
        : String(booking_confirmation_message).trim()
    if (raw.length > 5000) {
      return NextResponse.json({ error: '預約完成提醒文字請勿超過 5000 字元' }, { status: 400 })
    }
    updates.booking_confirmation_message = raw.length ? raw : null
  }

  const { data, error } = await supabaseAdmin
    .from('workers')
    .update(updates)
    .eq('id', workerId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: '更新失敗', details: error }, { status: 500 })
  }

  return NextResponse.json({ worker: data })
}

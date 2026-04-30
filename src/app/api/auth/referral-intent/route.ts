import { NextRequest, NextResponse } from 'next/server'

import {
  REFERRAL_INTENT_COOKIE_NAME,
  clearReferralIntentCookieOptions,
  referralIntentCookieOptions,
  safeSlugFromString,
} from '@/lib/referral-intent-cookie'

/** 將推薦 slug 寫入 httpOnly cookie，再讓使用者前往 /api/auth/line-bootstrap */
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const slug =
    typeof body === 'object' &&
    body !== null &&
    'slug' in body &&
    typeof (body as { slug: unknown }).slug === 'string'
      ? (body as { slug: string }).slug
      : ''

  const hostHeader = request.headers.get('host') ?? 'localhost'
  const safe = safeSlugFromString(slug)

  const res = NextResponse.json({ ok: true as const })

  if (!safe) {
    res.cookies.set(
      REFERRAL_INTENT_COOKIE_NAME,
      '',
      clearReferralIntentCookieOptions(hostHeader),
    )
    return res
  }

  res.cookies.set(REFERRAL_INTENT_COOKIE_NAME, safe, referralIntentCookieOptions(hostHeader))
  return res
}
